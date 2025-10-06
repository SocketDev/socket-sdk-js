/** @fileoverview Tests for alert triage status management operations. */
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

describe('Socket SDK - Alert Triage', () => {
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

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockTriage)
      }
    })

    it('should handle empty triage settings', async () => {
      const mockTriage = { settings: {}, alerts: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/empty-org/triage')
        .reply(200, mockTriage)

      const result = await client.getOrgTriage('empty-org')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockTriage)
      }
    })

    it('should handle URL encoding for organization slug', async () => {
      const mockTriage = { settings: {}, alerts: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/triage')
        .reply(200, mockTriage)

      const result = await client.getOrgTriage('test@org')

      expect(result.success).toBe(true)
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

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
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

      expect(result.success).toBe(true)
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

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid triage status')
      }
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

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Alert not found')
      }
    })
  })
})
