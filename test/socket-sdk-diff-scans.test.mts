import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

describe('Socket SDK - Diff Scans', () => {
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

  describe('createOrgDiffScanFromIds', () => {
    it('should create diff scan from full scan IDs', async () => {
      const queryParams = { before: 'scan-1', after: 'scan-2' }
      const mockResponse = {
        diff_scan: {
          id: 'diff-456',
          before_full_scan: { id: 'scan-1' },
          after_full_scan: { id: 'scan-2' },
        },
      }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/diff-scans?before=scan-1&after=scan-2', {})
        .reply(200, mockResponse)

      const result = await client.createOrgDiffScanFromIds(
        'test-org',
        queryParams,
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle missing query parameters', async () => {
      const mockResponse = { diff_scan: { id: 'diff-789' } }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/diff-scans?', {})
        .reply(200, mockResponse)

      const result = await client.createOrgDiffScanFromIds('test-org')

      expect(result.success).toBe(true)
    })

    it('should handle invalid scan IDs', async () => {
      const queryParams = { before: 'nonexistent-1', after: 'nonexistent-2' }

      nock('https://api.socket.dev')
        .post(
          '/v0/orgs/test-org/diff-scans?before=nonexistent-1&after=nonexistent-2',
          {},
        )
        .reply(404, { error: { message: 'One or both scans not found' } })

      const result = await client.createOrgDiffScanFromIds(
        'test-org',
        queryParams,
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('One or both scans not found')
      }
    })
  })

  describe('deleteOrgDiffScan', () => {
    it('should delete a diff scan', async () => {
      const mockResponse = { success: true }

      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/diff-scans/diff-123')
        .reply(200, mockResponse)

      const result = await client.deleteOrgDiffScan('test-org', 'diff-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle URL encoding for diff scan ID', async () => {
      const mockResponse = { success: true }

      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/diff-scans/diff%40123')
        .reply(200, mockResponse)

      const result = await client.deleteOrgDiffScan('test-org', 'diff@123')

      expect(result.success).toBe(true)
    })

    it('should handle 404 for non-existent diff scan', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/diff-scans/nonexistent')
        .reply(404, { error: { message: 'Diff scan not found' } })

      const result = await client.deleteOrgDiffScan('test-org', 'nonexistent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Diff scan not found')
      }
    })
  })

  describe('getDiffScanById', () => {
    it('should return diff scan details', async () => {
      const mockDiffScan = {
        diff_scan: {
          id: 'diff-123',
          before_full_scan: { id: 'scan-1' },
          after_full_scan: { id: 'scan-2' },
          artifacts: [
            { purl: 'pkg:npm/test@1.0.0', status: 'added' },
            { purl: 'pkg:npm/old@1.0.0', status: 'removed' },
          ],
        },
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/diff-scans/diff-123')
        .reply(200, mockDiffScan)

      const result = await client.getDiffScanById('test-org', 'diff-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockDiffScan)
      }
    })

    it('should handle empty diff scan results', async () => {
      const mockDiffScan = {
        diff_scan: {
          id: 'diff-empty',
          before_full_scan: { id: 'scan-1' },
          after_full_scan: { id: 'scan-1' },
          artifacts: [],
        },
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/diff-scans/diff-empty')
        .reply(200, mockDiffScan)

      const result = await client.getDiffScanById('test-org', 'diff-empty')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockDiffScan)
      }
    })

    it('should handle URL encoding for organization and diff scan ID', async () => {
      const mockDiffScan = { diff_scan: { id: 'diff@special' } }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/diff-scans/diff%40special')
        .reply(200, mockDiffScan)

      const result = await client.getDiffScanById('test@org', 'diff@special')

      expect(result.success).toBe(true)
    })

    it('should handle 403 unauthorized access', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/forbidden-org/diff-scans/diff-123')
        .reply(403, { error: { message: 'Unauthorized' } })

      const result = await client.getDiffScanById('forbidden-org', 'diff-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Unauthorized')
      }
    })
  })

  describe('listOrgDiffScans', () => {
    it('should return list of diff scans', async () => {
      const mockDiffScans = {
        results: [
          { id: 'diff-1', created_at: '2023-01-01T00:00:00Z' },
          { id: 'diff-2', created_at: '2023-01-02T00:00:00Z' },
        ],
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/diff-scans')
        .reply(200, mockDiffScans)

      const result = await client.listOrgDiffScans('test-org')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockDiffScans)
      }
    })

    it('should handle empty diff scan list', async () => {
      const mockDiffScans = { results: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/empty-org/diff-scans')
        .reply(200, mockDiffScans)

      const result = await client.listOrgDiffScans('empty-org')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockDiffScans)
      }
    })

    it('should handle organization with no diff scans', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/new-org/diff-scans')
        .reply(404, { error: { message: 'No diff scans found' } })

      const result = await client.listOrgDiffScans('new-org')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('No diff scans found')
      }
    })

    it('should handle large lists of diff scans', async () => {
      const largeDiffScanList = {
        results: Array.from({ length: 100 }, (_, i) => ({
          id: `diff-${i}`,
          created_at: `2023-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        })),
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/large-org/diff-scans')
        .reply(200, largeDiffScanList)

      const result = await client.listOrgDiffScans('large-org')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(largeDiffScanList)
        expect(result.data.results).toHaveLength(100)
      }
    })
  })
})
