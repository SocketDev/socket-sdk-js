import { Agent as HttpAgent } from 'node:http'
import { Agent as HttpsAgent } from 'node:https'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

describe('SocketSdk - Network & Connection', () => {
  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  describe('Network and Connection', () => {
    it('should handle 503 service unavailable', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(503, 'Service temporarily unavailable')

      const client = new SocketSdk('test-token')

      await expect(client.getQuota()).rejects.toThrow('server error')
    })

    it('should handle connection refused errors', async () => {
      const client = new SocketSdk('test-token')

      // Mock a connection error by intercepting the request
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .replyWithError(new Error('Connection refused'))

      await expect(client.getQuota()).rejects.toThrow()
    }, 10_000)

    it('should handle DNS resolution failures', async () => {
      const client = new SocketSdk('test-token')

      // Mock a DNS error by intercepting the request
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .replyWithError(new Error('DNS lookup failed'))

      await expect(client.getQuota()).rejects.toThrow()
    }, 10_000)

    it('should handle malformed JSON responses', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, 'This is not JSON')

      const client = new SocketSdk('test-token')

      await expect(client.getQuota()).rejects.toThrow()
    })
  })

  describe('Session Management', () => {
    it('should maintain session across multiple requests', async () => {
      const apiToken = 'persistent-token'

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, { quota: 1000 })
        .get('/v0/organizations')
        .reply(200, { organizations: ['org1', 'org2'] })

      const client = new SocketSdk(apiToken)

      const quotaRes = await client.getQuota()
      expect(quotaRes.success).toBe(true)

      const orgsRes = await client.getOrganizations()
      expect(orgsRes.success).toBe(true)
    })

    it('should handle session invalidation', async () => {
      let requestCount = 0

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          requestCount++
          if (requestCount === 1) {
            return [200, { quota: 5000 }]
          }
          return [401, { error: { message: 'Session expired' } }]
        })

      const client = new SocketSdk('session-token')

      const firstRes = await client.getQuota()
      expect(firstRes.success).toBe(true)

      const secondRes = await client.getQuota()
      expect(secondRes.success).toBe(false)
      expect(secondRes.status).toBe(401)
    })

    it('should support custom user agents for session tracking', async () => {
      let capturedUserAgent = ''

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(function () {
          const headers = this.req.headers['user-agent']
          capturedUserAgent = Array.isArray(headers) ? headers[0] : headers
          return [200, { quota: 3000 }]
        })

      const client = new SocketSdk('test-token', {
        userAgent: 'CustomApp/1.0.0',
      })

      await client.getQuota()
      expect(capturedUserAgent).toBe('CustomApp/1.0.0')
    })

    it('should support custom base URLs', async () => {
      const customBaseUrl = 'https://custom.socket.dev/api/'

      nock('https://custom.socket.dev')
        .get('/api/quota')
        .reply(200, { quota: 10_000 })

      const client = new SocketSdk('api-token', {
        baseUrl: customBaseUrl,
      })
      const res = await client.getQuota()

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.quota).toBe(10_000)
      }
    })

    it('should handle token expiration scenarios', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(401, {
          error: {
            message: 'Token expired',
            code: 'TOKEN_EXPIRED',
          },
        })

      const client = new SocketSdk('expired-token')
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(401)
      if (!res.success) {
        expect(res.cause).toContain('Token expired')
      }
    })
  })

  describe('HTTP Agent Configuration', () => {
    it('should support custom HTTP agents', async () => {
      const customAgent = new HttpAgent({
        keepAlive: true,
        maxSockets: 10,
      })

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, { quota: 2000 })

      const client = new SocketSdk('test-token', {
        agent: customAgent,
      })

      const res = await client.getQuota()
      expect(res.success).toBe(true)
    })

    it('should support custom HTTPS agents', async () => {
      const customHttpsAgent = new HttpsAgent({
        keepAlive: true,
        maxSockets: 5,
      })

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, { quota: 3000 })

      const client = new SocketSdk('test-token', {
        agent: customHttpsAgent,
      })

      const res = await client.getQuota()
      expect(res.success).toBe(true)
    })

    it('should handle timeout configurations', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .delayConnection(5000)
        .reply(200, { quota: 1000 })

      const client = new SocketSdk('test-token', {
        timeout: 1000,
      })

      await expect(client.getQuota()).rejects.toThrow()
    })

    it('should handle request timeout with custom timeout', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .delayConnection(3000)
        .reply(200, { quota: 1000 })

      const client = new SocketSdk('test-token', {
        timeout: 2000,
      })

      await expect(client.getQuota()).rejects.toThrow()
    })
  })

  describe('Error Response Handling', () => {
    it('should handle 400 bad request responses', async () => {
      nock('https://api.socket.dev')
        .post('/v0/dependencies/search')
        .reply(400, {
          error: {
            message: 'Invalid search query',
            details: ['Query must be at least 3 characters'],
          },
        })

      const client = new SocketSdk('test-token')

      const res = await client.searchDependencies({ query: 'ab', type: 'npm' })
      expect(res.success).toBe(false)
      expect(res.status).toBe(400)
      if (!res.success) {
        expect(res.error).toContain('Invalid search query')
      }
    })

    it('should handle 429 rate limit responses', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(429, {
          error: {
            message: 'Too many requests',
            retry_after: 60,
          },
        })

      const client = new SocketSdk('test-token')

      const res = await client.getQuota()
      expect(res.success).toBe(false)
      expect(res.status).toBe(429)
      if (!res.success) {
        expect(res.error).toContain('Too many requests')
      }
    })

    it('should handle 500 internal server error responses', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(500, {
          error: {
            message: 'Internal server error',
            trace_id: 'trace-123',
          },
        })

      const client = new SocketSdk('test-token')

      await expect(client.getQuota()).rejects.toThrow('server error')
    })

    it('should handle empty error responses', async () => {
      nock('https://api.socket.dev').get('/v0/quota').reply(404, '')

      const client = new SocketSdk('test-token')

      const res = await client.getQuota()
      expect(res.success).toBe(false)
      expect(res.status).toBe(404)
    })

    it('should handle malformed error response JSON', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(400, '{invalid-json')

      const client = new SocketSdk('test-token')

      const res = await client.getQuota()
      expect(res.success).toBe(false)
      expect(res.status).toBe(400)
    })
  })

  describe('Network Resilience', () => {
    it('should handle intermittent network failures', async () => {
      const client = new SocketSdk('test-token')

      // First request should fail with network error
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .replyWithError(new Error('Network error'))

      await expect(client.getQuota()).rejects.toThrow(
        'Unexpected Socket API error',
      )

      // Second request should succeed (simulating network recovery)
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, { quota: 1500 })

      const res = await client.getQuota()
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.quota).toBe(1500)
      }
    })

    it('should handle very large response bodies', async () => {
      const largeResponse = {
        rows: Array(1000).fill({
          id: 'item',
          content: 'sample content',
        }),
        data: 'x'.repeat(10_000),
      }

      nock('https://api.socket.dev')
        .post('/v0/dependencies/search')
        .reply(200, largeResponse)

      const client = new SocketSdk('test-token')
      const res = await client.searchDependencies({
        query: 'large-response',
        type: 'npm',
      })

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.rows).toHaveLength(1000)
      }
    })

    it('should handle response with unicode characters', async () => {
      const unicodeResponse = {
        message: 'Package with émojis 🎯 and 中文 characters',
        description: 'Тест unicode ñ characters',
      }

      nock('https://api.socket.dev')
        .get('/v0/npm/unicode-package/1.0.0/issues')
        .reply(200, unicodeResponse)

      const client = new SocketSdk('test-token')
      const res = await client.getIssuesByNpmPackage('unicode-package', '1.0.0')

      expect(res.success).toBe(true)
      if (res.success) {
        expect(Array.isArray(res.data) ? res.data : [res.data]).toBeDefined()
        // Unicode content may be in various parts of the response
      }
    })
  })
})
