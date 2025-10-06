/** @fileoverview Tests for SocketSdk authentication and basic API operations. */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'
import { setupTestEnvironment } from './utils/environment.mts'

import type { IncomingHttpHeaders } from 'node:http'

describe('SocketSdk Authentication and Basic Operations', () => {
  setupTestEnvironment()

  describe('SDK initialization and instantiation', () => {
    it('creates a new SocketSdk instance with API key', () => {
      const client = new SocketSdk('yetAnotherApiKey')
      expect(client).toBeTruthy()
    })
  })

  describe('Quota management endpoints', () => {
    it('retrieves user quota information successfully', async () => {
      nock('https://api.socket.dev').get('/v0/quota').reply(200, { quota: 1e9 })

      const client = new SocketSdk('yetAnotherApiKey')
      const res = await client.getQuota()

      expect(res).toEqual({
        success: true,
        status: 200,
        data: { quota: 1e9 },
      })
    })
  })

  describe('NPM package issue detection', () => {
    it('returns empty array when no issues found in package', async () => {
      nock('https://api.socket.dev')
        .get('/v0/npm/speed-limiter/1.0.0/issues')
        .reply(200, [])

      const client = new SocketSdk('yetAnotherApiKey')
      const res = await client.getIssuesByNpmPackage('speed-limiter', '1.0.0')

      expect(res).toEqual({
        success: true,
        status: 200,
        data: [],
      })
    })
  })

  describe('API authentication and authorization', () => {
    it('includes proper Basic auth header with API token', async () => {
      const apiToken = 'test-api-token-123'
      let capturedHeaders: IncomingHttpHeaders = {}

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(function () {
          capturedHeaders = this.req.headers
          return [200, { quota: 5000 }]
        })

      const client = new SocketSdk(apiToken)
      await client.getQuota()

      expect(capturedHeaders.authorization).toBeDefined()
      const authHeader = Array.isArray(capturedHeaders.authorization)
        ? capturedHeaders.authorization[0]
        : capturedHeaders.authorization
      expect(authHeader).toContain('Basic')
      const decodedAuth = Buffer.from(
        authHeader.split(' ')[1],
        'base64',
      ).toString()
      expect(decodedAuth).toBe(`${apiToken}:`)
    })

    it('handles 401 unauthorized for invalid API tokens', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(401, { error: { message: 'Invalid API token' } })

      const client = new SocketSdk('invalid-token')
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(401)
      if (!res.success) {
        expect(res.error).toContain('Socket API Request failed')
      }
    })

    it('handles 403 forbidden for insufficient permissions', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/security-policy')
        .reply(403, { error: { message: 'Insufficient permissions' } })

      const client = new SocketSdk('limited-token')
      const res = await client.getOrgSecurityPolicy('test-org')

      expect(res.success).toBe(false)
      expect(res.status).toBe(403)
      if (!res.success) {
        expect(res.error).toContain('Socket API Request failed')
      }
    })

    it('supports custom base URL configuration', async () => {
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

    it('handles expired token authentication errors', async () => {
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
})
