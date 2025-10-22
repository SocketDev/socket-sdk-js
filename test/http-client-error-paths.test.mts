/**
 * @fileoverview Tests for HTTP client error handling paths.
 * Tests error scenarios in createGetRequest, createRequestWithJson, and getResponseJson functions.
 */

import { createServer } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createGetRequest,
  createRequestWithJson,
  getResponseJson,
} from '../src/http-client'

import type { Server } from 'node:http'

describe('HTTP Client - Error Paths', () => {
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
