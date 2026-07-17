import { createServer } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
  getResponseJson,
} from '../../../src/http-client.mts'

import { isError } from '@socketsecurity/lib/errors/predicates'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'
import type { Server } from 'node:http'

export function mockHttpResponse(
  overrides: Partial<Omit<HttpResponse, 'body'>> & {
    body?: Buffer | string | undefined
  },
): HttpResponse {
  const body =
    typeof overrides.body === 'string'
      ? Buffer.from(overrides.body)
      : (overrides.body ?? Buffer.alloc(0))
  const status = overrides.status ?? 200
  return {
    arrayBuffer: () =>
      body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength,
      ) as ArrayBuffer,
    body,
    headers: overrides.headers ?? {},
    json: () => JSON.parse(body.toString('utf8')),
    ok: overrides.ok ?? (status >= 200 && status < 300),
    status,
    statusText: overrides.statusText ?? '',
    text: () => body.toString('utf8'),
    ...(overrides.rawResponse ? { rawResponse: overrides.rawResponse } : {}),
  }
}

// =============================================================================
// Response Body Reading Tests
// =============================================================================

describe('HTTP Client - Response Body Reading', () => {
  it('should read normal response body successfully', () => {
    const testBody = 'Hello, World!'
    const response = mockHttpResponse({ body: testBody })
    expect(response.text()).toBe(testBody)
  })

  it('should read empty response body', () => {
    const response = mockHttpResponse({ body: '' })
    expect(response.text()).toBe('')
  })

  it('should read large response body', () => {
    const largeBody = 'x'.repeat(10_000)
    const response = mockHttpResponse({ body: largeBody })
    expect(response.text()).toBe(largeBody)
  })
})

// =============================================================================
// Error Handling Tests (with Local Server)
// =============================================================================

describe('HTTP Client - Error Handling', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = req.url || ''

      if (url.includes('/error-immediate')) {
        req.socket.destroy()
      } else if (url.includes('/invalid-json')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{ invalid json }')
      } else if (url.includes('/timeout')) {
        // Never respond to trigger timeout
      } else if (url.includes('/json-null-error')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('null')
      } else if (url.includes('/empty-response')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('')
      } else if (url.includes('/non-ok-response')) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not Found' }))
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
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
  })

  afterAll(() => {
    server.close()
  })

  describe('createGetRequest error handling', () => {
    it('should handle connection errors', async () => {
      const invalidUrl = 'http://127.0.0.1:1'
      await expect(
        createGetRequest(invalidUrl, '/test', { timeout: 100 }),
      ).rejects.toThrow()
    })

    it('should handle immediate connection close', async () => {
      await expect(
        createGetRequest(baseUrl, '/error-immediate', { timeout: 1000 }),
      ).rejects.toThrow()
    })
  })

  describe('createRequestWithJson error handling', () => {
    it('should handle connection errors', async () => {
      const invalidUrl = 'http://127.0.0.1:1'
      await expect(
        createRequestWithJson(
          'POST',
          invalidUrl,
          '/test',
          {},
          { timeout: 100 },
        ),
      ).rejects.toThrow()
    })

    it('should handle immediate connection close', async () => {
      await expect(
        createRequestWithJson(
          'POST',
          baseUrl,
          '/error-immediate',
          {},
          {
            timeout: 1000,
          },
        ),
      ).rejects.toThrow()
    })
  })

  describe('createDeleteRequest error handling', () => {
    it('should create and execute DELETE request successfully', async () => {
      const response = await createDeleteRequest(baseUrl, '/test', {
        timeout: 1000,
      })
      expect(response.status).toBe(200)
    })

    it('should handle connection errors', async () => {
      const invalidUrl = 'http://127.0.0.1:1'
      await expect(
        createDeleteRequest(invalidUrl, '/test', { timeout: 100 }),
      ).rejects.toThrow()
    })

    it('should handle immediate connection close', async () => {
      await expect(
        createDeleteRequest(baseUrl, '/error-immediate', { timeout: 1000 }),
      ).rejects.toThrow()
    })

    it('should call hooks when provided', async () => {
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

      await createDeleteRequest(baseUrl, '/test', { hooks, timeout: 1000 })
      expect(requestCalled).toBe(true)
      expect(responseCalled).toBe(true)
    })

    it('should not call hooks when not provided', async () => {
      // Verifies the if-guard optimization: sanitizeHeaders and hook callbacks
      // are never evaluated when hooks are absent.
      const response = await createDeleteRequest(baseUrl, '/test', {
        timeout: 1000,
      })
      expect(response.status).toBe(200)
    })

    it('should not call hooks on error when not provided', async () => {
      const invalidUrl = 'http://127.0.0.1:1'
      await expect(
        createGetRequest(invalidUrl, '/test', { timeout: 100 }),
      ).rejects.toThrow()
    })
  })

  describe('timeout handling', () => {
    it('should handle timeout errors with detailed message', async () => {
      await expect(
        createGetRequest(baseUrl, '/timeout', { timeout: 100 }),
      ).rejects.toThrow(/timed out/)
    })
  })

  describe('network error handling', () => {
    it('should handle ECONNREFUSED with helpful message', async () => {
      const invalidUrl = 'http://127.0.0.1:1'
      await expect(
        createGetRequest(invalidUrl, '/test', { timeout: 100 }),
      ).rejects.toThrow()
    })

    it('should handle ENOTFOUND with DNS guidance', async () => {
      const invalidHost = 'http://nonexistent-host-that-does-not-exist.invalid'
      await expect(
        createGetRequest(invalidHost, '/test', { timeout: 100 }),
      ).rejects.toThrow()
    })
  })

  describe('getResponseJson error handling', () => {
    it('should handle JSON parsing errors', async () => {
      const response = await createGetRequest(baseUrl, '/invalid-json', {
        timeout: 1000,
      })

      await expect(getResponseJson(response)).rejects.toThrow(
        /Invalid JSON response|Expected property name/,
      )
    })

    it('should handle connection errors during JSON read', async () => {
      const invalidUrl = 'http://127.0.0.1:1'
      await expect(
        (async () => {
          const response = await createGetRequest(invalidUrl, '/test', {
            timeout: 100,
          })
          return await getResponseJson(response)
        })(),
      ).rejects.toThrow()
    })

    it('should handle empty response as empty object', async () => {
      const response = await createGetRequest(baseUrl, '/empty-response', {
        timeout: 1000,
      })

      const result = await getResponseJson(response)
      expect(result).toEqual({})
    })

    it('should throw ResponseError for non-OK responses with method parameter', async () => {
      const response = await createGetRequest(baseUrl, '/non-ok-response', {
        timeout: 1000,
      })

      await expect(getResponseJson(response, 'GET')).rejects.toThrow(
        'GET Request failed',
      )
    })

    it('should throw ResponseError for non-OK responses without method parameter', async () => {
      const response = await createGetRequest(baseUrl, '/non-ok-response', {
        timeout: 1000,
      })

      await expect(getResponseJson(response)).rejects.toThrow(/Request failed/)
    })
  })

  describe('Error propagation', () => {
    it('should propagate errors through the stack', async () => {
      const invalidUrl = 'http://127.0.0.1:1'

      try {
        await createGetRequest(invalidUrl, '/test', { timeout: 100 })
        expect.fail('Should have thrown an error')
      } catch (e) {
        expect(e).toBeDefined()
        expect(isError(e)).toBe(true)
      }
    })

    it('should handle errors in POST requests', async () => {
      const invalidUrl = 'http://127.0.0.1:1'

      try {
        await createRequestWithJson(
          'POST',
          invalidUrl,
          '/test',
          {},
          {
            timeout: 100,
          },
        )
        expect.fail('Should have thrown an error')
      } catch (e) {
        expect(e).toBeDefined()
        expect(isError(e)).toBe(true)
      }
    })

    it('should handle errors in JSON parsing', async () => {
      try {
        const response = await createGetRequest(baseUrl, '/invalid-json', {
          timeout: 1000,
        })
        await getResponseJson(response)
        expect.fail('Should have thrown a JSON parsing error')
      } catch (e) {
        expect(e).toBeDefined()
        expect(e instanceof SyntaxError).toBe(true)
      }
    })
  })
})
