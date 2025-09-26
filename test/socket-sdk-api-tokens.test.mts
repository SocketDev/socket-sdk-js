import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

describe('Socket SDK - API Token Management', () => {
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

  describe('getAPITokens', () => {
    it('should return list of API tokens', async () => {
      const mockTokens = {
        tokens: [
          { id: 'token-1', name: 'CI Token', scopes: ['packages:list'] },
          { id: 'token-2', name: 'Admin Token', scopes: ['admin'] },
        ],
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/tokens')
        .reply(200, mockTokens)

      const result = await client.getAPITokens('test-org')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockTokens)
      }
    })

    it('should handle URL encoding for organization slug', async () => {
      const mockTokens = { tokens: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/tokens')
        .reply(200, mockTokens)

      const result = await client.getAPITokens('test@org')

      expect(result.success).toBe(true)
    })

    it('should handle 403 unauthorized access', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/forbidden-org/tokens')
        .reply(403, { error: { message: 'Forbidden' } })

      const result = await client.getAPITokens('forbidden-org')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Forbidden')
      }
    })
  })

  describe('postAPIToken', () => {
    it('should create a new API token', async () => {
      const tokenData = { name: 'New Token', scopes: ['packages:list'] }
      const mockResponse = {
        token: { id: 'new-token-id', ...tokenData },
        secret: 'socket_token_123',
      }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens', tokenData)
        .reply(200, mockResponse)

      const result = await client.postAPIToken('test-org', tokenData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle invalid token data', async () => {
      const tokenData = { name: '', scopes: [] }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens', tokenData)
        .reply(400, { error: { message: 'Invalid token data' } })

      const result = await client.postAPIToken('test-org', tokenData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid token data')
      }
    })
  })

  describe('postAPITokensRotate', () => {
    it('should rotate an API token', async () => {
      const mockResponse = {
        token: { id: 'token-123', name: 'Rotated Token' },
        secret: 'socket_token_new_456',
      }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/token-123/rotate', {})
        .reply(200, mockResponse)

      const result = await client.postAPITokensRotate('test-org', 'token-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle URL encoding for token ID', async () => {
      const mockResponse = { token: { id: 'token@123' } }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/token%40123/rotate', {})
        .reply(200, mockResponse)

      const result = await client.postAPITokensRotate('test-org', 'token@123')

      expect(result.success).toBe(true)
    })

    it('should handle 404 for non-existent token', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/nonexistent/rotate', {})
        .reply(404, { error: { message: 'Token not found' } })

      const result = await client.postAPITokensRotate('test-org', 'nonexistent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Token not found')
      }
    })
  })

  describe('postAPITokensRevoke', () => {
    it('should revoke an API token', async () => {
      const mockResponse = { success: true, message: 'Token revoked' }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/token-123/revoke', {})
        .reply(200, mockResponse)

      const result = await client.postAPITokensRevoke('test-org', 'token-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle already revoked token', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/revoked-token/revoke', {})
        .reply(409, { error: { message: 'Token already revoked' } })

      const result = await client.postAPITokensRevoke(
        'test-org',
        'revoked-token',
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Token already revoked')
      }
    })
  })

  describe('postAPITokenUpdate', () => {
    it('should update an API token', async () => {
      const updateData = { name: 'Updated Token Name', scopes: ['admin'] }
      const mockResponse = {
        token: { id: 'token-123', ...updateData },
      }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/token-123/update', updateData)
        .reply(200, mockResponse)

      const result = await client.postAPITokenUpdate(
        'test-org',
        'token-123',
        updateData,
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle invalid update data', async () => {
      const updateData = { scopes: ['invalid-scope'] }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/token-123/update', updateData)
        .reply(400, { error: { message: 'Invalid scope' } })

      const result = await client.postAPITokenUpdate(
        'test-org',
        'token-123',
        updateData,
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid scope')
      }
    })
  })
})
