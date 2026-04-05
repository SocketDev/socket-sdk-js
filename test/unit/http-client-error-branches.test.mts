/**
 * @fileoverview Tests for uncovered error branches in the HTTP client.
 * Covers the request timeout handler and specific error code paths in getResponse.
 */

import http from 'node:http'
import { createServer } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createGetRequest, getResponse } from '../../src/http-client.js'

import type { Server } from 'node:http'

/**
 * Helper to catch a promise rejection and return the error.
 * Throws if the promise resolves instead of rejecting.
 */
async function catchError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
    throw new Error('Expected promise to reject, but it resolved')
  } catch (error) {
    return error as Error
  }
}

// =============================================================================
// Timeout Handler Tests (req.on('timeout'))
// =============================================================================

describe('getResponse - timeout handler', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    // Create a server that never responds on /hang
    server = createServer((_req, _res) => {
      // Intentionally never respond — forces client-side timeout.
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

  it('should reject with descriptive message when request times out', async () => {
    const caught = await catchError(
      createGetRequest(baseUrl, '/hang', { timeout: 50 }),
    )

    expect(caught).toBeInstanceOf(Error)
    expect(caught.message).toContain('timed out')
    expect(caught.message).toContain('/hang')
    expect(caught.message).toContain('did not respond')
  })
})

// =============================================================================
// Error Code Branch Tests (req.on('error') with specific codes)
// =============================================================================

describe('getResponse - error code branches', () => {
  it('should provide DNS guidance for ENOTFOUND errors', async () => {
    const req = http.request('http://thishostdoesnotexist.invalid/path')
    const errorPromise = getResponse(req)

    const err = new Error('getaddrinfo ENOTFOUND') as NodeJS.ErrnoException
    err.code = 'ENOTFOUND'
    // Destroy before emitting to prevent real DNS lookup / TCP connection.
    req.destroy()
    req.emit('error', err)

    const caught = await catchError(errorPromise)
    expect(caught.message).toContain('DNS lookup failed')
    expect(caught.message).toContain('Cannot resolve hostname')
  })

  it('should provide connection timeout guidance for ETIMEDOUT errors', async () => {
    const req = http.request('http://localhost:1/test')
    const errorPromise = getResponse(req)

    const err = new Error('connect ETIMEDOUT') as NodeJS.ErrnoException
    err.code = 'ETIMEDOUT'
    req.destroy()
    req.emit('error', err)

    const caught = await catchError(errorPromise)
    expect(caught.message).toContain('Connection timed out')
    expect(caught.message).toContain('proxy')
  })

  it('should provide connection reset guidance for ECONNRESET errors', async () => {
    const req = http.request('http://localhost:1/test')
    const errorPromise = getResponse(req)

    const err = new Error('read ECONNRESET') as NodeJS.ErrnoException
    err.code = 'ECONNRESET'
    req.destroy()
    req.emit('error', err)

    const caught = await catchError(errorPromise)
    expect(caught.message).toContain('Connection reset by server')
    expect(caught.message).toContain('Retry the request')
  })

  it('should provide broken pipe guidance for EPIPE errors', async () => {
    const req = http.request('http://localhost:1/test')
    const errorPromise = getResponse(req)

    const err = new Error('write EPIPE') as NodeJS.ErrnoException
    err.code = 'EPIPE'
    req.destroy()
    req.emit('error', err)

    const caught = await catchError(errorPromise)
    expect(caught.message).toContain('Broken pipe')
    expect(caught.message).toContain('API token is valid')
  })

  it('should provide SSL guidance for CERT_HAS_EXPIRED errors', async () => {
    const req = http.request('http://localhost:1/test')
    const errorPromise = getResponse(req)

    const err = new Error('CERT_HAS_EXPIRED') as NodeJS.ErrnoException
    err.code = 'CERT_HAS_EXPIRED'
    req.destroy()
    req.emit('error', err)

    const caught = await catchError(errorPromise)
    expect(caught.message).toContain('SSL/TLS certificate error')
    expect(caught.message).toContain('Update CA certificates')
  })

  it('should provide SSL guidance for UNABLE_TO_VERIFY_LEAF_SIGNATURE errors', async () => {
    const req = http.request('http://localhost:1/test')
    const errorPromise = getResponse(req)

    const err = new Error(
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    ) as NodeJS.ErrnoException
    err.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
    req.destroy()
    req.emit('error', err)

    const caught = await catchError(errorPromise)
    expect(caught.message).toContain('SSL/TLS certificate error')
    expect(caught.message).toContain('System time and date are correct')
  })

  it('should include generic error code for unrecognized codes', async () => {
    const req = http.request('http://localhost:1/test')
    const errorPromise = getResponse(req)

    const err = new Error('some unusual error') as NodeJS.ErrnoException
    err.code = 'ESOMETHINGWEIRD'
    req.destroy()
    req.emit('error', err)

    const caught = await catchError(errorPromise)
    expect(caught.message).toContain('Error code: ESOMETHINGWEIRD')
  })

  it('should preserve original error as cause', async () => {
    const req = http.request('http://localhost:1/test')
    const errorPromise = getResponse(req)

    const err = new Error('original error') as NodeJS.ErrnoException
    err.code = 'ECONNRESET'
    req.destroy()
    req.emit('error', err)

    const caught = await catchError(errorPromise)
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error & { cause: Error }).cause).toBe(err)
  })
})
