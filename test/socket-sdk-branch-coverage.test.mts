/** @fileoverview Tests for missing branch coverage in socket-sdk-class.ts. */
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

import type { CResult } from '../dist/index'

describe('SocketSdk - Branch Coverage Tests', () => {
  let client: SocketSdk

  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
    client = new SocketSdk('test-api-token')
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  describe('SyntaxError handling branches', () => {
    it('should handle SyntaxError without originalResponse property', async () => {
      // Force a SyntaxError by returning invalid JSON
      nock('https://api.socket.dev')
        .get('/v0/syntax-error-test')
        .reply(200, '{invalid json}')

      const result = (await client.getApi('syntax-error-test', {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toBe('Server returned invalid JSON')
        expect(result.cause).toContain('JSON.parse threw an error')
      }
    })

    it('should handle empty responseText slice branch', async () => {
      // Create a scenario where responseText would be empty after slicing
      nock('https://api.socket.dev')
        .get('/v0/empty-response-test')
        .reply(200, '')

      const result = (await client.getApi('empty-response-test', {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>

      // Empty response should actually parse as {} and succeed
      expect(result.ok).toBe(true)
    })
  })

  describe('API error handling branches', () => {
    it('should handle ResponseError in getApi with throws: false', async () => {
      // Mock a ResponseError (HTTP error response) for getApi
      nock('https://api.socket.dev')
        .get('/v0/getapi-error-test')
        .reply(404, { error: 'Not Found', message: 'Resource not found' })

      const result = (await client.getApi('getapi-error-test', {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe(404)
      }
    })

    it('should handle ResponseError in sendApi with throws: false', async () => {
      // Mock a ResponseError (HTTP error response)
      nock('https://api.socket.dev')
        .post('/v0/response-error-test')
        .reply(400, { error: 'Bad Request', message: 'Invalid data' })

      const result = (await client.sendApi('response-error-test', {
        throws: false,
        method: 'POST',
        body: { test: 'data' },
      })) as CResult<unknown>

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe(400)
      }
    })
  })

  describe('Edge cases for complete branch coverage', () => {
    it('should handle SyntaxError with regex match but no capture group', async () => {
      // Create a SyntaxError scenario that matches the regex pattern but has no capture
      const customError = new SyntaxError(
        'Invalid JSON response:\n\n→',
      ) as SyntaxError & { originalResponse?: string | undefined }
      customError.originalResponse = undefined

      nock('https://api.socket.dev')
        .get('/v0/regex-no-capture')
        .reply(200, 'Invalid JSON response:\n\n→')

      const result = (await client.getApi('regex-no-capture', {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>

      expect(result.ok).toBe(false)
    })
  })
})
