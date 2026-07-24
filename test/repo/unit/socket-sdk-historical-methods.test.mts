/**
 * @file Tests for the historical/analytics Socket SDK methods added for
 *   SURF-195 API parity.
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../../utils/environment.mts'

describe('Socket SDK - Historical & analytics methods (SURF-195)', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  describe('historicalAlertsList', () => {
    it('should list historical alerts with filters and pagination', async () => {
      const mockResponse = {
        endCursor: 'cursor-1',
        results: [
          { id: 'alert-1', alertType: 'malware', repoSlug: 'my-repo' },
          { id: 'alert-2', alertType: 'gptSecurity', repoSlug: 'my-repo' },
        ],
      }

      nock('https://api.socket.dev')
        .get(
          '/v0/orgs/test-org/historical/alerts?range=-7d&per_page=50&filters.alertSeverity=high',
        )
        .reply(200, mockResponse)

      const result = await getClient().historicalAlertsList('test-org', {
        range: '-7d',
        per_page: 50,
        'filters.alertSeverity': 'high',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        const page = result.data as unknown as {
          endCursor: string
          results: unknown[]
        }
        expect(page.endCursor).toBe('cursor-1')
        expect(page.results).toHaveLength(2)
      }
    })

    it('should handle error responses for historicalAlertsList', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/historical/alerts')
        .reply(403, { error: { message: 'Insufficient permissions' } })

      const result = await getClient().historicalAlertsList('test-org')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('historicalAlertsTrend', () => {
    it('should return a historical alerts trend', async () => {
      const mockResponse = {
        results: [
          { date: '2026-07-01', count: 10 },
          { date: '2026-07-02', count: 12 },
        ],
      }

      nock('https://api.socket.dev')
        .get(
          '/v0/orgs/test-org/historical/alerts/trend?range=-30d&aggregation.fields=alertSeverity',
        )
        .reply(200, mockResponse)

      const result = await getClient().historicalAlertsTrend('test-org', {
        range: '-30d',
        'aggregation.fields': 'alertSeverity',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        const trend = result.data as unknown as { results: unknown[] }
        expect(trend.results).toHaveLength(2)
      }
    })

    it('should handle error responses for historicalAlertsTrend', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/historical/alerts/trend')
        .reply(400, { error: { message: 'Invalid range' } })

      const result = await getClient().historicalAlertsTrend('test-org')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('historicalDependenciesTrend', () => {
    it('should return a historical dependencies trend', async () => {
      const mockResponse = {
        results: [{ date: '2026-07-01', count: 100 }],
      }

      nock('https://api.socket.dev')
        .get(
          '/v0/orgs/test-org/historical/dependencies/trend?range=-30d&dependencyDirect=true',
        )
        .reply(200, mockResponse)

      const result = await getClient().historicalDependenciesTrend('test-org', {
        range: '-30d',
        dependencyDirect: true,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        const trend = result.data as unknown as { results: unknown[] }
        expect(trend.results).toHaveLength(1)
      }
    })

    it('should handle error responses for historicalDependenciesTrend', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/historical/dependencies/trend')
        .reply(404, { error: { message: 'Not found' } })

      const result = await getClient().historicalDependenciesTrend('test-org')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('historicalSnapshotsList', () => {
    it('should list historical snapshots', async () => {
      const mockResponse = {
        endCursor: null,
        results: [{ requestId: 'req-1', status: 'completed' }],
      }

      nock('https://api.socket.dev')
        .get(
          '/v0/orgs/test-org/historical/snapshots?per_page=25&filters.status=completed',
        )
        .reply(200, mockResponse)

      const result = await getClient().historicalSnapshotsList('test-org', {
        per_page: 25,
        'filters.status': 'completed',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        const page = result.data as unknown as { results: unknown[] }
        expect(page.results).toHaveLength(1)
      }
    })

    it('should handle error responses for historicalSnapshotsList', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/historical/snapshots')
        .reply(401, { error: { message: 'Unauthorized' } })

      const result = await getClient().historicalSnapshotsList('test-org')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('historicalSnapshotsStart', () => {
    it('should start a historical snapshot', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/historical/snapshots')
        .reply(200, { requestId: 'req-42', status: 'started' })

      const result = await getClient().historicalSnapshotsStart('test-org')

      expect(result.success).toBe(true)
      if (result.success) {
        const data = result.data as unknown as { requestId: string }
        expect(data.requestId).toBe('req-42')
      }
    })

    it('should handle error responses for historicalSnapshotsStart', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/historical/snapshots')
        .reply(429, { error: { message: 'Rate limited' } })

      const result = await getClient().historicalSnapshotsStart('test-org')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })
})
