/**
 * @fileoverview Comprehensive tests for HTTP client functionality.
 * Tests module selection, request/response handling, error paths, and edge cases.
 */

import http, { createServer } from 'node:http'
import https from 'node:https'
import { PassThrough } from 'node:stream'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { MAX_RESPONSE_SIZE } from '../../src/constants.js'
import {
  ResponseError,
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
  getErrorResponseBody,
  getHttpModule,
  getResponseJson,
  isResponseOk,
  reshapeArtifactForPublicPolicy,
} from '../../src/http-client.js'

import type { IncomingMessage, Server } from 'node:http'

// =============================================================================
// Module Selection Tests
// =============================================================================

describe('HTTP Client - Module Selection', () => {
  describe('getHttpModule', () => {
    it('should return https module for secure HTTPS URLs', () => {
      const httpsModule = getHttpModule('https://api.socket.dev')
      expect(httpsModule).toBe(https)
    })

    it('should return http module for insecure HTTP URLs', () => {
      const httpModule = getHttpModule('http://api.socket.dev')
      expect(httpModule).toBe(http)
    })

    it('should default to http module for non-HTTPS protocol URLs', () => {
      const httpModule = getHttpModule('ftp://example.com')
      expect(httpModule).toBe(http)
    })

    it('should handle edge cases with empty and malformed URLs gracefully', () => {
      expect(getHttpModule('')).toBe(http)
      expect(getHttpModule('not-a-url')).toBe(http)
      expect(getHttpModule('httpss://typo.com')).toBe(http)
    })
  })
})

// =============================================================================
// Response Body Reading Tests
// =============================================================================

describe('HTTP Client - Response Body Reading', () => {
  describe('getErrorResponseBody', () => {
    it('should read normal response body successfully', async () => {
      const mockResponse = new PassThrough() as unknown as IncomingMessage
      const testBody = 'Hello, World!'

      const bodyPromise = getErrorResponseBody(mockResponse)

      // Simulate data chunks
      mockResponse.emit('data', testBody)
      mockResponse.emit('end')

      const result = await bodyPromise
      expect(result).toBe(testBody)
    })

    it('should accumulate multiple chunks correctly', async () => {
      const mockResponse = new PassThrough() as unknown as IncomingMessage
      const chunks = ['Part 1', ' - ', 'Part 2', ' - ', 'Part 3']

      const bodyPromise = getErrorResponseBody(mockResponse)

      // Simulate multiple data chunks
      for (const chunk of chunks) {
        mockResponse.emit('data', chunk)
      }
      mockResponse.emit('end')

      const result = await bodyPromise
      expect(result).toBe(chunks.join(''))
    })

    it('should reject when response exceeds size limit', async () => {
      const mockResponse = new PassThrough() as unknown as IncomingMessage
      mockResponse.destroy = () => {
        // Mock destroy method
        return mockResponse
      }

      // Create a chunk that exceeds the limit
      const largeChunk = 'x'.repeat(MAX_RESPONSE_SIZE + 1)

      const bodyPromise = getErrorResponseBody(mockResponse)

      // Simulate oversized data
      mockResponse.emit('data', largeChunk)

      await expect(bodyPromise).rejects.toThrow(
        'Response exceeds maximum size limit',
      )
    })

    it('should reject when accumulated chunks exceed size limit', async () => {
      const mockResponse = new PassThrough() as unknown as IncomingMessage
      mockResponse.destroy = () => {
        // Mock destroy method
        return mockResponse
      }

      // Create chunks that together exceed the limit
      const chunkSize = Math.floor(MAX_RESPONSE_SIZE / 2) + 1
      const chunk1 = 'a'.repeat(chunkSize)
      const chunk2 = 'b'.repeat(chunkSize)

      const bodyPromise = getErrorResponseBody(mockResponse)

      // First chunk should be fine
      mockResponse.emit('data', chunk1)
      // Second chunk should trigger the limit
      mockResponse.emit('data', chunk2)

      await expect(bodyPromise).rejects.toThrow(
        'Response exceeds maximum size limit',
      )
    })

    it('should handle response at exactly the size limit', async () => {
      const mockResponse = new PassThrough() as unknown as IncomingMessage

      // Create a chunk exactly at the limit
      const exactSizeChunk = 'x'.repeat(MAX_RESPONSE_SIZE)

      const bodyPromise = getErrorResponseBody(mockResponse)

      mockResponse.emit('data', exactSizeChunk)
      mockResponse.emit('end')

      const result = await bodyPromise
      expect(result).toBe(exactSizeChunk)
    })

    it('should correctly handle multi-byte UTF-8 characters in size calculation', async () => {
      const mockResponse = new PassThrough() as unknown as IncomingMessage
      mockResponse.destroy = () => {
        // Mock destroy method
        return mockResponse
      }

      // Create a string with multi-byte characters
      // Each emoji is 4 bytes in UTF-8
      const emojiCount = Math.floor(MAX_RESPONSE_SIZE / 4) + 1
      const largeEmojiString = '😀'.repeat(emojiCount)

      const bodyPromise = getErrorResponseBody(mockResponse)

      mockResponse.emit('data', largeEmojiString)

      await expect(bodyPromise).rejects.toThrow(
        'Response exceeds maximum size limit',
      )
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
    // Create a server that can simulate various error conditions
    server = createServer((req, res) => {
      const url = req.url || ''

      if (url.includes('/error-immediate')) {
        // Immediately close connection without response
        req.socket.destroy()
      } else if (url.includes('/invalid-json')) {
        // Return invalid JSON to trigger parsing error
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{ invalid json }')
      } else if (url.includes('/timeout')) {
        // Never respond to trigger timeout
        // (Don't call res.end())
      } else if (url.includes('/json-null-error')) {
        // Return null to trigger JSON.parse error path
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('null')
      } else if (url.includes('/empty-response')) {
        // Return empty response to test empty response handling
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('')
      } else if (url.includes('/non-ok-response')) {
        // Return non-OK response
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not Found' }))
      } else {
        // Default success response
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
      // Try to connect to a port that doesn't exist
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
      // Try to connect to a port that doesn't exist
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
      expect(response.statusCode).toBe(200)
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

      await createDeleteRequest(baseUrl, '/test', { timeout: 1000 }, hooks)
      expect(requestCalled).toBe(true)
      expect(responseCalled).toBe(true)
    })
  })

  describe('getResponse timeout handling', () => {
    it('should handle timeout errors with detailed message', async () => {
      await expect(
        createGetRequest(baseUrl, '/timeout', { timeout: 100 }),
      ).rejects.toThrow(/timed out/)
    })
  })

  describe('getResponse network error handling', () => {
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
      // Try to connect to invalid URL
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
      // This tests that errors are properly caught and re-thrown
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
      const mockResponse = {
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('Request failed')
      expect(error.message).toContain('500')
      expect(error.message).toContain('Internal Server Error')
      expect(error.name).toBe('ResponseError')
    })

    it('should handle custom message', () => {
      const mockResponse = {
        statusCode: 404,
        statusMessage: 'Not Found',
      } as IncomingMessage

      const error = new ResponseError(mockResponse, 'Custom message')

      expect(error.message).toContain('Custom message')
      expect(error.message).toContain('404')
    })

    it('should handle missing statusCode', () => {
      const mockResponse = {
        statusMessage: 'Error',
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('unknown')
    })

    it('should handle missing statusMessage', () => {
      const mockResponse = {
        statusCode: 500,
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('No status message')
    })

    it('should have response property', () => {
      const mockResponse = {
        statusCode: 500,
        statusMessage: 'Error',
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.response).toBe(mockResponse)
    })

    it('should handle both missing statusCode and statusMessage', () => {
      const mockResponse = {} as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('unknown')
      expect(error.message).toContain('No status message')
    })

    it('should have proper error stack trace', () => {
      const mockResponse = {
        statusCode: 500,
        statusMessage: 'Error',
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ResponseError')
    })

    it('should use provided custom message', () => {
      const mockResponse = {
        statusCode: 404,
        statusMessage: 'Not Found',
      } as IncomingMessage

      const error = new ResponseError(mockResponse, 'Custom operation failed')

      expect(error.message).toContain('Custom operation failed')
      expect(error.message).toContain('404')
      expect(error.message).toContain('Not Found')
    })
  })

  describe('isResponseOk', () => {
    it('should return true for 200 OK status', () => {
      const response = { statusCode: 200 } as IncomingMessage
      expect(isResponseOk(response)).toBe(true)
    })

    it('should return true for 201 Created status', () => {
      const response = { statusCode: 201 } as IncomingMessage
      expect(isResponseOk(response)).toBe(true)
    })

    it('should return true for 299 (edge of 2xx range)', () => {
      const response = { statusCode: 299 } as IncomingMessage
      expect(isResponseOk(response)).toBe(true)
    })

    it('should return false for 199 (below 2xx range)', () => {
      const response = { statusCode: 199 } as IncomingMessage
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 300 Redirect status', () => {
      const response = { statusCode: 300 } as IncomingMessage
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 400 Bad Request status', () => {
      const response = { statusCode: 400 } as IncomingMessage
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 404 Not Found status', () => {
      const response = { statusCode: 404 } as IncomingMessage
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 500 Server Error status', () => {
      const response = { statusCode: 500 } as IncomingMessage
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false when statusCode is undefined', () => {
      const response = {} as IncomingMessage
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
                action: 'block',
              },
              {
                type: 'issue',
                severity: 'medium',
                key: 'alert-2',
                action: 'warn',
              },
              {
                type: 'vulnerability',
                severity: 'high',
                key: 'alert-3',
                action: 'block',
              },
            ],
          },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, false, 'block')

      expect(result.artifacts).toBeDefined()
      expect(result.artifacts?.[0]?.alerts).toHaveLength(2)
      expect(result.artifacts?.[0]?.alerts?.[0]?.key).toBe('alert-1')
      expect(result.artifacts?.[0]?.alerts?.[1]?.key).toBe('alert-3')
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
        type: 'malware',
        severity: 'high',
        key: 'alert-1',
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
