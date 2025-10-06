/** @fileoverview Tests for SocketSdk agent configuration and HTTP client setup. */
import { Agent as HttpAgent, type IncomingHttpHeaders } from 'node:http'
import { Agent as HttpsAgent } from 'node:https'

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'
import { setupTestEnvironment } from './utils/environment.mts'

describe('SocketSdk Agent Configuration', () => {
  setupTestEnvironment()

  describe('HTTP agent configuration with direct agents', () => {
    it('configures SDK with HTTPS agent for secure connections', () => {
      // Test agent as Got options with https agent.
      const httpsAgent = new HttpsAgent({ keepAlive: true })
      const client1 = new SocketSdk('test-token', { agent: httpsAgent })
      expect(client1).toBeDefined()
    })

    it('configures SDK with HTTP agent for non-secure connections', () => {
      // Test agent as Got options with http agent.
      const httpAgent = new HttpAgent({ keepAlive: false })
      const client2 = new SocketSdk('test-token', { agent: httpAgent })
      expect(client2).toBeDefined()
    })

    it('configures SDK with custom timeout settings', () => {
      // Test agent as Got options with timeout.
      const client3 = new SocketSdk('test-token', { timeout: 5000 })
      expect(client3).toBeDefined()
    })

    it('configures SDK with agent and additional options', () => {
      // Test agent as Got options with all agents.
      const httpsAgent = new HttpsAgent({ keepAlive: true })
      const client4 = new SocketSdk('test-token', {
        agent: httpsAgent,
      })
      expect(client4).toBeDefined()
    })
  })

  describe('Got-style agent configuration with object notation', () => {
    it('configures SDK with HTTPS agent using Got-style object', () => {
      // Test with https property in agent options object (Got-style).
      const httpsAgent = new HttpsAgent({ keepAlive: true })
      const client1 = new SocketSdk('test-token', {
        agent: {
          https: httpsAgent,
        },
      })
      expect(client1).toBeDefined()
    })

    it('configures SDK with HTTP agent using Got-style object', () => {
      // Test with http property in agent options object (Got-style).
      const httpAgent = new HttpAgent({ keepAlive: false })
      const client2 = new SocketSdk('test-token', {
        agent: {
          http: httpAgent,
        },
      })
      expect(client2).toBeDefined()
    })

    it('configures SDK with HTTP2 agent using Got-style object', () => {
      // Test with http2 property in agent options object (Got-style).
      // Note: http2 requires a ClientHttp2Session, not an HttpsAgent.
      // Since we're testing the configuration accepts the object structure,
      // we'll use a mock object that matches the expected type.
      const client3 = new SocketSdk('test-token', {
        agent: {
          // Mock ClientHttp2Session for testing.
          http2: {} as any,
        },
      })
      expect(client3).toBeDefined()
    })

    it('handles multiple agent types with priority (https > http > http2)', () => {
      // Test with multiple agent properties - https takes precedence.
      const httpsAgent = new HttpsAgent({ keepAlive: true })
      const httpAgent = new HttpAgent({ keepAlive: false })

      const client4 = new SocketSdk('test-token', {
        agent: {
          https: httpsAgent,
          http: httpAgent,
          // Mock ClientHttp2Session for testing.
          http2: {} as any,
        },
      })
      expect(client4).toBeDefined()
    })
  })

  describe('Custom user agent configuration', () => {
    it('configures SDK with custom user agent string', async () => {
      const customUserAgent = 'MyCustomApp/1.0.0'
      let capturedHeaders: IncomingHttpHeaders = {}

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(function () {
          capturedHeaders = this.req.headers
          return [200, { quota: 1000 }]
        })

      const client = new SocketSdk('test-token', {
        userAgent: customUserAgent,
      })

      await client.getQuota()

      const userAgentHeader = Array.isArray(capturedHeaders['user-agent'])
        ? capturedHeaders['user-agent'][0]
        : capturedHeaders['user-agent']

      expect(userAgentHeader).toBe(customUserAgent)
    })

    it('uses default user agent when not specified', async () => {
      let capturedHeaders: IncomingHttpHeaders = {}

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(function () {
          capturedHeaders = this.req.headers
          return [200, { quota: 1000 }]
        })

      const client = new SocketSdk('test-token')
      await client.getQuota()

      const userAgentHeader = Array.isArray(capturedHeaders['user-agent'])
        ? capturedHeaders['user-agent'][0]
        : capturedHeaders['user-agent']

      expect(userAgentHeader).toContain('socketsecurity-sdk')
    })
  })

  describe('Query parameter transformation', () => {
    it('transforms perPage parameter to snake_case per_page', async () => {
      const client = new SocketSdk('test-token')
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/audit-log')
        .query(queryObject => {
          // Check that perPage was transformed to per_page.
          return queryObject['per_page'] === '20'
        })
        .reply(200, { events: [] })

      const result = await client.getAuditLogEvents('test-org', { perPage: 20 })
      expect(result.success).toBe(true)
    })

    it('handles batchPackageStream with 401 error correctly', async () => {
      const client = new SocketSdk('test-token')
      nock('https://api.socket.dev').post('/v0/purl').reply(401, 'Unauthorized')

      const generator = client.batchPackageStream({
        components: [{ purl: 'pkg:npm/test@1.0.0' }],
      })
      let hasError = false
      for await (const result of generator) {
        if (!result.success) {
          hasError = true
          expect(result.status).toBe(401)
        }
      }
      expect(hasError).toBe(true)
    })
  })
})
