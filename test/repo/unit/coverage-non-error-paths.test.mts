/**
 * @file Tests covering non-error-path gaps across file-upload, http-client, and
 *   utils source files. Targets:
 *
 *   - file-upload.ts: createUploadRequest hooks, createRequestBodyForFilepaths
 *     multi-file and relative path resolution
 *   - http-client.ts: getResponseJson JSON error branches (non-JSON content-type,
 *     HTML response, 502/503 response body)
 *   - utils.ts lines 146-151: promiseWithResolvers polyfill branch
 */

import { createServer } from 'node:http'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createRequestBodyForFilepaths,
  createUploadRequest,
} from '../../../src/file-upload.mts'
import { createGetRequest, getResponseJson } from '../../../src/http-client.mts'
import { promiseWithResolvers } from '../../../src/utils.mts'
import { setupLocalHttpServer } from '../../utils/local-server-helpers.mts'

import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'

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

  afterAll(async () => {
    await safeDelete(tmpDir)
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
      const err = e as Error & { originalResponse?: string | undefined }
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

      // promiseWithResolvers checks Promise.withResolvers at call time,
      // so the statically-imported function exercises the polyfill branch
      // once we null out the global above.
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

      const { promise, reject } = promiseWithResolvers<string>()
      reject(new Error('test rejection'))
      await expect(promise).rejects.toThrow('test rejection')
    } finally {
      Promise.withResolvers = original
    }
  })
})
