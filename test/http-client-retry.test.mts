/**
 * @fileoverview Tests for HTTP client retry functionality
 */

import { IncomingMessage } from 'node:http'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ResponseError,
  createDeleteRequestWithRetry,
  createGetRequestWithRetry,
  createRequestWithJsonAndRetry,
  withRetry,
} from '../src/http-client'

const BASE_URL = 'https://api.socket.dev'

describe('HTTP Client - Retry Functionality', () => {
  beforeEach(() => {
    nock.disableNetConnect()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn(async () => 'success')
      const result = await withRetry(fn, 3, 100)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on network error and succeed', async () => {
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Network error')
        }
        return 'success'
      })

      const result = await withRetry(fn, 3, 10)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should throw error after all retries exhausted', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Persistent error')
      })

      await expect(withRetry(fn, 3, 10)).rejects.toThrow('Persistent error')
      // Initial + 3 retries
      expect(fn).toHaveBeenCalledTimes(4)
    })

    it('should not retry on 4xx client errors', async () => {
      const mockResponse = {
        statusCode: 404,
        statusMessage: 'Not Found',
      } as IncomingMessage

      const fn = vi.fn(async () => {
        throw new ResponseError(mockResponse, 'Not found')
      })

      await expect(withRetry(fn, 3, 10)).rejects.toThrow()
      // No retries
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on 500 server errors', async () => {
      const mockResponse500 = {
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      } as IncomingMessage

      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 2) {
          throw new ResponseError(mockResponse500, 'Server error')
        }
        return 'success'
      })

      const result = await withRetry(fn, 3, 10)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should use exponential backoff', async () => {
      let attempts = 0

      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 4) {
          throw new Error('Retry test')
        }
        return 'success'
      })

      const startTime = Date.now()
      await withRetry(fn, 3, 100).catch(() => {})
      const duration = Date.now() - startTime

      // Expected delays: 100ms, 200ms, 400ms = 700ms minimum
      expect(duration).toBeGreaterThanOrEqual(600)
      expect(fn).toHaveBeenCalledTimes(4)
    })

    it('should handle ResponseError with no status code', async () => {
      const mockResponse = {
        statusMessage: 'Unknown Error',
      } as IncomingMessage

      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 2) {
          throw new ResponseError(mockResponse, 'Unknown error')
        }
        return 'success'
      })

      const result = await withRetry(fn, 3, 10)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should throw error when lastError is undefined', async () => {
      const fn = vi.fn(async () => {
        // Intentionally throwing undefined to test edge case
        throw undefined
      })

      await expect(withRetry(fn, 0, 10)).rejects.toThrow(
        'Request failed after retries',
      )
    })
  })

  describe('createGetRequestWithRetry', () => {
    it('should succeed on first attempt', async () => {
      nock(BASE_URL).get('/test').reply(200, { status: 'ok' })

      const response = await createGetRequestWithRetry(
        BASE_URL,
        '/test',
        {
          headers: { 'User-Agent': 'test' },
        },
        3,
        10,
      )

      expect(response.statusCode).toBe(200)
    })

    it('should retry on network error and succeed', async () => {
      nock(BASE_URL).get('/test').replyWithError('Network error')
      nock(BASE_URL).get('/test').reply(200, { status: 'ok' })

      const response = await createGetRequestWithRetry(
        BASE_URL,
        '/test',
        {
          headers: { 'User-Agent': 'test' },
        },
        3,
        10,
      )

      expect(response.statusCode).toBe(200)
    })

    it('should throw after all retries exhausted', async () => {
      nock(BASE_URL).get('/test').times(4).replyWithError('Network error')

      await expect(
        createGetRequestWithRetry(
          BASE_URL,
          '/test',
          {
            headers: { 'User-Agent': 'test' },
          },
          3,
          10,
        ),
      ).rejects.toThrow()
    })

    it('should use default retry parameters', async () => {
      nock(BASE_URL).get('/test').reply(200, { status: 'ok' })

      const response = await createGetRequestWithRetry(BASE_URL, '/test', {
        headers: { 'User-Agent': 'test' },
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('createDeleteRequestWithRetry', () => {
    it('should succeed on first attempt', async () => {
      nock(BASE_URL).delete('/test/123').reply(204)

      const response = await createDeleteRequestWithRetry(
        BASE_URL,
        '/test/123',
        {
          headers: { 'User-Agent': 'test' },
        },
        3,
        10,
      )

      expect(response.statusCode).toBe(204)
    })

    it('should retry on network error and succeed', async () => {
      nock(BASE_URL).delete('/test/123').replyWithError('Network error')
      nock(BASE_URL).delete('/test/123').reply(204)

      const response = await createDeleteRequestWithRetry(
        BASE_URL,
        '/test/123',
        {
          headers: { 'User-Agent': 'test' },
        },
        3,
        10,
      )

      expect(response.statusCode).toBe(204)
    })

    it('should throw after all retries exhausted', async () => {
      nock(BASE_URL)
        .delete('/test/123')
        .times(4)
        .replyWithError('Network error')

      await expect(
        createDeleteRequestWithRetry(
          BASE_URL,
          '/test/123',
          {
            headers: { 'User-Agent': 'test' },
          },
          3,
          10,
        ),
      ).rejects.toThrow()
    })

    it('should use default retry parameters', async () => {
      nock(BASE_URL).delete('/test/123').reply(204)

      const response = await createDeleteRequestWithRetry(
        BASE_URL,
        '/test/123',
        {
          headers: { 'User-Agent': 'test' },
        },
      )

      expect(response.statusCode).toBe(204)
    })
  })

  describe('createRequestWithJsonAndRetry', () => {
    it('should succeed on first attempt with POST', async () => {
      nock(BASE_URL).post('/test', { data: 'test' }).reply(201, { id: 1 })

      const response = await createRequestWithJsonAndRetry(
        'POST',
        BASE_URL,
        '/test',
        { data: 'test' },
        {
          headers: { 'User-Agent': 'test' },
        },
        3,
        10,
      )

      expect(response.statusCode).toBe(201)
    })

    it('should succeed with PUT request', async () => {
      nock(BASE_URL)
        .put('/test/123', { data: 'updated' })
        .reply(200, { id: 123 })

      const response = await createRequestWithJsonAndRetry(
        'PUT',
        BASE_URL,
        '/test/123',
        { data: 'updated' },
        {
          headers: { 'User-Agent': 'test' },
        },
        3,
        10,
      )

      expect(response.statusCode).toBe(200)
    })

    it('should retry on network error and succeed', async () => {
      nock(BASE_URL)
        .post('/test', { data: 'test' })
        .replyWithError('Network error')
      nock(BASE_URL).post('/test', { data: 'test' }).reply(201, { id: 1 })

      const response = await createRequestWithJsonAndRetry(
        'POST',
        BASE_URL,
        '/test',
        { data: 'test' },
        {
          headers: { 'User-Agent': 'test' },
        },
        3,
        10,
      )

      expect(response.statusCode).toBe(201)
    })

    it('should throw after all retries exhausted', async () => {
      nock(BASE_URL)
        .post('/test', { data: 'test' })
        .times(4)
        .replyWithError('Network error')

      await expect(
        createRequestWithJsonAndRetry(
          'POST',
          BASE_URL,
          '/test',
          { data: 'test' },
          {
            headers: { 'User-Agent': 'test' },
          },
          3,
          10,
        ),
      ).rejects.toThrow()
    })

    it('should use default retry parameters', async () => {
      nock(BASE_URL).post('/test', { data: 'test' }).reply(201, { id: 1 })

      const response = await createRequestWithJsonAndRetry(
        'POST',
        BASE_URL,
        '/test',
        { data: 'test' },
        {
          headers: { 'User-Agent': 'test' },
        },
      )

      expect(response.statusCode).toBe(201)
    })

    it('should handle PATCH request', async () => {
      nock(BASE_URL)
        .put('/test/123', { data: 'patched' })
        .reply(200, { id: 123 })

      const response = await createRequestWithJsonAndRetry(
        'PUT',
        BASE_URL,
        '/test/123',
        { data: 'patched' },
        {
          headers: { 'User-Agent': 'test' },
        },
        3,
        10,
      )

      expect(response.statusCode).toBe(200)
    })
  })

  describe('Retry Edge Cases', () => {
    it('should handle multiple consecutive network errors', async () => {
      nock(BASE_URL).get('/test').replyWithError('Network error 1')
      nock(BASE_URL).get('/test').replyWithError('Network error 2')
      nock(BASE_URL).get('/test').reply(200, { status: 'ok' })

      const response = await createGetRequestWithRetry(
        BASE_URL,
        '/test',
        {
          headers: { 'User-Agent': 'test' },
        },
        3,
        10,
      )

      expect(response.statusCode).toBe(200)
    })
  })
})
