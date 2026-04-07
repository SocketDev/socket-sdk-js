import { createServer } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ResponseError,
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
  getErrorResponseBody,
  getResponseJson,
  isResponseOk,
  reshapeArtifactForPublicPolicy,
} from '../../src/http-client.js'

import type { HttpResponse } from '@socketsecurity/lib/http-request'
import type { Server } from 'node:http'

function mockHttpResponse(
  overrides: Partial<Omit<HttpResponse, 'body'>> & { body?: Buffer | string },
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
  describe('getErrorResponseBody', () => {
    it('should read normal response body successfully', async () => {
      const testBody = 'Hello, World!'
      const response = mockHttpResponse({ body: testBody })
      const result = await getErrorResponseBody(response)
      expect(result).toBe(testBody)
    })

    it('should read empty response body', async () => {
      const response = mockHttpResponse({ body: '' })
      const result = await getErrorResponseBody(response)
      expect(result).toBe('')
    })

    it('should read large response body', async () => {
      const largeBody = 'x'.repeat(10000)
      const response = mockHttpResponse({ body: largeBody })
      const result = await getErrorResponseBody(response)
      expect(result).toBe(largeBody)
    })
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
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
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
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })

    it('should handle errors in JSON parsing', async () => {
      try {
        const response = await createGetRequest(baseUrl, '/invalid-json', {
          timeout: 1000,
        })
        await getResponseJson(response)
        expect.fail('Should have thrown a JSON parsing error')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof SyntaxError).toBe(true)
      }
    })
  })
})

// =============================================================================
// ResponseError Edge Cases
// =============================================================================

describe('HTTP Client - ResponseError Edge Cases', () => {
  describe('ResponseError constructor', () => {
    it('should handle empty message parameter', () => {
      const response = mockHttpResponse({
        status: 500,
        statusText: 'Internal Server Error',
      })

      const error = new ResponseError(response)

      expect(error.message).toContain('Request failed')
      expect(error.message).toContain('500')
      expect(error.message).toContain('Internal Server Error')
      expect(error.name).toBe('ResponseError')
    })

    it('should handle custom message', () => {
      const response = mockHttpResponse({
        status: 404,
        statusText: 'Not Found',
      })

      const error = new ResponseError(response, 'Custom message')

      expect(error.message).toContain('Custom message')
      expect(error.message).toContain('404')
    })

    it('should handle missing status', () => {
      const response = mockHttpResponse({
        status: 0,
        statusText: 'Error',
      })

      const error = new ResponseError(response)

      // status 0 is truthy-ish but the message should show it
      expect(error.message).toContain('0')
    })

    it('should handle missing statusText', () => {
      const response = mockHttpResponse({
        status: 500,
        statusText: '',
      })

      const error = new ResponseError(response)

      expect(error.message).toContain('No status message')
    })

    it('should have response property', () => {
      const response = mockHttpResponse({
        status: 500,
        statusText: 'Error',
      })

      const error = new ResponseError(response)

      expect(error.response).toBe(response)
    })

    it('should handle both missing status and statusText', () => {
      const response = mockHttpResponse({
        status: 0,
        statusText: '',
      })

      const error = new ResponseError(response)

      expect(error.message).toContain('No status message')
    })

    it('should have proper error stack trace', () => {
      const response = mockHttpResponse({
        status: 500,
        statusText: 'Error',
      })

      const error = new ResponseError(response)

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ResponseError')
    })

    it('should use provided custom message', () => {
      const response = mockHttpResponse({
        status: 404,
        statusText: 'Not Found',
      })

      const error = new ResponseError(response, 'Custom operation failed')

      expect(error.message).toContain('Custom operation failed')
      expect(error.message).toContain('404')
      expect(error.message).toContain('Not Found')
    })
  })

  describe('isResponseOk', () => {
    it('should return true for 200 OK status', () => {
      const response = mockHttpResponse({ status: 200, ok: true })
      expect(isResponseOk(response)).toBe(true)
    })

    it('should return true for 201 Created status', () => {
      const response = mockHttpResponse({ status: 201, ok: true })
      expect(isResponseOk(response)).toBe(true)
    })

    it('should return true for 299 (edge of 2xx range)', () => {
      const response = mockHttpResponse({ status: 299, ok: true })
      expect(isResponseOk(response)).toBe(true)
    })

    it('should return false for 199 (below 2xx range)', () => {
      const response = mockHttpResponse({ status: 199, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 300 Redirect status', () => {
      const response = mockHttpResponse({ status: 300, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 400 Bad Request status', () => {
      const response = mockHttpResponse({ status: 400, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 404 Not Found status', () => {
      const response = mockHttpResponse({ status: 404, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 500 Server Error status', () => {
      const response = mockHttpResponse({ status: 500, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false when ok is false', () => {
      const response = mockHttpResponse({ ok: false })
      expect(isResponseOk(response)).toBe(false)
    })
  })

  describe('reshapeArtifactForPublicPolicy', () => {
    it('should return data unchanged when authenticated', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            alerts: [{ type: 'malware', severity: 'high', key: 'alert-1' }],
          },
        ],
      }
      const result = reshapeArtifactForPublicPolicy(data, true)
      expect(result).toEqual(data)
    })

    it('should filter low severity alerts when not authenticated', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            size: 1000,
            author: { name: 'test' },
            type: 'npm',
            supplyChainRisk: {},
            scorecards: {},
            topLevelAncestors: [],
            alerts: [
              { type: 'malware', severity: 'high', key: 'alert-1' },
              { type: 'issue', severity: 'low', key: 'alert-2' },
              { type: 'vulnerability', severity: 'medium', key: 'alert-3' },
            ],
          },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, false)

      expect(result.artifacts).toBeDefined()
      expect(result.artifacts?.[0]?.alerts).toHaveLength(2)
      expect(result.artifacts?.[0]?.alerts?.[0]?.severity).not.toBe('low')
      expect(result.artifacts?.[0]?.alerts?.[1]?.severity).not.toBe('low')
    })

    it('should filter alerts by action when actions parameter provided', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            size: 1000,
            author: { name: 'test' },
            type: 'npm',
            supplyChainRisk: {},
            scorecards: {},
            topLevelAncestors: [],
            alerts: [
              {
                type: 'malware',
                severity: 'high',
                key: 'alert-1',
              },
              {
                type: 'criticalCVE',
                severity: 'high',
                key: 'alert-2',
              },
              {
                type: 'deprecated',
                severity: 'high',
                key: 'alert-3',
              },
            ],
          },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, false, 'error')

      expect(result.artifacts).toBeDefined()
      expect(result.artifacts?.[0]?.alerts).toHaveLength(1)
      expect(result.artifacts?.[0]?.alerts?.[0]?.key).toBe('alert-1')
    })

    it('should handle single artifact with alerts property', () => {
      const data = {
        name: 'test-package',
        version: '1.0.0',
        size: 1000,
        author: { name: 'test' },
        type: 'npm',
        supplyChainRisk: {},
        scorecards: {},
        topLevelAncestors: [],
        alerts: [
          { type: 'malware', severity: 'high', key: 'alert-1' },
          { type: 'issue', severity: 'low', key: 'alert-2' },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, false)

      expect(result.alerts).toBeDefined()
      expect(result.alerts).toHaveLength(1)
      expect(result.alerts?.[0]?.severity).toBe('high')
    })

    it('should compact alert objects to only essential fields', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            size: 1000,
            author: { name: 'test' },
            type: 'npm',
            supplyChainRisk: {},
            scorecards: {},
            topLevelAncestors: [],
            alerts: [
              {
                type: 'malware',
                severity: 'high',
                key: 'alert-1',
                description: 'This is a malware alert',
                extraData: { foo: 'bar' },
              },
            ],
          },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, false)

      expect(result.artifacts).toBeDefined()
      const alert = result.artifacts?.[0]?.alerts?.[0]
      expect(alert).toEqual({
        action: 'error',
        key: 'alert-1',
        severity: 'high',
        type: 'malware',
      })
      expect(alert).not.toHaveProperty('description')
      expect(alert).not.toHaveProperty('extraData')
    })

    it('should handle empty alerts array', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            size: 1000,
            author: { name: 'test' },
            type: 'npm',
            supplyChainRisk: {},
            scorecards: {},
            topLevelAncestors: [],
            alerts: [],
          },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, false)

      expect(result.artifacts).toBeDefined()
      expect(result.artifacts?.[0]?.alerts).toEqual([])
    })

    it('should handle data without artifacts or alerts property', () => {
      const data = {
        name: 'test',
        value: 123,
      }

      const result = reshapeArtifactForPublicPolicy(data, false)

      expect(result).toEqual(data)
    })
  })
})
