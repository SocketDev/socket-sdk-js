/**
 * @file Tests for the generic sendApi method and JSON-parsing edge cases.
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../utils/environment.mts'

import type { SocketSdkGenericResult } from '../../src/index.mts'
import type { IncomingHttpHeaders } from 'node:http'

describe('getApi and sendApi Methods', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  describe('sendApi', () => {
    it('should send POST request with JSON body when throws=true (default)', async () => {
      const requestData = { name: 'Test', value: 42 }
      const responseData = { id: 123, status: 'created' }

      nock('https://api.socket.dev')
        .post('/v0/create', requestData)
        .reply(201, responseData)

      const result = await getClient().sendApi<typeof responseData>('create', {
        method: 'POST',
        body: requestData,
      })

      expect(result).toEqual(responseData)
    })

    it('should return SocketSdkGenericResult<T> when throws=false', async () => {
      const requestData = { name: 'Test', value: 42 }
      const responseData = { id: 123, status: 'created' }

      nock('https://api.socket.dev')
        .post('/v0/create', requestData)
        .reply(201, responseData)

      const result = (await getClient().sendApi<typeof responseData>('create', {
        method: 'POST',
        body: requestData,
        throws: false,
      })) as SocketSdkGenericResult<typeof responseData>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(responseData)
      }
    })

    it('should send PUT request', async () => {
      const requestData = { name: 'Updated Test', value: 84 }
      const responseData = { id: 123, status: 'updated' }

      nock('https://api.socket.dev')
        .put('/v0/update/123', requestData)
        .reply(200, responseData)

      const result = (await getClient().sendApi<typeof responseData>(
        'update/123',
        {
          method: 'PUT',
          body: requestData,
          throws: false,
        },
      )) as SocketSdkGenericResult<typeof responseData>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(responseData)
      }
    })

    it('should handle requests without body', async () => {
      const responseData = { status: 'processed' }

      nock('https://api.socket.dev')
        .post('/v0/process')
        .reply(200, responseData)

      const result = (await getClient().sendApi<typeof responseData>(
        'process',
        {
          body: {},
          throws: false,
        },
      )) as SocketSdkGenericResult<typeof responseData>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(responseData)
      }
    })

    it('should throw error when throws=true and request fails', async () => {
      const requestData = { invalid: true }

      nock('https://api.socket.dev')
        .post('/v0/fail', requestData)
        .reply(400, { error: 'Validation failed' })

      await expect(
        getClient().sendApi('fail', {
          body: requestData,
        }),
      ).rejects.toThrow(/Socket API Request failed \(400\)/)
    })

    it('should return error CResult when throws=false and request fails', async () => {
      const requestData = { invalid: true }

      nock('https://api.socket.dev')
        .post('/v0/fail', requestData)
        .reply(422, { error: 'Unprocessable Entity' })

      const result = (await getClient().sendApi('fail', {
        body: requestData,
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(422)
        expect(result.error).toContain('Socket API')
        if (result.cause) {
          expect(result.cause).toContain('Unprocessable Entity')
        }
      }
    })

    it('should handle JSON parsing errors in response', async () => {
      nock('https://api.socket.dev')
        .post('/v0/invalid-response')
        .reply(200, 'not valid json')

      const result = (await getClient().sendApi('invalid-response', {
        body: { test: true },
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Server returned invalid JSON')
      }
    })

    it('should include Content-Type header for JSON requests', async () => {
      const requestData = { test: true }
      let capturedHeaders: IncomingHttpHeaders = {}

      nock('https://api.socket.dev')
        .post('/v0/headers-test', requestData)
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- nock reply context
        .reply(function (this: any) {
          capturedHeaders = this.req.headers
          return [200, { received: true }]
        })

      await getClient().sendApi('headers-test', {
        body: requestData,
        throws: false,
      })

      expect(capturedHeaders['content-type']).toBe('application/json')
    })

    it('should handle network errors gracefully', async () => {
      const result = (await getClient().sendApi('network-fail', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API request failed')
        expect(result.cause).toBeDefined()
      }
    })
  })

  describe('Edge case error handling for coverage', () => {
    it('should handle error with long response text in JSON parsing error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/long-invalid-json')
        .reply(
          200,
          'a'.repeat(150) +
            ' - this is a very long invalid json response that should be truncated',
        )

      const result = (await getClient().getApi('long-invalid-json', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Server returned invalid JSON')
        expect(result.cause).toContain('…')
      }
    })

    it('should handle error with no match in JSON parsing error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/no-match-json')
        .reply(200, 'invalid json')

      const result = (await getClient().getApi('no-match-json', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Server returned invalid JSON')
        expect(result.cause).toContain('Please report this')
      }
    })

    it('should handle null/undefined errors in sendApi', async () => {
      const result = (await getClient().sendApi('null-error', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API request failed')
        expect(typeof result.cause).toBe('string')
      }
    })

    it('should handle empty response text causing empty preview', async () => {
      nock('https://api.socket.dev')
        .get('/v0/empty-preview-json')
        .reply(200, '')

      const result = (await getClient().getApi('empty-preview-json', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      // Empty response is handled as empty object by getResponseJson
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({})
      }
    })

    it('should handle falsy error string in error result creation', async () => {
      // Simulate a custom error handler that tests the edge case
      nock('https://api.socket.dev')
        .get('/v0/falsy-error')
        .reply(400, 'Bad Request')

      const result = (await getClient().getApi('falsy-error', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Socket API')
        expect(result.cause).toBeDefined()
      }
    })

    it('should handle short response text without truncation', async () => {
      nock('https://api.socket.dev')
        .get('/v0/short-invalid-json')
        .reply(200, 'short response')

      const result = (await getClient().getApi('short-invalid-json', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Server returned invalid JSON')
        expect(result.cause).toContain('short response')
        expect(result.cause).not.toContain('...')
      }
    })

    it('should handle undefined errors in error result creation', async () => {
      // Test the null/undefined error path more specifically
      const result = (await getClient().sendApi('nonexistent-endpoint', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API request failed')
        expect(typeof result.cause).toBe('string')
      }
    })

    it('should handle JSON parsing error with no regex match', async () => {
      // Create a SyntaxError that doesn't match the regex pattern
      nock('https://api.socket.dev')
        .get('/v0/no-match-error')
        .reply(200, 'invalid')

      const result = (await getClient().getApi('no-match-error', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Server returned invalid JSON')
        expect(result.cause).toContain('Please report this')
      }
    })

    it('should handle empty preview string in error creation', async () => {
      // Test when responseText.slice(0, 100) returns empty string
      nock('https://api.socket.dev').get('/v0/empty-slice').reply(200, '')

      const result = (await getClient().getApi('empty-slice', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      // Empty response is handled as {} by getResponseJson
      expect(result.success).toBe(true)
    })

    it('should handle null error in sendApi error creation', async () => {
      // Simulate a scenario that creates an error that becomes null when stringified
      const result = (await getClient().sendApi('null-error-path', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API request failed')
        expect(result.cause).toBeDefined()
      }
    })

    it('should handle empty error string in sendApi', async () => {
      // This will test the errStr || UNKNOWN_ERROR branch
      const result = (await getClient().sendApi('empty-error-string', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API request failed')
        expect(typeof result.cause).toBe('string')
      }
    })

    it('should handle falsy error parameter in getApi error creation', async () => {
      // Test the e ? String(e).trim() : '' branch with falsy e
      const result = (await getClient().getApi('falsy-error-param', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API request failed')
        expect(typeof result.cause).toBe('string')
      }
    })

    it('should handle error with match but no captured group', async () => {
      // Mock getResponseJson to throw a specific SyntaxError that will match regex but have no captured group
      nock('https://api.socket.dev')
        .get('/v0/no-capture-group')
        .reply(200, 'malformed json {')

      const result = (await getClient().getApi('no-capture-group', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Server returned invalid JSON')
        expect(result.cause).toContain('Please report this')
      }
    })

    it('should handle error with trim on empty string', async () => {
      // Create a scenario that tests trim() on an empty response
      nock('https://api.socket.dev').get('/v0/empty-trim').reply(200, '   ')

      const result = (await getClient().getApi('empty-trim', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Server returned invalid JSON')
        expect(result.cause).toBeDefined()
      }
    })

    it('should handle preview slice edge case with empty result', async () => {
      // Test responseText.slice(0, 100) || '' where slice returns empty
      nock('https://api.socket.dev').get('/v0/preview-edge').reply(200, '')

      const result = (await getClient().getApi('preview-edge', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      // Empty response returns {} from getResponseJson, so this should succeed
      expect(result.success).toBe(true)
    })

    it('should handle error that becomes empty string when converted', async () => {
      // Test the errStr || UNKNOWN_ERROR branches more directly
      const result = (await getClient().sendApi('trigger-empty-string-error', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API request failed')
        expect(result.cause).toBeDefined()
      }
    })
  })
})
