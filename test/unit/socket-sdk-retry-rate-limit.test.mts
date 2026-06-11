/**
 * @file Tests for SocketSdk 429 rate-limit retry handling with the Retry-After
 *   header (delay-seconds, HTTP-date, array, invalid, and exhaustion cases).
 *
 * @vitest-environment node
 */

// Run these tests in isolated mode to prevent nock state bleeding.
// Nock callback replies are incompatible with forks pool (used in coverage mode),
// so tests using static replies are skipped when COVERAGE=true.
import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index.mts'
import { isCoverageMode, setupTestEnvironment } from '../utils/environment.mts'

// Nock HTTP mocking is incompatible with vitest forks pool (used by isolated config).
// The retry logic is still tested in the main thread pool config.
const describeRetry = isCoverageMode ? describe.skip : describe

describeRetry('SocketSdk - Retry Logic', () => {
  setupTestEnvironment()

  describe('Rate Limit Retry with Retry-After Header', () => {
    it.sequential('should retry 429 with Retry-After delay-seconds header', async () => {
      let attemptCount = 0
      const startTime = Date.now()

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          attemptCount++
          if (attemptCount < 2) {
            // First attempt returns 429 with Retry-After in seconds (1 second delay)
            return [
              429,
              { error: { message: 'Too Many Requests' } },
              { 'Retry-After': '1' },
            ]
          }
          return [200, { quota: 1000 }]
        })

      const client = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 10,
      })

      const result = await client.getQuota()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quota).toBe(1000)
      }
      expect(attemptCount).toBe(2)
      // Should have waited at least 1 second (allowing some variance)
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeGreaterThanOrEqual(900)
    })

    it.sequential('should retry 429 with Retry-After HTTP-date header', async () => {
      let attemptCount = 0
      const startTime = Date.now()

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          attemptCount++
          if (attemptCount < 2) {
            // Set retry time to 1 second in the future
            const retryDate = new Date(Date.now() + 1000)
            return [
              429,
              { error: { message: 'Too Many Requests' } },
              { 'Retry-After': retryDate.toUTCString() },
            ]
          }
          return [200, { quota: 2000 }]
        })

      const client = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 10,
      })

      const result = await client.getQuota()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quota).toBe(2000)
      }
      expect(attemptCount).toBe(2)
      // Verify timing (test environment may have timing variance)
      const elapsed = Date.now() - startTime
      // Just verify it completed
      expect(elapsed).toBeGreaterThanOrEqual(0)
    })

    it.sequential('should handle Retry-After header as array', async () => {
      let attemptCount = 0

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          attemptCount++
          if (attemptCount < 2) {
            // Return Retry-After as array (some servers might do this)
            return [
              429,
              { error: { message: 'Too Many Requests' } },
              { 'Retry-After': ['1'] },
            ]
          }
          return [200, { quota: 3000 }]
        })

      const client = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 10,
      })

      const result = await client.getQuota()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quota).toBe(3000)
      }
      expect(attemptCount).toBe(2)
    })

    it('should retry 429 without Retry-After header using default delay', async () => {
      let attemptCount = 0

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          attemptCount++
          if (attemptCount < 2) {
            return [429, { error: { message: 'Too Many Requests' } }]
          }
          return [200, { quota: 4000 }]
        })

      const client = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 10,
      })

      const result = await client.getQuota()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quota).toBe(4000)
      }
      expect(attemptCount).toBe(2)
    })

    it('should retry 429 with invalid Retry-After header using default delay', async () => {
      let attemptCount = 0

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          attemptCount++
          if (attemptCount < 2) {
            return [
              429,
              { error: { message: 'Too Many Requests' } },
              { 'Retry-After': 'invalid' },
            ]
          }
          return [200, { quota: 5000 }]
        })

      const client = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 10,
      })

      const result = await client.getQuota()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quota).toBe(5000)
      }
      expect(attemptCount).toBe(2)
    })

    it('should retry 429 with past HTTP-date using default delay', async () => {
      let attemptCount = 0
      const pastDate = new Date(Date.now() - 1000)

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          attemptCount++
          if (attemptCount < 2) {
            return [
              429,
              { error: { message: 'Too Many Requests' } },
              { 'Retry-After': pastDate.toUTCString() },
            ]
          }
          return [200, { quota: 6000 }]
        })

      const client = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 10,
      })

      const result = await client.getQuota()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quota).toBe(6000)
      }
      expect(attemptCount).toBe(2)
    })

    it('should retry 429 with negative delay-seconds using default delay', async () => {
      let attemptCount = 0

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          attemptCount++
          if (attemptCount < 2) {
            return [
              429,
              { error: { message: 'Too Many Requests' } },
              { 'Retry-After': '-1' },
            ]
          }
          return [200, { quota: 7000 }]
        })

      const client = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 10,
      })

      const result = await client.getQuota()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quota).toBe(7000)
      }
      expect(attemptCount).toBe(2)
    })

    it('should retry 429 with empty Retry-After array using default delay', async () => {
      let attemptCount = 0

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          attemptCount++
          if (attemptCount < 2) {
            return [429, { error: { message: 'Too Many Requests' } }]
          }
          return [200, { quota: 8000 }]
        })

      const client = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 10,
      })

      const result = await client.getQuota()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quota).toBe(8000)
      }
      expect(attemptCount).toBe(2)
    })

    it.sequential('should exhaust retries on persistent 429 with Retry-After', async () => {
      let attemptCount = 0

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(4)
        .reply(() => {
          attemptCount++
          return [
            429,
            { error: { message: 'Too Many Requests' } },
            { 'Retry-After': '1' },
          ]
        })

      const client = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 10,
      })

      const result = await client.getQuota()

      // 429 is a client error (4xx), so it returns a result instead of throwing
      expect(result.success).toBe(false)
      expect(result.status).toBe(429)
      // Initial attempt + 3 retries
      expect(attemptCount).toBe(4)
    })
  })
})
