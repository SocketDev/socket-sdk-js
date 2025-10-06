/** @fileoverview Tests for network error handling and connection failures. */
import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'
import { setupTestEnvironment } from './utils/environment.mts'

describe('SocketSdk Network and Error Handling', () => {
  setupTestEnvironment()

  describe('Response parsing and JSON handling', () => {
    it('handles partial JSON response data gracefully', async () => {
      nock('https://api.socket.dev')
        .post('/v0/purl')
        .reply(200, '{"purl":"pkg:npm/test@1.0.0","na')

      const client = new SocketSdk('test-token')
      const res = await client.batchPackageFetch({
        components: [{ purl: 'pkg:npm/test@1.0.0' }],
      })

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data).toEqual([])
      }
    })
  })

  describe('Network error recovery strategies', () => {
    it('handles POST settings network failures gracefully', async () => {
      const client = new SocketSdk('test-token', {
        // Disable retries for network error tests
        retries: 0,
      })

      // Mock a network error for postSettings.
      nock('https://api.socket.dev')
        .post('/v0/settings')
        .replyWithError('Network error')

      // Should throw an error as network errors are not handled gracefully.
      await expect(
        client.postSettings([{ organization: 'test' }]),
      ).rejects.toThrow('Unexpected Socket API error')
    })

    it('handles dependency search connection failures', async () => {
      const client = new SocketSdk('test-token', {
        // Disable retries for network error tests
        retries: 0,
      })

      // Mock a network error for searchDependencies.
      nock('https://api.socket.dev')
        .post('/v0/dependencies/search')
        .replyWithError('Connection refused')

      // Should throw an error as network errors are not handled gracefully.
      await expect(
        client.searchDependencies({ query: 'test' }),
      ).rejects.toThrow('Unexpected Socket API error')
    })

    it('handles POST settings 400 bad request errors', async () => {
      const client = new SocketSdk('test-token')

      // Mock a 400 error for postSettings.
      nock('https://api.socket.dev')
        .post('/v0/settings')
        .reply(400, { error: 'Bad Request' })

      const result = await client.postSettings([{ organization: 'test' }])
      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
    })

    it('handles dependency search 500 server errors', async () => {
      const client = new SocketSdk('test-token')

      // Mock a 500 error for searchDependencies.
      nock('https://api.socket.dev')
        .post('/v0/dependencies/search')
        .reply(500, { error: 'Server Error' })

      // 500 errors throw by default.
      await expect(
        client.searchDependencies({ query: 'test' }),
      ).rejects.toThrow('Socket API server error (500)')
    })
  })

  describe('Error message formatting and details', () => {
    it('replaces statusMessage with response body in errors', async () => {
      const client = new SocketSdk('test-token')

      // Mock a response that includes statusMessage in the error message.
      nock('https://api.socket.dev')
        .get('/v0/report/list')
        .reply(400, 'Custom error body', {
          'Content-Type': 'text/plain',
        })

      const result = await client.getScanList()
      expect(result.success).toBe(false)
      if (!result.success) {
        // The error should contain the custom body instead of the generic statusMessage.
        expect(result.error).toContain('Custom error body')
        expect(result.cause).toBe('Custom error body')
      }
    })

    it('appends response body when statusMessage not in error', async () => {
      const client = new SocketSdk('test-token')

      // Mock a response with body content - use a custom error message without statusMessage.
      nock('https://api.socket.dev')
        .get('/v0/report/list')
        .reply(400, 'Server error details', {
          'Content-Type': 'text/plain',
        })

      const result = await client.getScanList()
      expect(result.success).toBe(false)
      if (!result.success) {
        // Should contain the error details in the message.
        expect(result.error).toContain('Server error details')
      }
    })
  })
})
