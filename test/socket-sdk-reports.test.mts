import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

describe('Socket SDK - Report Management', () => {
  let client: SocketSdk

  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
    client = new SocketSdk('test-api-token', {
      // Disable retries for network error tests
      retries: 0,
    })
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  describe('deleteReport', () => {
    it('should delete a report successfully', async () => {
      const mockResponse = { success: true }

      nock('https://api.socket.dev')
        .delete('/v0/report/delete/report-123')
        .reply(200, mockResponse)

      const result = await client.deleteReport('report-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle 404 for non-existent report', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/report/delete/nonexistent')
        .reply(404, { error: { message: 'Report not found' } })

      const result = await client.deleteReport('nonexistent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Report not found')
      }
    })

    it('should URL encode report ID', async () => {
      const mockResponse = { success: true }

      nock('https://api.socket.dev')
        .delete('/v0/report/delete/report%40123')
        .reply(200, mockResponse)

      const result = await client.deleteReport('report@123')

      expect(result.success).toBe(true)
    })

    it('should handle server errors by throwing', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/report/delete/server-error')
        .reply(500, { error: { message: 'Internal server error' } })

      await expect(client.deleteReport('server-error')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle network errors by throwing', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/report/delete/network-error')
        .replyWithError('Connection refused')

      await expect(client.deleteReport('network-error')).rejects.toThrow(
        'Unexpected Socket API error',
      )
    })
  })
})
