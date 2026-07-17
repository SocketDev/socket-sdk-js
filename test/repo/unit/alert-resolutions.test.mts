/**
 * @file Tests for the org alert-resolution SDK methods
 *   (getOrgAlertResolutions, getOrgAlertResolution, deleteOrgAlertResolution).
 *   Asserts exact request paths, query-string encoding, and success/error
 *   result shapes.
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../../utils/environment.mts'

const API = 'https://api.socket.dev'

describe('SocketSdk - alert resolutions', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  describe('getOrgAlertResolutions', () => {
    it('GETs orgs/{org}/alerts/resolutions with no query when options are omitted', async () => {
      nock(API)
        .get('/v0/orgs/test-org/alerts/resolutions')
        .reply(200, { endCursor: undefined, items: [] })

      const result = await getClient().getOrgAlertResolutions('test-org')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toEqual([])
      }
    })

    it('GETs orgs/{org}/alerts/resolutions with the query params encoded', async () => {
      nock(API)
        .get('/v0/orgs/test-org/alerts/resolutions')
        .query({ direction: 'asc', per_page: '10', startAfterCursor: 'abc' })
        .reply(200, {
          endCursor: 'def',
          items: [
            {
              alert_type: 'criticalCVE',
              artifact_name: undefined,
              artifact_namespace: undefined,
              artifact_type: undefined,
              artifact_version: undefined,
              comment: undefined,
              created_at: '2026-01-01T00:00:00Z',
              reason: 'false_positive',
              reason_text: undefined,
              repo: undefined,
              repo_label: undefined,
              resolved_by: undefined,
              updated_at: '2026-01-01T00:00:00Z',
              uuid: 'resolution-1',
            },
          ],
        })

      const result = await getClient().getOrgAlertResolutions('test-org', {
        direction: 'asc',
        per_page: 10,
        startAfterCursor: 'abc',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(1)
        expect(result.data.items[0]!.uuid).toBe('resolution-1')
        expect(result.data.endCursor).toBe('def')
      }
    })

    it('encodes the org slug in the request path', async () => {
      nock(API)
        .get('/v0/orgs/test%2Forg/alerts/resolutions')
        .reply(200, { endCursor: undefined, items: [] })

      const result = await getClient().getOrgAlertResolutions('test/org')

      expect(result.success).toBe(true)
    })

    it('returns an error result on 403', async () => {
      nock(API)
        .get('/v0/orgs/test-org/alerts/resolutions')
        .reply(403, {
          error: { message: 'missing scope alert-resolution:list' },
        })

      const result = await getClient().getOrgAlertResolutions('test-org')

      expect(result.success).toBe(false)
      expect(result.status).toBe(403)
    })
  })

  describe('getOrgAlertResolution', () => {
    it('GETs orgs/{org}/alerts/resolutions/{uuid}', async () => {
      nock(API)
        .get('/v0/orgs/test-org/alerts/resolutions/resolution-1')
        .reply(200, {
          alert_type: undefined,
          artifact_name: undefined,
          artifact_namespace: undefined,
          artifact_type: undefined,
          artifact_version: undefined,
          comment: 'known false positive',
          created_at: '2026-01-01T00:00:00Z',
          reason: 'false_positive',
          reason_text: undefined,
          repo: undefined,
          repo_label: undefined,
          resolved_by: undefined,
          updated_at: '2026-01-01T00:00:00Z',
          uuid: 'resolution-1',
        })

      const result = await getClient().getOrgAlertResolution(
        'test-org',
        'resolution-1',
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.uuid).toBe('resolution-1')
        expect(result.data.comment).toBe('known false positive')
      }
    })

    it('encodes the org slug and uuid in the request path', async () => {
      nock(API)
        .get('/v0/orgs/test%2Forg/alerts/resolutions/res%2F1')
        .reply(200, {
          alert_type: undefined,
          artifact_name: undefined,
          artifact_namespace: undefined,
          artifact_type: undefined,
          artifact_version: undefined,
          comment: undefined,
          created_at: '2026-01-01T00:00:00Z',
          reason: 'other',
          reason_text: undefined,
          repo: undefined,
          repo_label: undefined,
          resolved_by: undefined,
          updated_at: '2026-01-01T00:00:00Z',
          uuid: 'res/1',
        })

      const result = await getClient().getOrgAlertResolution(
        'test/org',
        'res/1',
      )

      expect(result.success).toBe(true)
    })

    it('returns an error result on 404', async () => {
      nock(API)
        .get('/v0/orgs/test-org/alerts/resolutions/missing')
        .reply(404, { error: { message: 'not found' } })

      const result = await getClient().getOrgAlertResolution(
        'test-org',
        'missing',
      )

      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
    })
  })

  describe('deleteOrgAlertResolution', () => {
    it('issues a DELETE against orgs/{org}/alerts/resolutions/{uuid}', async () => {
      nock(API)
        .intercept(
          '/v0/orgs/test-org/alerts/resolutions/resolution-1',
          'DELETE',
        )
        .reply(200, { result: 'ok' })

      const result = await getClient().deleteOrgAlertResolution(
        'test-org',
        'resolution-1',
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.result).toBe('ok')
      }
    })

    it('encodes the org slug and uuid in the request path', async () => {
      nock(API)
        .intercept('/v0/orgs/test%2Forg/alerts/resolutions/res%2F1', 'DELETE')
        .reply(200, { result: 'ok' })

      const result = await getClient().deleteOrgAlertResolution(
        'test/org',
        'res/1',
      )

      expect(result.success).toBe(true)
    })

    it('returns an error result on 403', async () => {
      nock(API)
        .intercept(
          '/v0/orgs/test-org/alerts/resolutions/resolution-1',
          'DELETE',
        )
        .reply(403, {
          error: { message: 'missing scope alert-resolution:delete' },
        })

      const result = await getClient().deleteOrgAlertResolution(
        'test-org',
        'resolution-1',
      )

      expect(result.success).toBe(false)
      expect(result.status).toBe(403)
    })
  })
})
