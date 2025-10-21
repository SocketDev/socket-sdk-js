/** @fileoverview Tests for HTTP client utility functions and module selection. */

import http from 'node:http'
import https from 'node:https'
import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { MAX_RESPONSE_SIZE } from '../src/constants.js'
import { getErrorResponseBody, getHttpModule } from '../src/http-client.js'

import type { IncomingMessage } from 'node:http'

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
        `Response exceeds maximum size limit of ${MAX_RESPONSE_SIZE} bytes`,
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
        `Response exceeds maximum size limit of ${MAX_RESPONSE_SIZE} bytes`,
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
        `Response exceeds maximum size limit of ${MAX_RESPONSE_SIZE} bytes`,
      )
    })
  })
})
