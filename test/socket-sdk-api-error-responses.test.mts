/** @fileoverview Tests for API error response handling and various error scenarios. */
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { isCoverageMode } from './utils/environment.mts'
import { SocketSdk } from '../src/index'
import { FAST_TEST_CONFIG } from './utils/fast-test-config.mts'

describe.skipIf(isCoverageMode)('SocketSdk - Edge Cases', () => {
  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
  })

  afterEach(() => {
    if (!isCoverageMode && !nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  describe.skipIf(isCoverageMode)('Error Response Edge Cases', () => {
    it('should handle text/plain response in error handler', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(429, 'Rate limit exceeded', {
          'content-type': 'text/plain',
        })

      const client = new SocketSdk('test-token', FAST_TEST_CONFIG)
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(429)
      if (!res.success) {
        expect(res.error).toContain('Rate limit exceeded')
      }
    })

    it('should handle malformed JSON in error response', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(400, 'not-json{invalid', {
          'content-type': 'application/json',
        })

      const client = new SocketSdk('test-token', FAST_TEST_CONFIG)
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(400)
      if (!res.success) {
        expect(res.error).toContain('not-json{invalid')
      }
    })

    it('should handle response without error message in JSON', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(400, { someOtherField: 'value' })

      const client = new SocketSdk('test-token', FAST_TEST_CONFIG)
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(400)
    })

    it('should handle 401 unauthorized with message', async () => {
      nock('https://api.socket.dev')
        .get('/v0/organizations')
        .reply(401, { error: { message: 'Invalid API key' } })

      const client = new SocketSdk('test-token', FAST_TEST_CONFIG)
      const res = await client.getOrganizations()

      expect(res.success).toBe(false)
      expect(res.status).toBe(401)
      if (!res.success) {
        expect(res.error).toContain('Invalid API key')
      }
    })

    it('should handle 400 bad request without error message in response', async () => {
      nock('https://api.socket.dev').get('/v0/quota').reply(400)

      const client = new SocketSdk('test-token', FAST_TEST_CONFIG)
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(400)
    })
  })
})
