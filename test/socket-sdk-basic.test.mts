import { Readable } from 'node:stream'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// @ts-ignore - internal import
import SOCKET_PUBLIC_API_TOKEN from '@socketsecurity/registry/lib/constants/socket-public-api-token'

import { SocketSdk } from '../dist/index'

// Mock fs.createReadStream to prevent test-package.json from being created
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    createReadStream: vi.fn((path: string) => {
      // Return a mock readable stream for test-package.json
      if (path.includes('test-package.json')) {
        const stream = new Readable()
        stream.push('{"name": "test-package", "version": "1.0.0"}')
        stream.push(null)
        return stream
      }
      // For other files, use the actual createReadStream
      return actual.createReadStream(path)
    }),
  }
})

process.on('unhandledRejection', cause => {
  const error = new Error('Unhandled rejection')
  ;(error as any).cause = cause
  throw error
})

describe('SocketSdk - Basic API', () => {
  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  describe('basics', () => {
    it('should be able to instantiate itself', () => {
      const client = new SocketSdk('yetAnotherApiKey')
      expect(client).toBeTruthy()
    })
  })

  describe('getQuota', () => {
    it('should return quota from getQuota', async () => {
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

  describe('getIssuesByNpmPackage', () => {
    it('should return an empty issue list on an empty response', async () => {
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

  describe('Authentication', () => {
    it('should include authentication token in request headers', async () => {
      const apiToken = 'test-api-token-123'
      let capturedHeaders: any = {}

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

    it('should handle 401 unauthorized responses for invalid tokens', async () => {
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

    it('should handle 403 forbidden responses for insufficient permissions', async () => {
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

    it('should support different base URLs for authentication', async () => {
      const customBaseUrl = 'https://custom.socket.dev/api/'
      const apiToken = 'custom-token'
      let capturedHeaders: any = {}

      nock('https://custom.socket.dev')
        .get('/api/quota')
        .reply(function () {
          capturedHeaders = this.req.headers
          return [200, { quota: 3000 }]
        })

      const client = new SocketSdk(apiToken, { baseUrl: customBaseUrl })
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

    it('should work with Socket public API token', async () => {
      nock('https://api.socket.dev')
        .get('/v0/npm/express/4.18.0/issues')
        .reply(200, { results: [] })

      const client = new SocketSdk(SOCKET_PUBLIC_API_TOKEN)
      const res = await client.getIssuesByNpmPackage('express', '4.18.0')

      expect(res).toEqual({
        success: true,
        status: 200,
        data: { results: [] },
      })
    })
  })
})
