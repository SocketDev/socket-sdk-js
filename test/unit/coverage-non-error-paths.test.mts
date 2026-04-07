/**
 * @fileoverview Tests covering non-error-path gaps across several source files.
 *
 * Targets:
 * - file-upload.ts: createUploadRequest hooks, createRequestBodyForFilepaths
 *   multi-file and relative path resolution
 * - http-client.ts lines 304, 372, 385, 395, 402, 465-510:
 *   getErrorResponseBody stream error, getResponseJson JSON error branches
 *   (non-JSON content-type, HTML response, 502/503 response body)
 * - utils.ts lines 146-151: promiseWithResolvers polyfill branch
 * - socket-sdk-class.ts non-error lines:
 *   #executeWithRetry onRetry branches (401/403, 429 with Retry-After),
 *   #getResponseText 50MB size limit,
 *   #getTtlForEndpoint / cache config (number, object with endpoint, default),
 *   #checkMalwareBatch normalize with publicPolicy,
 *   downloadOrgFullScanFilesAsTar streaming,
 *   streamFullScan data/error/end handlers,
 *   uploadManifestFiles edge case
 */

import { createServer } from 'node:http'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { MAX_FIREWALL_COMPONENTS } from '../../src/constants.js'
import {
  createRequestBodyForFilepaths,
  createUploadRequest,
} from '../../src/file-upload'
import { getResponseJson } from '../../src/http-client'
import { SocketSdk } from '../../src/index'
import { setupLocalHttpServer } from '../utils/local-server-helpers.mts'

import type { IncomingMessage, Server, ServerResponse } from 'node:http'

// =============================================================================
// 1. file-upload.ts — createUploadRequest hooks and multi-file form data
// =============================================================================

describe('file-upload createUploadRequest with hooks', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'sdk-fup-hooks-'))
    writeFileSync(path.join(tmpDir, 'a.json'), '{"a":1}')
    writeFileSync(path.join(tmpDir, 'b.json'), '{"b":2}')
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // Local server to accept multipart uploads
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      // Consume body
      req.on('data', () => {})
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ uploaded: true }))
      })
    },
  )

  it('should call onRequest and onResponse hooks during upload', async () => {
    let requestCalled = false
    let responseCalled = false

    const hooks = {
      onRequest: () => {
        requestCalled = true
      },
      onResponse: () => {
        responseCalled = true
      },
    }

    const form = createRequestBodyForFilepaths(
      [path.join(tmpDir, 'a.json')],
      tmpDir,
    )
    const response = await createUploadRequest(getBaseUrl(), '/upload', form, {
      hooks,
    })

    expect(response.status).toBe(200)
    expect(requestCalled).toBe(true)
    expect(responseCalled).toBe(true)
  })
})

// =============================================================================
// 2. http-client.ts — getResponseJson JSON error detail branches
//     (non-JSON content-type, HTML response, 502/503 body)
// =============================================================================

describe('getResponseJson enhanced error branches', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = req.url || ''

      if (url.includes('/wrong-content-type')) {
        // Return invalid JSON with non-JSON content-type
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('not json data')
      } else if (url.includes('/html-response')) {
        // Return HTML that starts with '<', with application/json content-type
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('<html><body>Error</body></html>')
      } else if (url.includes('/bad-gateway')) {
        // Return 502 Bad Gateway text in JSON content-type
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('502 Bad Gateway nginx')
      } else if (url.includes('/service-unavailable')) {
        // Return 503 Service Unavailable text in JSON content-type
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('503 Service Unavailable')
      } else if (url.includes('/long-invalid-json')) {
        // Return >200 chars of invalid JSON to test preview truncation
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('x'.repeat(300))
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}`
          resolve()
        }
      })
    })
  })

  afterAll(() => {
    server.close()
  })

  async function getFromPath(urlPath: string) {
    const { createGetRequest } = await import('../../src/http-client.js')
    return createGetRequest(baseUrl, urlPath, { timeout: 5000 })
  }

  it('should include content-type hint when response is not application/json', async () => {
    const response = await getFromPath('/wrong-content-type')
    try {
      await getResponseJson(response)
      expect.fail('Should have thrown')
    } catch (e) {
      const err = e as Error
      expect(err.message).toContain('Unexpected Content-Type')
      expect(err.message).toContain('text/html')
    }
  })

  it('should detect HTML response starting with <', async () => {
    const response = await getFromPath('/html-response')
    try {
      await getResponseJson(response)
      expect.fail('Should have thrown')
    } catch (e) {
      const err = e as Error
      expect(err.message).toContain('Response appears to be HTML')
    }
  })

  it('should detect 502 Bad Gateway in response body', async () => {
    const response = await getFromPath('/bad-gateway')
    try {
      await getResponseJson(response)
      expect.fail('Should have thrown')
    } catch (e) {
      const err = e as Error
      expect(err.message).toContain('server error')
      expect(err.message).toContain('temporarily unavailable')
    }
  })

  it('should detect 503 Service Unavailable in response body', async () => {
    const response = await getFromPath('/service-unavailable')
    try {
      await getResponseJson(response)
      expect.fail('Should have thrown')
    } catch (e) {
      const err = e as Error
      expect(err.message).toContain('server error')
    }
  })

  it('should truncate long response preview to 200 characters', async () => {
    const response = await getFromPath('/long-invalid-json')
    try {
      await getResponseJson(response)
      expect.fail('Should have thrown')
    } catch (e) {
      const err = e as Error & { originalResponse?: string }
      expect(err.message).toContain('...')
      // originalResponse should contain the full body
      expect(err.originalResponse?.length).toBe(300)
    }
  })
})

// =============================================================================
// 3. utils.ts lines 146-151 — promiseWithResolvers polyfill branch
// =============================================================================

describe('promiseWithResolvers polyfill branch', () => {
  it('should work as a polyfill when Promise.withResolvers is unavailable', async () => {
    // Temporarily remove Promise.withResolvers to force polyfill path
    const original = Promise.withResolvers
    try {
      // @ts-expect-error - Deliberately removing for polyfill test
      Promise.withResolvers = undefined

      // Re-import to get the polyfill-using version
      // Since the function checks at call time, just call it directly
      const { promiseWithResolvers } = await import('../../src/utils.js')
      const { promise, resolve } = promiseWithResolvers<number>()
      resolve(42)
      const result = await promise
      expect(result).toBe(42)
    } finally {
      Promise.withResolvers = original
    }
  })

  it('polyfill reject path should also work', async () => {
    const original = Promise.withResolvers
    try {
      // @ts-expect-error - Deliberately removing for polyfill test
      Promise.withResolvers = undefined

      const { promiseWithResolvers } = await import('../../src/utils.js')
      const { promise, reject } = promiseWithResolvers<string>()
      reject(new Error('test rejection'))
      await expect(promise).rejects.toThrow('test rejection')
    } finally {
      Promise.withResolvers = original
    }
  })
})

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

// =============================================================================
// 4e. socket-sdk-class.ts — #checkMalwareBatch normalize with publicPolicy
//     Specifically: alerts with/without fix, ignore actions filtered
// =============================================================================

describe('SocketSdk - checkMalware batch normalize with publicPolicy', () => {
  const artifact = {
    alerts: [
      {
        category: 'supplyChainRisk',
        fix: { description: 'Remove package', type: 'remove' },
        key: 'mal-1',
        props: { note: 'data exfil' },
        severity: 'critical',
        type: 'malware',
      },
      {
        // Alert without fix property — criticalCVE is 'warn' in publicPolicy
        category: 'quality',
        key: 'cve-1',
        props: {},
        severity: 'high',
        type: 'criticalCVE',
      },
      {
        // deprecated is 'ignore' in publicPolicy — should be filtered out
        category: 'misc',
        key: 'dep-1',
        props: {},
        severity: 'low',
        type: 'deprecated',
      },
    ],
    name: 'evil-pkg',
    namespace: undefined,
    score: {
      license: 0.9,
      maintenance: 0.8,
      overall: 0.1,
      quality: 0.7,
      supplyChain: 0.0,
      vulnerability: 0.0,
    },
    type: 'npm',
    version: '1.0.0',
  }

  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      // Batch purl path — exercises #normalizeArtifact with publicPolicy.
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        if (url.includes('/purl') && req.method === 'POST') {
          const parsed = JSON.parse(body)
          const count = parsed.components?.length ?? 0
          const lines = Array.from({ length: count }, () =>
            JSON.stringify(artifact),
          ).join('\n')
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
          res.end(`${lines}\n`)
        } else {
          res.writeHead(404)
          res.end()
        }
      })
    },
  )

  it('should normalize artifact with fix and without fix, filtering ignore actions', async () => {
    const count = MAX_FIREWALL_COMPONENTS + 1
    const client = new SocketSdk('test-api-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const components = Array.from({ length: count }, (_, i) => ({
      purl: `pkg:npm/evil-pkg@${i + 1}.0.0`,
    }))
    const result = await client.checkMalware(components)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toHaveLength(count)
    const pkg = result.data[0]!

    // Two alerts should remain (error + warn via publicPolicy), deprecated is filtered
    expect(pkg.alerts).toHaveLength(2)

    // First alert has fix
    expect(pkg.alerts[0]!.fix).toEqual({
      description: 'Remove package',
      type: 'remove',
    })
    expect(pkg.alerts[0]!.category).toBe('supplyChainRisk')

    // Second alert has no fix
    expect(pkg.alerts[1]!.fix).toBeUndefined()
    expect(pkg.alerts[1]!.type).toBe('criticalCVE')

    // Package metadata
    expect(pkg.name).toBe('evil-pkg')
    expect(pkg.score?.overall).toBe(0.1)
  })
})

// =============================================================================
// 4f. socket-sdk-class.ts — downloadOrgFullScanFilesAsTar streaming (1929-1949)
//     (bytesWritten tracking in data handler)
// =============================================================================

describe('SocketSdk - downloadOrgFullScanFilesAsTar streaming byte tracking', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/files.tar')) {
        res.writeHead(200, { 'Content-Type': 'application/x-tar' })
        // Send multiple chunks to exercise the data handler
        res.write(Buffer.from('chunk1'))
        res.write(Buffer.from('chunk2'))
        res.write(Buffer.from('chunk3'))
        res.end()
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  let tmpDir: string

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'sdk-tar-bytes-'))
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should track bytes through multiple data chunks', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const outputPath = path.join(tmpDir, 'multi-chunk.tar')
    const result = await client.downloadOrgFullScanFilesAsTar(
      'test-org',
      'scan-1',
      outputPath,
    )

    expect(result.success).toBe(true)
  })
})

// =============================================================================
// 4g. socket-sdk-class.ts — streamFullScan data/end handlers (3928-3967)
//     (file output with multiple data chunks, stdout output with end cleanup)
// =============================================================================

describe('SocketSdk - streamFullScan data handlers', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/full-scans/')) {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        // Send multiple chunks to exercise the data size tracking handler
        const line1 = JSON.stringify({ name: 'lodash', version: '4.17.21' })
        const line2 = JSON.stringify({ name: 'express', version: '4.19.2' })
        res.write(`${line1}\n`)
        res.write(`${line2}\n`)
        res.end()
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  let tmpDir: string

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'sdk-stream-data-'))
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should track byte count through data handler for file output', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const outputPath = path.join(tmpDir, 'stream-track.json')
    const result = await client.streamFullScan('test-org', 'scan-data-1', {
      output: outputPath,
    })

    expect(result.success).toBe(true)
  })

  it('should handle stdout output', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    // Capture stdout writes
    const originalWrite = process.stdout.write
    const chunks: string[] = []
    process.stdout.write = (chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    }

    try {
      const result = await client.streamFullScan('test-org', 'scan-data-2', {
        output: true,
      })

      expect(result.success).toBe(true)
      expect(chunks.length).toBeGreaterThan(0)
    } finally {
      process.stdout.write = originalWrite
    }
  })

  it('should return response without streaming when output is false', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.streamFullScan('test-org', 'scan-data-3', {
      output: false,
    })

    expect(result.success).toBe(true)
  })
})

// =============================================================================
// 4h. socket-sdk-class.ts — uploadManifestFiles edge case (4497-4498)
//     Test the warning display when >3 files are invalid without callback,
//     and the "all files invalid" detailed error with >5 files.
// =============================================================================

describe('SocketSdk - uploadManifestFiles edge cases', () => {
  it('should show detailed error with >5 invalid files and truncation', async () => {
    const client = new SocketSdk('test-token', { retries: 0 })

    // Pass 7 invalid files to trigger the >5 truncation in "all files invalid" error
    const result = await client.uploadManifestFiles('test-org', [
      '/nonexistent/a.json',
      '/nonexistent/b.json',
      '/nonexistent/c.json',
      '/nonexistent/d.json',
      '/nonexistent/e.json',
      '/nonexistent/f.json',
      '/nonexistent/g.json',
    ])

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('No readable manifest files found')
    // The cause should contain truncation for >5 files
    const cause = (result as { cause?: string }).cause ?? ''
    expect(cause).toContain('... and 2 more')
    expect(cause).toContain('Yarn Berry')
  })

  it('should include errorCause from validation callback when provided', async () => {
    const onFileValidation = vi.fn().mockResolvedValue({
      errorCause: 'Custom detailed cause',
      errorMessage: 'Custom validation error',
      shouldContinue: false,
    })

    const client = new SocketSdk('test-token', {
      onFileValidation,
      retries: 0,
    })

    const result = await client.uploadManifestFiles('test-org', [
      '/nonexistent/pkg.json',
    ])

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('Custom validation error')
    // When errorCause is not redundant with errorMessage, it should be included
    const typedResult = result as { cause?: string }
    expect(typedResult.cause).toBe('Custom detailed cause')
  })

  it('should omit redundant errorCause from validation callback', async () => {
    const onFileValidation = vi.fn().mockResolvedValue({
      // This cause is very similar to the error message
      errorCause: 'Custom validation error message',
      errorMessage: 'Custom validation error',
      shouldContinue: false,
    })

    const client = new SocketSdk('test-token', {
      onFileValidation,
      retries: 0,
    })

    const result = await client.uploadManifestFiles('test-org', [
      '/nonexistent/pkg.json',
    ])

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('Custom validation error')
    // Redundant cause should be filtered out by filterRedundantCause
    const typedResult = result as { cause?: string }
    expect(typedResult.cause).toBeUndefined()
  })
})
