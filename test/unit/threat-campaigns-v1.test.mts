/**
 * @file Tests for the v1 threat-campaigns SocketSdk methods
 *   (listThreatCampaigns, getThreatCampaign, listThreatCampaignPackages).
 */
import nock from 'nock'
import { describe, expect, it } from 'vitest'

import {
  createTestClient,
  setupNockEnvironment,
} from '../utils/environment.mts'

describe('threat-campaigns-v1', () => {
  setupNockEnvironment()

  describe('SocketSdk#listThreatCampaigns', () => {
    it('returns a 200 success result with items and endCursor', async () => {
      nock('https://api.socket.dev')
        .get('/v1/orgs/test-org/threat-campaigns')
        .reply(200, {
          endCursor: 'cursor-2',
          items: [
            {
              blogUrls: ['https://socket.dev/blog/campaign-1'],
              description: 'A supply chain attack campaign.',
              ecosystem: ['npm'],
              firstDiscovered: '2026-01-01T00:00:00.000Z',
              id: 'campaign-1',
              lastActivity: '2026-01-02T00:00:00.000Z',
              name: 'Campaign One',
              status: 'ongoing',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          ],
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.listThreatCampaigns('test-org')

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      if (result.success) {
        expect(result.data.items).toHaveLength(1)
        expect(result.data.items[0]!.id).toBe('campaign-1')
        expect(result.data.endCursor).toBe('cursor-2')
      }
    })

    it('sends status, ecosystem, updated_after, per_page, and cursor as query params', async () => {
      nock('https://api.socket.dev')
        .get('/v1/orgs/test-org/threat-campaigns')
        .query({
          cursor: 'cursor-1',
          ecosystem: 'npm',
          per_page: '10',
          status: 'past',
          updated_after: '1700000000',
        })
        .reply(200, { items: [] })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.listThreatCampaigns('test-org', {
        cursor: 'cursor-1',
        ecosystem: 'npm',
        per_page: 10,
        status: 'past',
        updated_after: '1700000000',
      })

      expect(result.success).toBe(true)
    })

    it('returns a 403 error result', async () => {
      nock('https://api.socket.dev')
        .get('/v1/orgs/test-org/threat-campaigns')
        .reply(403, {
          error: 'Forbidden',
          message:
            'Threat campaigns are not enabled for this organization. Please contact sales for information on enabling this feature.',
          statusCode: 403,
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.listThreatCampaigns('test-org')

      expect(result.success).toBe(false)
      expect(result.status).toBe(403)
    })

    it('fails closed with no network call when the v1 base URL is underivable', async () => {
      const client = createTestClient('test-api-token', {
        baseUrl: 'https://example.com/api/',
        retries: 0,
      })

      const result = await client.listThreatCampaigns('test-org')

      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.error).toContain('v1')
    })
  })

  describe('SocketSdk#getThreatCampaign', () => {
    it('returns a 200 success result for a single campaign', async () => {
      nock('https://api.socket.dev')
        .get('/v1/orgs/test-org/threat-campaigns/campaign-1')
        .reply(200, {
          blogUrls: [],
          description: 'A supply chain attack campaign.',
          // oxlint-disable-next-line socket/prefer-undefined-over-null -- wire data: the API returns null for a campaign with no recorded ecosystem.
          ecosystem: null,
          // oxlint-disable-next-line socket/prefer-undefined-over-null -- wire data: the API returns null for a campaign with no recorded first-discovered date.
          firstDiscovered: null,
          id: 'campaign-1',
          // oxlint-disable-next-line socket/prefer-undefined-over-null -- wire data: the API returns null for a campaign with no recorded last-activity date.
          lastActivity: null,
          name: 'Campaign One',
          status: 'past',
          updatedAt: '2026-01-02T00:00:00.000Z',
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.getThreatCampaign('test-org', 'campaign-1')

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      if (result.success) {
        expect(result.data.id).toBe('campaign-1')
        expect(result.data.ecosystem).toBeNull()
      }
    })

    it('encodeURIComponent-escapes the org slug and campaign id', async () => {
      nock('https://api.socket.dev')
        .get('/v1/orgs/test-org/threat-campaigns/campaign%2Fwith%2Fslashes')
        .reply(200, {
          blogUrls: [],
          description: 'x',
          // oxlint-disable-next-line socket/prefer-undefined-over-null -- wire data: the API returns null for a campaign with no recorded ecosystem.
          ecosystem: null,
          // oxlint-disable-next-line socket/prefer-undefined-over-null -- wire data: the API returns null for a campaign with no recorded first-discovered date.
          firstDiscovered: null,
          id: 'campaign/with/slashes',
          // oxlint-disable-next-line socket/prefer-undefined-over-null -- wire data: the API returns null for a campaign with no recorded last-activity date.
          lastActivity: null,
          name: 'x',
          status: 'ongoing',
          updatedAt: '2026-01-02T00:00:00.000Z',
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.getThreatCampaign(
        'test-org',
        'campaign/with/slashes',
      )

      expect(result.success).toBe(true)
    })

    it('returns a 404 error result', async () => {
      nock('https://api.socket.dev')
        .get('/v1/orgs/test-org/threat-campaigns/missing')
        .reply(404, {
          error: 'Not Found',
          message: 'Campaign not found',
          statusCode: 404,
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.getThreatCampaign('test-org', 'missing')

      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })

    it('fails closed with no network call when the v1 base URL is underivable', async () => {
      const client = createTestClient('test-api-token', {
        baseUrl: 'https://example.com/api/',
        retries: 0,
      })

      const result = await client.getThreatCampaign('test-org', 'campaign-1')

      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.error).toContain('v1')
    })
  })

  describe('SocketSdk#listThreatCampaignPackages', () => {
    it('returns a 200 success result with items and endCursor', async () => {
      nock('https://api.socket.dev')
        .get('/v1/orgs/test-org/threat-campaigns/campaign-1/packages')
        .reply(200, {
          // oxlint-disable-next-line socket/prefer-undefined-over-null -- wire data: the API returns null for an exhausted pagination cursor.
          endCursor: null,
          items: ['pkg:npm/lodash@4.17.21', 'pkg:npm/left-pad@1.0.0'],
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.listThreatCampaignPackages(
        'test-org',
        'campaign-1',
      )

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      if (result.success) {
        expect(result.data.items).toEqual([
          'pkg:npm/lodash@4.17.21',
          'pkg:npm/left-pad@1.0.0',
        ])
        expect(result.data.endCursor).toBeNull()
      }
    })

    it('sends per_page and cursor as query params', async () => {
      nock('https://api.socket.dev')
        .get('/v1/orgs/test-org/threat-campaigns/campaign-1/packages')
        .query({ cursor: 'cursor-1', per_page: '50' })
        .reply(200, { items: [] })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.listThreatCampaignPackages(
        'test-org',
        'campaign-1',
        { cursor: 'cursor-1', per_page: 50 },
      )

      expect(result.success).toBe(true)
    })

    it('returns a 400 error result for an invalid cursor', async () => {
      nock('https://api.socket.dev')
        .get('/v1/orgs/test-org/threat-campaigns/campaign-1/packages')
        .query({ cursor: 'not-a-real-cursor' })
        .reply(400, {
          error: 'Bad Request',
          message: 'Invalid cursor',
          statusCode: 400,
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.listThreatCampaignPackages(
        'test-org',
        'campaign-1',
        { cursor: 'not-a-real-cursor' },
      )

      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
    })

    it('fails closed with no network call when the v1 base URL is underivable', async () => {
      const client = createTestClient('test-api-token', {
        baseUrl: 'https://example.com/api/',
        retries: 0,
      })

      const result = await client.listThreatCampaignPackages(
        'test-org',
        'campaign-1',
      )

      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.error).toContain('v1')
    })
  })
})
