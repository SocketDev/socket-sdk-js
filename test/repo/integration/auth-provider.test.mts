/**
 * @file Credentials across real SDK contexts, requests, and retry boundaries.
 */
import { describe, expect, it } from 'vitest'

import {
  getSdkAuthorization,
  resolveSdkRequestHeaders,
  SdkAuthenticationError,
} from '../../../src/auth.mts'
import { createSdkApiContext } from '../../../src/api-client.mts'
import { SocketSdk } from '../../../src/socket-sdk-class.mts'
import {
  executeSdkWithRetry,
  getSdkRetryDelay,
} from '../../../src/api-retry.mts'

describe('SDK authentication provider integration', () => {
  it('advertises support for resolving credentials per request', () => {
    expect(SocketSdk.supportsAuthProvider).toBe(true)
  })

  it('preserves static authentication when no provider is configured', async () => {
    const context = createSdkApiContext({
      apiToken: 'example-token',
      baseUrl: 'https://api.example.com/v0/',
    })
    const headers = await resolveSdkRequestHeaders(context.requestOptions)
    expect(headers?.['Authorization']).toBe(
      getSdkAuthorization('example-token'),
    )
  })

  it('resolves rotated credentials for each request without changing defaults', async () => {
    let token = 'initial-token'
    const context = createSdkApiContext({
      apiToken: 'constructor-token',
      baseUrl: 'https://api.example.com/v0/',
      authProvider: async () => ({ token, authScheme: 'bearer' }),
    })
    const first = await resolveSdkRequestHeaders(context.requestOptions)
    token = 'rotated-token'
    const second = await resolveSdkRequestHeaders(context.requestOptions)
    expect(first?.['Authorization']).toBe('Bearer initial-token')
    expect(second?.['Authorization']).toBe('Bearer rotated-token')
    expect(context.requestOptions.headers?.['Authorization']).toBe(
      getSdkAuthorization('constructor-token'),
    )
  })

  it('fails closed and suppresses retries when credential resolution fails', async () => {
    const failure = new Error('login required')
    await expect(
      resolveSdkRequestHeaders({
        headers: { Authorization: 'stale-token' },
        authProvider: async () => {
          throw failure
        },
      }),
    ).rejects.toBeInstanceOf(SdkAuthenticationError)
    expect(() => getSdkRetryDelay(new SdkAuthenticationError(failure))).toThrow(
      SdkAuthenticationError,
    )
  })

  it('does not retry a rejected credential provider', async () => {
    let calls = 0
    await expect(
      executeSdkWithRetry(
        () =>
          resolveSdkRequestHeaders({
            authProvider: async () => {
              calls += 1
              throw new Error('login required')
            },
          }),
        { retries: 2, retryDelay: 1 },
      ),
    ).rejects.toBeInstanceOf(SdkAuthenticationError)
    expect(calls).toBe(1)
  })
})
