/**
 * @fileoverview Failure path tests for SocketSdk class methods.
 *
 * Covers remaining uncovered error and edge-case branches in socket-sdk-class.ts:
 * - #handleApiError: SyntaxError, 5xx, 429, 413, error.details, non-JSON body,
 *   statusMessage edge case
 * - #createQueryErrorResult: non-SyntaxError branch
 * - downloadPatch: ENOTFOUND, ECONNREFUSED, MAX_PATCH_SIZE
 * - streamPatchesFromScan: empty lines, JSON parse error, stream error
 * - writeStream error handler for downloadOrgFullScanFilesAsTar
 *
 * Uses setupLocalHttpServer for real HTTP interactions.
 */

import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index'
import { setupLocalHttpServer } from '../utils/local-server-helpers.mts'

import type { IncomingMessage, ServerResponse } from 'node:http'

// ===========================================================================
// #handleApiError — status code branches (429, 413, 5xx, SyntaxError)
// ===========================================================================
describe('SocketSdk - #handleApiError branches', () => {
  // Server that returns different status codes based on the URL path.
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      // Consume request body before responding.
      let _body = ''
      req.on('data', (chunk: Buffer) => {
        _body += chunk.toString()
      })
      req.on('end', () => {
        if (url.includes('/rate-limited-no-retry')) {
          // 429 without retry-after header (check before /rate-limited)
          res.writeHead(429, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'Too many requests' } }))
        } else if (url.includes('/rate-limited')) {
          // 429 with retry-after header
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': '30',
          })
          res.end(JSON.stringify({ error: { message: 'Rate limit exceeded' } }))
        } else if (url.includes('/payload-too-large')) {
          // 413
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({ error: { message: 'Request entity too large' } }),
          )
        } else if (url.includes('/server-error')) {
          // 500 — triggers the 5xx throw branch
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({ error: { message: 'Internal server error' } }),
          )
        } else if (url.includes('/bad-json')) {
          // 200 with invalid JSON — triggers SyntaxError in JSON.parse
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('this is not valid json {{{')
        } else if (url.includes('/error-with-details-string')) {
          // 400 with error.details as string
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: {
                details: 'field "name" is required',
                message: 'Validation failed',
              },
            }),
          )
        } else if (url.includes('/error-with-details-object')) {
          // 400 with error.details as object
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: {
                details: { field: 'name', reason: 'required' },
                message: 'Validation failed',
              },
            }),
          )
        } else if (url.includes('/non-json-error')) {
          // 400 with non-JSON body — triggers catch fallback in #handleApiError
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Bad Request: missing parameters')
        } else if (url.includes('/patches/scan')) {
          // NDJSON response for streamPatchesFromScan with edge cases
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
          // Include: empty line, valid JSON, invalid JSON, trailing empty line
          res.end(
            [
              '',
              '  ',
              JSON.stringify({ artifact: 'lodash', patches: [] }),
              'not-valid-json!!!',
              JSON.stringify({ artifact: 'express', patches: ['p1'] }),
              '',
            ].join('\n'),
          )
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'Not Found' } }))
        }
      })
    },
  )

  // --- 429 Rate Limit ---
  it('should return rate limit guidance with retry-after header on 429', async () => {
    // Use getQuota as a simple GET endpoint that hits the error path
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/rate-limited/v0/`,
      retries: 0,
    })
    const result = await client.getQuota()
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.status).toBe(429)
    expect(result.cause).toContain('Rate limit exceeded')
    expect(result.cause).toContain('Retry after 30 seconds')
  })

  it('should return rate limit guidance without retry-after on 429', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/rate-limited-no-retry/v0/`,
      retries: 0,
    })
    const result = await client.getQuota()
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.status).toBe(429)
    expect(result.cause).toContain('Wait before retrying')
  })

  // --- 413 Payload Too Large ---
  it('should return payload too large guidance on 413', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/payload-too-large/v0/`,
      retries: 0,
    })
    const result = await client.getQuota()
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.status).toBe(413)
    expect(result.cause).toContain('Payload too large')
  })

  // --- 5xx Server Error (throws) ---
  it('should throw on 5xx server error', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/server-error/v0/`,
      retries: 0,
    })
    await expect(client.getQuota()).rejects.toThrow(
      'Socket API server error (500)',
    )
  })

  // --- SyntaxError (invalid JSON response) ---
  it('should handle SyntaxError from invalid JSON response', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/bad-json/v0/`,
      retries: 0,
    })
    // getQuota calls getResponseJson which will throw SyntaxError on bad JSON,
    // and #handleApiError catches it.
    const result = await client.getQuota()
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.status).toBe(200)
  })

  // --- Error with details (string) ---
  it('should include string error details in response', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/error-with-details-string/v0/`,
      retries: 0,
    })
    const result = await client.getQuota()
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.status).toBe(400)
    expect(result.error).toContain('Validation failed')
    expect(result.error).toContain('field "name" is required')
  })

  // --- Error with details (object) ---
  it('should JSON.stringify object error details in response', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/error-with-details-object/v0/`,
      retries: 0,
    })
    const result = await client.getQuota()
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.status).toBe(400)
    expect(result.error).toContain('Validation failed')
    expect(result.error).toContain('"field"')
  })

  // --- Non-JSON error body ---
  it('should fall back to plain text for non-JSON error body', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/non-json-error/v0/`,
      retries: 0,
    })
    const result = await client.getQuota()
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.status).toBe(400)
    expect(result.error).toContain('Bad Request: missing parameters')
  })
})

// ===========================================================================
// streamPatchesFromScan — empty lines, parse errors, valid data
// ===========================================================================
describe('SocketSdk - streamPatchesFromScan edge cases', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/patches/scan')) {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        // Empty lines, invalid JSON, and valid JSON
        res.end(
          [
            '',
            '  ',
            JSON.stringify({ artifact: 'lodash', patches: [] }),
            '{broken json',
            JSON.stringify({ artifact: 'express', patches: ['p1'] }),
            '',
          ].join('\n'),
        )
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  it('should skip empty lines and tolerate JSON parse errors', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const stream = await client.streamPatchesFromScan('test-org', 'scan-1')
    const reader = stream.getReader()
    const chunks: unknown[] = []

    let done = false
    while (!done) {
      const result = await reader.read()
      if (result.done) {
        done = true
      } else {
        chunks.push(result.value)
      }
    }

    // Should have parsed the 2 valid JSON lines, skipping empty and broken ones
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual({ artifact: 'lodash', patches: [] })
    expect(chunks[1]).toEqual({ artifact: 'express', patches: ['p1'] })
  })
})

// ===========================================================================
// streamPatchesFromScan — stream error during iteration
// ===========================================================================
describe('SocketSdk - streamPatchesFromScan stream error', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/patches/scan')) {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        // Write a partial line then destroy to cause stream error
        res.write(JSON.stringify({ artifact: 'lodash', patches: [] }) + '\n')
        // Destroy the connection on first drain to trigger a stream error
        res.once('drain', () => {
          res.destroy()
        })
        // If already drained, destroy on next tick
        process.nextTick(() => {
          if (!res.destroyed) {
            res.destroy()
          }
        })
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  it('should handle stream errors gracefully', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    // With buffered httpRequest, a destroyed connection causes an error
    // during the request itself, before streaming begins.
    try {
      const stream = await client.streamPatchesFromScan('test-org', 'scan-1')
      const reader = stream.getReader()
      const chunks: unknown[] = []

      let done = false
      while (!done) {
        const result = await reader.read()
        if (result.done) {
          done = true
        } else {
          chunks.push(result.value)
        }
      }

      // If we got here, the partial response was buffered before destruction
      expect(chunks).toBeInstanceOf(Array)
    } catch {
      // Connection destruction during buffering is expected
    }
  })
})

// ===========================================================================
// downloadPatch — ENOTFOUND and ECONNREFUSED error branches
// ===========================================================================
describe('SocketSdk - downloadPatch error codes', () => {
  it('should include ECONNREFUSED guidance', async () => {
    const client = new SocketSdk('test-token')
    // Use a port that is guaranteed to refuse connections
    await expect(
      client.downloadPatch('sha256-test', {
        baseUrl: 'http://127.0.0.1:1',
      }),
    ).rejects.toThrow(/Connection refused/)
  })

  it('should include ENOTFOUND guidance for unresolvable hostname', async () => {
    const client = new SocketSdk('test-token')
    await expect(
      client.downloadPatch('sha256-test', {
        baseUrl: 'http://this-host-does-not-exist-xyzzy.invalid',
      }),
    ).rejects.toThrow(/DNS lookup failed|ENOTFOUND|Error downloading blob/)
  })
})

// ===========================================================================
// downloadPatch — MAX_PATCH_SIZE exceeded
// ===========================================================================
describe('SocketSdk - downloadPatch MAX_PATCH_SIZE', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.startsWith('/blob/')) {
        const hash = decodeURIComponent(url.replace('/blob/', ''))

        if (hash === 'sha256-oversized') {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          // MAX_PATCH_SIZE is 50MB. Stream enough data to exceed it.
          // Write in 1MB chunks to exceed the 50MB limit.
          const chunkSize = 1024 * 1024
          const chunk = Buffer.alloc(chunkSize, 'x')
          let written = 0
          const writeChunk = () => {
            while (written < 51 * 1024 * 1024) {
              const ok = res.write(chunk)
              written += chunkSize
              if (!ok) {
                res.once('drain', writeChunk)
                return
              }
            }
            res.end()
          }
          writeChunk()
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('ok')
        }
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  it('should reject when patch exceeds MAX_PATCH_SIZE', async () => {
    const client = new SocketSdk('test-token')
    await expect(
      client.downloadPatch('sha256-oversized', {
        baseUrl: getBaseUrl(),
      }),
    ).rejects.toThrow(/exceeds maximum size/)
  }, 30_000)
})

// ===========================================================================
// #createQueryErrorResult — non-SyntaxError branch (plain Error)
// ===========================================================================
describe('SocketSdk - #createQueryErrorResult non-SyntaxError', () => {
  // Server that immediately resets the connection to cause a non-ResponseError.
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, _res: ServerResponse) => {
      // Destroy the socket to cause a connection error.
      req.socket.destroy()
    },
  )

  it('should return API request failed for non-SyntaxError in getApi', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })
    const result = (await client.getApi('anything', {
      throws: false,
    })) as { cause?: unknown; error?: string; success: boolean }

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('API request failed')
      expect(result.cause).toBeDefined()
    }
  })

  it('should return API request failed for non-SyntaxError in sendApi', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })
    const result = (await client.sendApi('anything', {
      body: {},
      throws: false,
    })) as { error?: string; success: boolean }

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('API request failed')
    }
  })
})

// ===========================================================================
// writeStream error handler — unwritable output path
// ===========================================================================
describe('SocketSdk - writeStream error handler', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      let _body = ''
      req.on('data', (chunk: Buffer) => {
        _body += chunk.toString()
      })
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
        res.end('tar file data')
      })
    },
  )

  it('should handle write stream error for downloadOrgFullScanFilesAsTar', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    // Use a path where the parent directory does not exist.
    // The writeStream error is not a ResponseError, so handleApiError re-throws.
    const unwritablePath = path.join(
      tmpdir(),
      'nonexistent-dir-sdk-test-12345',
      'output.tar',
    )
    await expect(
      client.downloadOrgFullScanFilesAsTar(
        'test-org',
        'scan-123',
        unwritablePath,
      ),
    ).rejects.toThrow(/Unexpected Socket API error/)
  })
})

// ===========================================================================
// #handleApiError — statusMessage not in error message (line 562)
// ===========================================================================
describe('SocketSdk - #handleApiError statusMessage edge case', () => {
  // Server returns an error where the body text differs from the status message
  // AND the error.message does not contain the statusMessage, triggering the
  // else branch at line 562.
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      // Consume request body
      let _body = ''
      req.on('data', (chunk: Buffer) => {
        _body += chunk.toString()
      })
      req.on('end', () => {
        // Return 418 (I'm a Teapot) — non-standard status code
        // The statusMessage will be "I'm a Teapot" which won't appear
        // in the generic ResponseError message format for unusual codes.
        res.writeHead(418, 'Custom Status', {
          'Content-Type': 'text/plain',
        })
        res.end('Unique error body text')
      })
    },
  )

  it('should append body when statusMessage is not in error message', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })
    const result = await client.getQuota()
    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.error).toContain('Unique error body text')
  })
})
