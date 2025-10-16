/**
 * @fileoverview Tests for Socket SDK error handling using local HTTP server.
 *
 * Tests various error scenarios including 5xx errors, 401/403 auth errors,
 * and error response body parsing.
 */
import { createServer } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { SocketSdkGenericResult } from '../src/types'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

describe('SocketSdk - Error Handling', () => {
  let server: Server
  let baseUrl: string
  let client: SocketSdk

  beforeAll(async () => {
    // Start local HTTP server on random port
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      // Route to different error scenarios
      if (url.includes('/500-error')) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal Server Error' }))
      } else if (url.includes('/503-error')) {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Service Unavailable' }))
      } else if (url.includes('/401-error')) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
      } else if (url.includes('/403-error')) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Forbidden' }))
      } else if (url.includes('/404-with-details')) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            error: {
              message: 'Resource not found',
              details: { resource: 'package', id: 'nonexistent' },
            },
          }),
        )
      } else if (url.includes('/404-with-string-details')) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            error: {
              message: 'Not found',
              details: 'Package does not exist in registry',
            },
          }),
        )
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ data: {} }))
      }
    })

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          const { port } = address
          baseUrl = `http://127.0.0.1:${port}`
          resolve()
        }
      })
    })

    // Create client pointing to local server with retries disabled for faster tests
    client = new SocketSdk('test-token', { baseUrl, retries: 0 })
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  })

  describe('5xx Server Errors', () => {
    it('should handle 500 Internal Server Error with throws=false', async () => {
      // In non-throwing mode, #handleApiError throws for 5xx but catch block wraps it
      const result = (await client.getApi('/500-error', {
        throws: false,
      })) as SocketSdkGenericResult<IncomingMessage>
      expect(result.success).toBe(false)
      if (!result.success) {
        // The error is thrown in #handleApiError and caught, appearing in cause
        expect(result.cause).toContain('Socket API server error (500)')
      }
    })

    it('should handle 503 Service Unavailable with throws=false', async () => {
      const result = (await client.getApi('/503-error', {
        throws: false,
      })) as SocketSdkGenericResult<IncomingMessage>
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.cause).toContain('Socket API server error (503)')
      }
    })

    it('should throw ResponseError for 500 in throwing mode', async () => {
      await expect(client.getApi('/500-error')).rejects.toThrow(
        'Request failed (500)',
      )
    })
  })

  describe('4xx Client Errors', () => {
    it('should handle 401 Unauthorized errors', async () => {
      const result = (await client.getApi('/401-error', {
        throws: false,
      })) as SocketSdkGenericResult<IncomingMessage>
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(401)
        expect(result.error).toContain('Unauthorized')
      }
    })

    it('should handle 403 Forbidden errors', async () => {
      const result = (await client.getApi('/403-error', {
        throws: false,
      })) as SocketSdkGenericResult<IncomingMessage>
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(403)
        expect(result.error).toContain('Forbidden')
      }
    })
  })

  describe('Error Response Body Parsing', () => {
    it('should parse error responses with detailed object', async () => {
      const result = (await client.getApi('/404-with-details', {
        throws: false,
      })) as SocketSdkGenericResult<IncomingMessage>
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.error).toContain('Resource not found')
        expect(result.cause).toContain('Details:')
        expect(result.cause).toContain('package')
      }
    })

    it('should parse error responses with string details', async () => {
      const result = (await client.getApi('/404-with-string-details', {
        throws: false,
      })) as SocketSdkGenericResult<IncomingMessage>
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.error).toContain('Not found')
        expect(result.cause).toContain('Package does not exist')
      }
    })
  })

  describe('Auth Error Retry Behavior', () => {
    it('should not retry 401 errors', async () => {
      const clientWithRetries = new SocketSdk('test-token', {
        baseUrl,
        retries: 3,
      })

      const startTime = Date.now()
      const result = (await clientWithRetries.getApi('/401-error', {
        throws: false,
      })) as SocketSdkGenericResult<IncomingMessage>
      const duration = Date.now() - startTime

      expect(result.success).toBe(false)
      // Should fail fast without retrying (duration < 100ms indicates no retries)
      expect(duration).toBeLessThan(100)
    })

    it('should not retry 403 errors', async () => {
      const clientWithRetries = new SocketSdk('test-token', {
        baseUrl,
        retries: 3,
      })

      const startTime = Date.now()
      const result = (await clientWithRetries.getApi('/403-error', {
        throws: false,
      })) as SocketSdkGenericResult<IncomingMessage>
      const duration = Date.now() - startTime

      expect(result.success).toBe(false)
      // Should fail fast without retrying
      expect(duration).toBeLessThan(100)
    })
  })

  describe('onRetry Callback Coverage', () => {
    it('should trigger onRetry callback on retryable errors', async () => {
      let serverCallCount = 0

      // Create a temporary server that fails twice then succeeds
      const retryServer = createServer((_req, res) => {
        serverCallCount++
        if (serverCallCount <= 2) {
          // Return 429 (rate limit) which is retryable
          res.writeHead(429, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Rate limited' }))
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ data: { issues: [] } }))
        }
      })

      await new Promise<void>(resolve => {
        retryServer.listen(0, () => resolve())
      })

      const address = retryServer.address()
      const port = typeof address === 'object' ? address?.port : 0
      const retryBaseUrl = `http://127.0.0.1:${port}`

      // Create client with retries enabled and short delay
      // Very short delay for fast test
      const clientWithRetries = new SocketSdk('test-token', {
        baseUrl: retryBaseUrl,
        retries: 3,
        retryDelay: 10,
      })

      try {
        // Use a method that actually uses #executeWithRetry
        const result = await clientWithRetries.getIssuesByNpmPackage(
          'lodash',
          '4.17.21',
        )

        // Should eventually succeed after retries
        expect(result.success).toBe(true)
        // Server should have been called 3 times (2 failures + 1 success)
        expect(serverCallCount).toBe(3)
      } finally {
        await new Promise<void>((resolve, reject) => {
          retryServer.close(err => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        })
      }
    })
  })
})
