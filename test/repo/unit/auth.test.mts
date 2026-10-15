/**
 * @file Per-request credentials without network or module doubles.
 */
import { describe, expect, it } from 'vitest'

import {
  getSdkAuthorization,
  resolveSdkRequestHeaders,
  SdkAuthenticationError,
  validateSdkApiToken,
} from '../../../src/auth.mts'
import { SOCKET_PUBLIC_API_TOKEN } from '../../../src/constants.mts'

import type { RequestOptionsWithHooks } from '../../../src/types/core.mts'

describe('per-request authentication', () => {
  it.each([SOCKET_PUBLIC_API_TOKEN, `\t ${SOCKET_PUBLIC_API_TOKEN} \n`])(
    'rejects the retired public credential',
    token => {
      expect(() => validateSdkApiToken(token)).toThrow(TypeError)
    },
  )

  it.each(['basic', 'bearer'] as const)(
    'rejects the retired public credential with %s authorization',
    authScheme => {
      expect(() =>
        getSdkAuthorization(SOCKET_PUBLIC_API_TOKEN, authScheme),
      ).toThrow(TypeError)
    },
  )

  it.each(['basic', 'bearer'] as const)(
    'rejects a retired provider credential with %s authorization before replacing static headers',
    async authScheme => {
      let failure: unknown
      try {
        await resolveSdkRequestHeaders({
          headers: { Authorization: 'synthetic-valid-static-token' },
          authProvider: async () => ({
            token: ` ${SOCKET_PUBLIC_API_TOKEN}\t`,
            authScheme,
          }),
        })
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(SdkAuthenticationError)
      if (!(failure instanceof SdkAuthenticationError)) {
        throw new Error('Expected SDK authentication failure')
      }
      expect(String(failure)).not.toContain(SOCKET_PUBLIC_API_TOKEN)
      expect(String(failure.cause)).not.toContain(SOCKET_PUBLIC_API_TOKEN)
    },
  )

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
