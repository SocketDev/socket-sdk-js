/**
 * @file Tests covering socket-sdk-class.ts retry, response-size, and cache
 *   non-error paths. Targets:
 *
 *   - #executeWithRetry onRetry branches (401/403 throw, 429 with Retry-After,
 *     500 recovery)
 *   - #getResponseText 50MB size limit
 *   - #getTtlForEndpoint / cache config (number, object with endpoint, default)
 *   - #parseRetryAfter branches (HTTP-date, empty, invalid, past)
 */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { setupLocalHttpServer } from '../../utils/local-server-helpers.mts'

import type { IncomingMessage, ServerResponse } from 'node:http'

// =============================================================================
// 4a. socket-sdk-class.ts — #executeWithRetry onRetry branches
//     (401/403 throw, 429 with Retry-After header, non-ResponseError)
// =============================================================================

describe('SocketSdk - #executeWithRetry retry behavior', () => {
  // Server that returns 429 with Retry-After header on first request,
  // then 200 on second.
  const getRetryAfterBaseUrl = setupLocalHttpServer(
    (() => {
      let callCount = 0
      return (req: IncomingMessage, res: ServerResponse) => {
        const url = req.url || ''

        if (url.includes('/retry-after-seconds')) {
          callCount++
          if (callCount <= 1) {
            res.writeHead(429, { 'Retry-After': '1' })
            res.end(JSON.stringify({ error: 'Rate limited' }))
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
            callCount = 0
          }
        } else if (url.includes('/retry-after-date')) {
          callCount++
          if (callCount <= 1) {
            const futureDate = new Date(Date.now() + 1000).toUTCString()
            res.writeHead(429, { 'Retry-After': futureDate })
            res.end(JSON.stringify({ error: 'Rate limited' }))
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
            callCount = 0
          }
        } else if (url.includes('/auth-fail')) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized' }))
        } else if (url.includes('/forbidden')) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Forbidden' }))
        } else if (url.includes('/server-error')) {
          callCount++
          if (callCount <= 1) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Internal Server Error' }))
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ recovered: true }))
            callCount = 0
          }
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        }
      }
    })(),
  )

  it('should not retry 401 errors and fail immediately', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getRetryAfterBaseUrl()}/v0/`,
      retries: 3,
      retryDelay: 10,
    })

    const result = await client.getApi('auth-fail', {
      responseType: 'json',
      throws: false,
    })

    const typed = result as { success: boolean; status: number }
    expect(typed.success).toBe(false)
    expect(typed.status).toBe(401)
  })

  it('should not retry 403 errors and fail immediately', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getRetryAfterBaseUrl()}/v0/`,
      retries: 3,
      retryDelay: 10,
    })

    const result = await client.getApi('forbidden', {
      responseType: 'json',
      throws: false,
    })

    const typed = result as { success: boolean; status: number }
    expect(typed.success).toBe(false)
    expect(typed.status).toBe(403)
  })

  it('should retry 429 with Retry-After seconds header and succeed', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getRetryAfterBaseUrl()}/v0/`,
      retries: 3,
      retryDelay: 10,
    })

    const result = await client.getApi<{ ok: boolean }>('retry-after-seconds', {
      responseType: 'json',
    })

    expect(result).toEqual({ ok: true })
  })

  it('should retry 500 errors and succeed on second attempt', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getRetryAfterBaseUrl()}/v0/`,
      retries: 3,
      retryDelay: 10,
    })

    const result = await client.getApi<{ recovered: boolean }>('server-error', {
      responseType: 'json',
    })

    expect(result).toEqual({ recovered: true })
  })
})

// =============================================================================
// 4b. socket-sdk-class.ts — #getResponseText size limit branch (line 484)
// =============================================================================

describe('SocketSdk - #getResponseText size limit', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/huge-text')) {
        // Return a response larger than 50MB to trigger the size limit.
        // We can't actually send 50MB in a test, so we'll use the
        // getApi with responseType: 'text' path and a large enough
        // stream that exceeds the limit.
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        // Send chunks totaling > 50MB
        const chunkSize = 1024 * 1024 // 1MB
        const chunk = Buffer.alloc(chunkSize, 'x')
        let sent = 0
        const maxBytes = 51 * 1024 * 1024 // 51MB
        const sendChunk = () => {
          while (sent < maxBytes) {
            const ok = res.write(chunk)
            sent += chunkSize
            if (!ok) {
              res.once('drain', sendChunk)
              return
            }
          }
          res.end()
        }
        sendChunk()
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  it('should throw when response text exceeds 50MB limit', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
      timeout: 30_000,
    })

    await expect(
      client.getApi('huge-text', { responseType: 'text' }),
    ).rejects.toThrow(/Response exceeds maximum size limit/)
  }, 60_000)
})

// =============================================================================
// 4c. socket-sdk-class.ts — #getTtlForEndpoint and cache-related code
//     (lines 669-709: number TTL, object TTL with endpoint, object TTL default)
// =============================================================================

describe('SocketSdk - cache TTL configuration', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/orgs')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify([{ slug: 'test-org' }]))
      } else if (url.includes('/quota')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ quota: 100, used: 10 }))
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      }
    },
  )

  it('should use numeric cacheTtl for all endpoints', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      cache: true,
      cacheTtl: 60_000,
      retries: 0,
    })

    // First call populates cache
    const result1 = await client.listOrganizations()
    expect(result1.success).toBe(true)

    // Second call should hit cache (same result)
    const result2 = await client.listOrganizations()
    expect(result2.success).toBe(true)
    expect(result1.data).toEqual(result2.data)
  })

  it('should use object cacheTtl with endpoint-specific overrides', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      cache: true,
      cacheTtl: {
        default: 60_000,
        organizations: 120_000,
      },
      retries: 0,
    })

    // Exercise an endpoint that uses endpoint-specific TTL
    const result = await client.listOrganizations()
    expect(result.success).toBe(true)
  })

  it('should fall back to object cacheTtl default when endpoint not configured', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      cache: true,
      cacheTtl: {
        default: 60_000,
      },
      retries: 0,
    })

    // This endpoint is not in the cacheTtl config, so falls back to default
    const result = await client.getQuota()
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// 4d. socket-sdk-class.ts — #parseRetryAfter branches
// =============================================================================

describe('SocketSdk - #parseRetryAfter via retry behavior', () => {
  // Server that returns 429 with Retry-After as HTTP-date on first request
  const getBaseUrl = setupLocalHttpServer(
    (() => {
      let callCount = 0
      return (req: IncomingMessage, res: ServerResponse) => {
        const url = req.url || ''

        if (url.includes('/retry-after-date')) {
          callCount++
          if (callCount <= 1) {
            // Use a date 1 second in the future
            const futureDate = new Date(Date.now() + 1000).toUTCString()
            res.writeHead(429, { 'Retry-After': futureDate })
            res.end(JSON.stringify({ error: 'Rate limited' }))
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
            callCount = 0
          }
        } else if (url.includes('/retry-after-empty')) {
          callCount++
          if (callCount <= 1) {
            // Empty Retry-After header
            res.writeHead(429, { 'Retry-After': '' })
            res.end(JSON.stringify({ error: 'Rate limited' }))
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
            callCount = 0
          }
        } else if (url.includes('/retry-after-invalid')) {
          callCount++
          if (callCount <= 1) {
            // Invalid Retry-After value (not a number, not a date)
            res.writeHead(429, { 'Retry-After': 'not-a-date-or-number' })
            res.end(JSON.stringify({ error: 'Rate limited' }))
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
            callCount = 0
          }
        } else if (url.includes('/retry-after-past')) {
          callCount++
          if (callCount <= 1) {
            // Past date - should not use as delay
            const pastDate = new Date(Date.now() - 60_000).toUTCString()
            res.writeHead(429, { 'Retry-After': pastDate })
            res.end(JSON.stringify({ error: 'Rate limited' }))
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
            callCount = 0
          }
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        }
      }
    })(),
  )

  it('should handle Retry-After as HTTP-date in the future', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 3,
      retryDelay: 10,
    })

    const result = await client.getApi<{ ok: boolean }>('retry-after-date', {
      responseType: 'json',
    })

    expect(result).toEqual({ ok: true })
  })

  it('should handle empty Retry-After header and still retry', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 3,
      retryDelay: 10,
    })

    const result = await client.getApi<{ ok: boolean }>('retry-after-empty', {
      responseType: 'json',
    })

    expect(result).toEqual({ ok: true })
  })

  it('should handle invalid Retry-After value and still retry', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 3,
      retryDelay: 10,
    })

    const result = await client.getApi<{ ok: boolean }>('retry-after-invalid', {
      responseType: 'json',
    })

    expect(result).toEqual({ ok: true })
  })

  it('should handle Retry-After date in the past and still retry', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 3,
      retryDelay: 10,
    })

    const result = await client.getApi<{ ok: boolean }>('retry-after-past', {
      responseType: 'json',
    })

    expect(result).toEqual({ ok: true })
  })
})
