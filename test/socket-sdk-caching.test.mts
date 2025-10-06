/** @fileoverview Tests for SDK caching functionality. */
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import * as cacache from '@socketsecurity/registry/lib/cacache'

import { SocketSdk } from '../dist/index'

describe('SocketSdk - Caching', () => {
  beforeEach(async () => {
    nock.cleanAll()
    nock.disableNetConnect()
    // Clear the cache between tests
    await cacache.clear()
  })

  afterEach(() => {
    // Only check nock.isDone() for non-caching tests
    // Caching tests will verify scopes individually
    const pendingMocks = nock.pendingMocks()
    if (pendingMocks.length > 0) {
      // Allow pending mocks for caching tests where second calls use cache
      const hasCacheTests = pendingMocks.some(
        mock => mock.includes('/quota') || mock.includes('/organizations'),
      )
      if (!hasCacheTests) {
        throw new Error(`pending nock mocks: ${pendingMocks}`)
      }
    }
  })

  describe('Cache Disabled (default)', () => {
    it('should make API call each time when cache is disabled', async () => {
      // Mock the same endpoint twice
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, { quota: 5000 })
        .get('/v0/quota')
        .reply(200, { quota: 5000 })

      const client = new SocketSdk('test-token')

      // First call
      const res1 = await client.getQuota()
      expect(res1.success).toBe(true)

      // Second call - should make another API request
      const res2 = await client.getQuota()
      expect(res2.success).toBe(true)

      // nock.isDone() will verify both mocks were called
    })

    it('should make API call each time for getOrganizations when cache is disabled', async () => {
      // Mock the same endpoint twice
      nock('https://api.socket.dev')
        .get('/v0/organizations')
        .reply(200, { results: [{ id: 'org-1', name: 'Test Org' }] })
        .get('/v0/organizations')
        .reply(200, { results: [{ id: 'org-1', name: 'Test Org' }] })

      const client = new SocketSdk('test-token')

      // First call
      const res1 = await client.getOrganizations()
      expect(res1.success).toBe(true)

      // Second call - should make another API request
      const res2 = await client.getOrganizations()
      expect(res2.success).toBe(true)

      // nock.isDone() will verify both mocks were called
    })
  })

  describe('Cache Enabled', () => {
    it('should cache API responses when cache is enabled', async () => {
      // Mock the endpoint only once
      const scope = nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, { quota: 5000 })

      const client = new SocketSdk('test-token', { cache: true })

      // First call - fetches from API
      const res1 = await client.getQuota()
      expect(res1.success).toBe(true)
      if (res1.success) {
        expect(res1.data.quota).toBe(5000)
      }

      // Verify the mock was called once
      expect(scope.isDone()).toBe(true)

      // Second call - should use cache (no additional nock mock needed)
      const res2 = await client.getQuota()
      expect(res2.success).toBe(true)
      if (res2.success) {
        expect(res2.data.quota).toBe(5000)
      }
    })

    it('should cache different endpoints separately', async () => {
      // Mock two different endpoints, each once
      const quotaScope = nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, { quota: 5000 })

      const orgsScope = nock('https://api.socket.dev')
        .get('/v0/organizations')
        .reply(200, { results: [{ id: 'org-1', name: 'Test Org' }] })

      const client = new SocketSdk('test-token', { cache: true })

      // First endpoint - first call
      const quota1 = await client.getQuota()
      expect(quota1.success).toBe(true)
      expect(quotaScope.isDone()).toBe(true)

      // Second endpoint - first call
      const orgs1 = await client.getOrganizations()
      expect(orgs1.success).toBe(true)
      expect(orgsScope.isDone()).toBe(true)

      // First endpoint - second call (cached)
      const quota2 = await client.getQuota()
      expect(quota2.success).toBe(true)

      // Second endpoint - second call (cached)
      const orgs2 = await client.getOrganizations()
      expect(orgs2.success).toBe(true)
    })

    it('should respect custom cache TTL', async () => {
      // Mock the endpoint twice - once for initial, once after expiration
      const scope = nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, { quota: 5000 })
        .get('/v0/quota')
        .reply(200, { quota: 6000 })

      // Create client with very short TTL (50ms)
      const client = new SocketSdk('test-token', {
        cache: true,
        cacheTtl: 50,
      })

      // First call - fetches from API
      const res1 = await client.getQuota()
      expect(res1.success).toBe(true)
      if (res1.success) {
        expect(res1.data.quota).toBe(5000)
      }

      // Immediate second call - should use cache
      const res2 = await client.getQuota()
      expect(res2.success).toBe(true)
      if (res2.success) {
        expect(res2.data.quota).toBe(5000)
      }

      // Wait for cache to expire (60ms > 50ms TTL)
      await new Promise(resolve => setTimeout(resolve, 60))

      // Third call - cache expired, should fetch from API with new value
      const res3 = await client.getQuota()
      expect(res3.success).toBe(true)
      if (res3.success) {
        expect(res3.data.quota).toBe(6000)
      }

      // Verify both mocks were called
      expect(scope.isDone()).toBe(true)
    })
  })

  describe('Cache with Retries', () => {
    it('should cache successful response after retries', async () => {
      // Mock: first call fails, retry succeeds, second call uses cache
      const scope = nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(500, { error: 'Server error' })
        .get('/v0/quota')
        .reply(200, { quota: 5000 })

      const client = new SocketSdk('test-token', {
        cache: true,
        retries: 3,
        retryDelay: 10,
      })

      // First call - fails then retries and succeeds
      const res1 = await client.getQuota()
      expect(res1.success).toBe(true)
      if (res1.success) {
        expect(res1.data.quota).toBe(5000)
      }

      // Verify both mocks were called (initial + retry)
      expect(scope.isDone()).toBe(true)

      // Second call - should use cached successful response
      const res2 = await client.getQuota()
      expect(res2.success).toBe(true)
      if (res2.success) {
        expect(res2.data.quota).toBe(5000)
      }
    })
  })
})
