/** @fileoverview Tests for alert triage status management operations. */
import nock from 'nock'
import { beforeEach, describe, expect, it } from 'vitest'

import type { SocketSdk } from '../dist/index'

import { assertError, assertSuccess } from './utils/assertions.mts'
import { createTestClient, setupTestEnvironment } from './utils/environment.mts'

describe('Socket SDK - Alert Triage', () => {
  setupTestEnvironment()

  let client: SocketSdk

  beforeEach(() => {
    client = createTestClient()
  })

  describe('getOrgTriage', () => {
    it('should return organization triage settings', async () => {
      const mockTriage = {
        settings: { autoTriage: true },
        alerts: [
          { id: 'alert-1', status: 'open', severity: 'high' },
          { id: 'alert-2', status: 'resolved', severity: 'medium' },
        ],
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/triage')
        .reply(200, mockTriage)

      const result = await client.getOrgTriage('test-org')
      assertSuccess(result)
    })

    it('should handle empty triage settings', async () => {
      const mockTriage = { settings: {}, alerts: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/empty-org/triage')
        .reply(200, mockTriage)

      const result = await client.getOrgTriage('empty-org')
      assertSuccess(result)
    })

    it('should handle URL encoding for organization slug', async () => {
      const mockTriage = { settings: {}, alerts: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/triage')
        .reply(200, mockTriage)

      const result = await client.getOrgTriage('test@org')
      assertSuccess(result)
    })

    it('should handle malformed JSON responses by throwing', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/malformed/triage')
        .reply(200, 'invalid json{')

      await expect(client.getOrgTriage('malformed')).rejects.toThrow(
        'Unexpected Socket API error',
      )
    })
  })

  describe('updateOrgAlertTriage', () => {
    it('should update alert triage status', async () => {
      const triageData = { status: 'resolved', reason: 'False positive' }
      const mockResponse = {
        alert: { id: 'alert-123', status: 'resolved' },
      }

      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/triage/alert-123', triageData)
        .reply(200, mockResponse)

      const result = await client.updateOrgAlertTriage(
        'test-org',
        'alert-123',
        triageData,
      )
      assertSuccess(result)
    })

    it('should handle URL encoding for alert ID', async () => {
      const triageData = { status: 'resolved' }
      const mockResponse = { alert: { id: 'alert@123', status: 'resolved' } }

      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/triage/alert%40123', triageData)
        .reply(200, mockResponse)

      const result = await client.updateOrgAlertTriage(
        'test-org',
        'alert@123',
        triageData,
      )
      assertSuccess(result)
    })

    it('should handle invalid triage status', async () => {
      const triageData = { status: 'invalid-status' }

      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/triage/alert-123', triageData)
        .reply(400, { error: { message: 'Invalid triage status' } })

      const result = await client.updateOrgAlertTriage(
        'test-org',
        'alert-123',
        triageData,
      )
      assertError(result, 400, 'Invalid triage status')
    })

    it('should handle 404 for non-existent alert', async () => {
      const triageData = { status: 'resolved' }

      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/triage/nonexistent', triageData)
        .reply(404, { error: { message: 'Alert not found' } })

      const result = await client.updateOrgAlertTriage(
        'test-org',
        'nonexistent',
        triageData,
      )
      assertError(result, 404, 'Alert not found')
    })
  })
})
