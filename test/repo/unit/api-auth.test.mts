/**
 * @file Per-request credentials without network or module doubles.
 */
import { describe, expect, it } from 'vitest'

import {
  getSdkAuthorization,
  resolveSdkRequestHeaders,
  SdkAuthenticationError,
} from '../../../src/api-auth.mts'
import { createSdkApiContext } from '../../../src/api-client.mts'
import { SocketSdk } from '../../../src/socket-sdk-class.mts'
import {
  executeSdkWithRetry,
  getSdkRetryDelay,
} from '../../../src/api-retry.mts'

import type { RequestOptionsWithHooks } from '../../../src/types/core.mts'

describe('per-request authentication', () => {
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

  it('removes case-insensitive stale authorization without dropping other headers', async () => {
    const headers = await resolveSdkRequestHeaders({
      headers: {
        authorization: 'stale',
        AUTHORIZATION: 'also-stale',
        'User-Agent': 'example-cli',
      },
      authProvider: async () => ({
        token: 'example-token',
        authScheme: 'basic',
      }),
    })
    expect(headers).toEqual({
      'User-Agent': 'example-cli',
      Authorization: getSdkAuthorization('example-token'),
    })
  })

  it('keeps concurrent request credentials separate', async () => {
    let callCount = 0
    let finishFirst: (() => void) | undefined
    const firstWait = new Promise<void>(resolve => {
      finishFirst = resolve
    })
    const options: RequestOptionsWithHooks = {
      authProvider: async () => {
        callCount += 1
        const token = `request-${callCount}`
        if (callCount === 1) {
          await firstWait
        }
        return { token, authScheme: 'bearer' }
      },
    }
    const first = resolveSdkRequestHeaders(options)
    const second = await resolveSdkRequestHeaders(options)
    finishFirst?.()
    expect((await first)?.['Authorization']).toBe('Bearer request-1')
    expect(second?.['Authorization']).toBe('Bearer request-2')
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

  it.each(['', 'token\r\ninjected', 'token\ninjected', 'x'.repeat(1025)])(
    'rejects unsafe provider credentials',
    async token => {
      await expect(
        resolveSdkRequestHeaders({
          authProvider: async () => ({ token, authScheme: 'bearer' }),
        }),
      ).rejects.toBeInstanceOf(SdkAuthenticationError)
    },
  )

  it('does not resolve credentials after cancellation', async () => {
    let calls = 0
    await expect(
      resolveSdkRequestHeaders({
        signal: AbortSignal.abort(),
        authProvider: async () => {
          calls += 1
          return { token: 'example-token', authScheme: 'bearer' }
        },
      }),
    ).rejects.toBeDefined()
    expect(calls).toBe(0)
  })

  it('honors cancellation while resolving credentials', async () => {
    const controller = new AbortController()
    await expect(
      resolveSdkRequestHeaders({
        signal: controller.signal,
        authProvider: async () => {
          controller.abort()
          return { token: 'example-token', authScheme: 'bearer' }
        },
      }),
    ).rejects.toBeDefined()
  })
})
