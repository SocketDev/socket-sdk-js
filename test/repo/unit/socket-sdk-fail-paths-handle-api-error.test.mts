/**
 * @file Failure path tests for SocketSdk class methods. Covers remaining
 *   uncovered error and edge-case branches in socket-sdk-class.ts:
 *
 *   - #handleApiError: SyntaxError, 5xx, 429, 413, error.details, non-JSON body,
 *     statusMessage edge case Uses setupLocalHttpServer for real HTTP
 *     interactions.
 */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { setupLocalHttpServer } from '../../utils/local-server-helpers.mts'

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
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
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
// #handleApiError — statusMessage not in error message (line 562)
// ===========================================================================
describe('SocketSdk - #handleApiError statusMessage edge case', () => {
  // Server returns an error where the body text differs from the status message
  // AND the error.message does not contain the statusMessage, triggering the
  // else branch at line 562.
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      // Consume request body
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
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
