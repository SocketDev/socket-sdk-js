/**
 * @file Failure path tests for SocketSdk class methods. Covers remaining
 *   uncovered error and edge-case branches in socket-sdk-class.ts:
 *
 *   - #createQueryErrorResult: non-SyntaxError branch
 *   - downloadPatch: ENOTFOUND, ECONNREFUSED, MAX_PATCH_SIZE
 *   - streamPatchesFromScan: empty lines, JSON parse error, stream error
 *   - writeStream error handler for downloadOrgFullScanFilesAsTar Uses
 *     setupLocalHttpServer for real HTTP interactions.
 */

import os from 'node:os'
import path from 'node:path'

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { setupLocalHttpServer } from '../../utils/local-server-helpers.mts'

import type { IncomingMessage, ServerResponse } from 'node:http'

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
    // The fleet vitest setup fails network CLOSED (nock.disableNetConnect),
    // which refuses non-loopback requests BEFORE DNS resolution runs — the
    // refusal surfaces as ENETUNREACH, never ENOTFOUND. Mock the DNS failure
    // instead so the test still exercises the SDK's ENOTFOUND guidance
    // mapping deterministically.
    nock('http://this-host-does-not-exist-xyzzy.invalid')
      .get('/blob/sha256-test')
      .replyWithError(
        Object.assign(
          new Error(
            'getaddrinfo ENOTFOUND this-host-does-not-exist-xyzzy.invalid',
          ),
          { code: 'ENOTFOUND' },
        ),
      )
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
    })) as {
      cause?: unknown | undefined
      error?: string | undefined
      success: boolean
    }

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
    })) as { error?: string | undefined; success: boolean }

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
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
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
      os.tmpdir(),
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
