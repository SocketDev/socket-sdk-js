/** @fileoverview Tests for organization API token management operations. */
import nock from 'nock'
import { beforeEach, describe, it } from 'vitest'

import type { SocketSdk } from '../dist/index'

import { assertError, assertSuccess } from './utils/assertions.mts'
import { createTestClient, setupTestEnvironment } from './utils/environment.mts'

describe('Socket SDK - API Token Management', () => {
  setupTestEnvironment()

  let client: SocketSdk

  beforeEach(() => {
    client = createTestClient()
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
      assertSuccess(result)
    })

    it('should handle URL encoding for organization slug', async () => {
      const mockTokens = { tokens: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/tokens')
        .reply(200, mockTokens)

      const result = await client.getAPITokens('test@org')
      assertSuccess(result)
    })

    it('should handle 403 unauthorized access', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/forbidden-org/tokens')
        .reply(403, { error: { message: 'Forbidden' } })

      const result = await client.getAPITokens('forbidden-org')
      assertError(result, 403, 'Forbidden')
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
      assertSuccess(result)
    })

    it('should handle invalid token data', async () => {
      const tokenData = { name: '', scopes: [] }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens', tokenData)
        .reply(400, { error: { message: 'Invalid token data' } })

      const result = await client.postAPIToken('test-org', tokenData)
      assertError(result, 400, 'Invalid token data')
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
      assertSuccess(result)
    })

    it('should handle URL encoding for token ID', async () => {
      const mockResponse = { token: { id: 'token@123' } }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/token%40123/rotate', {})
        .reply(200, mockResponse)

      const result = await client.postAPITokensRotate('test-org', 'token@123')
      assertSuccess(result)
    })

    it('should handle 404 for non-existent token', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/nonexistent/rotate', {})
        .reply(404, { error: { message: 'Token not found' } })

      const result = await client.postAPITokensRotate('test-org', 'nonexistent')
      assertError(result, 404, 'Token not found')
    })
  })

  describe('postAPITokensRevoke', () => {
    it('should revoke an API token', async () => {
      const mockResponse = { success: true, message: 'Token revoked' }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/token-123/revoke', {})
        .reply(200, mockResponse)

      const result = await client.postAPITokensRevoke('test-org', 'token-123')
      assertSuccess(result)
    })

    it('should handle already revoked token', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/tokens/revoked-token/revoke', {})
        .reply(409, { error: { message: 'Token already revoked' } })

      const result = await client.postAPITokensRevoke(
        'test-org',
        'revoked-token',
      )
      assertError(result, 409, 'Token already revoked')
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
      assertSuccess(result)
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
      assertError(result, 400, 'Invalid scope')
    })
  })
})
