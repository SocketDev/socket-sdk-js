/** @fileoverview Tests for new Socket SDK API methods added in v3.3.0. */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../utils/environment.mts'

describe('Socket SDK - New API Methods (v3.3.0)', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  describe('batchOrgPackageFetch', () => {
    it('should fetch packages by PURL for organization', async () => {
      const mockResponse = [
        {
          id: 'pkg:npm/express@4.19.2',
          name: 'express',
          version: '4.19.2',
          type: 'npm',
        },
        {
          id: 'pkg:pypi/django@5.0.6',
          name: 'django',
          version: '5.0.6',
          type: 'pypi',
        },
      ]

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/purl?alerts=true&labels=production')
        .reply(200, mockResponse.map(item => JSON.stringify(item)).join('\n'))

      const result = await getClient().batchOrgPackageFetch(
        'test-org',
        {
          components: [
            { purl: 'pkg:npm/express@4.19.2' },
            { purl: 'pkg:pypi/django@5.0.6' },
          ],
        },
        {
          alerts: 'true',
          labels: ['production'],
        },
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)

        expect((result.data as any[])[0].name).toBe('express')

        expect((result.data as any[])[1].name).toBe('django')
      }
    })

    it('should handle error responses for batchOrgPackageFetch', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/purl')
        .reply(400, { error: { message: 'Invalid request' } })

      const result = await getClient().batchOrgPackageFetch('test-org', {
        components: [{ purl: 'invalid-purl' }],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    it('should handle compact mode', async () => {
      const mockResponse = [
        {
          id: 'pkg:npm/express@4.19.2',
          name: 'express',
          version: '4.19.2',
          type: 'npm',
        },
      ]

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/purl?compact=true')
        .reply(200, mockResponse.map(item => JSON.stringify(item)).join('\n'))

      const result = await getClient().batchOrgPackageFetch(
        'test-org',
        {
          components: [{ purl: 'pkg:npm/express@4.19.2' }],
        },
        {
          compact: 'true',
        },
      )

      expect(result.success).toBe(true)
    })
  })

  describe('rescanFullScan', () => {
    it('should rescan with shallow mode (default)', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans/scan_123/rescan')
        .reply(201, {
          id: 'scan_456',
          status: 'processing',
        })

      const result = await getClient().rescanFullScan('test-org', 'scan_123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('scan_456')
        expect(result.data.status).toBe('processing')
      }
    })

    it('should rescan with deep mode', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans/scan_123/rescan?mode=deep')
        .reply(201, {
          id: 'scan_789',
          status: 'processing',
        })

      const result = await getClient().rescanFullScan('test-org', 'scan_123', {
        mode: 'deep',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('scan_789')
        expect(result.data.status).toBe('processing')
      }
    })

    it('should handle error responses for rescanFullScan', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans/invalid_scan/rescan')
        .reply(404, { error: { message: 'Scan not found' } })

      const result = await getClient().rescanFullScan(
        'test-org',
        'invalid_scan',
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('exportOpenVEX', () => {
    it('should export OpenVEX document', async () => {
      const mockVexDoc = {
        '@context': 'https://openvex.dev/ns/v0.2.0',
        '@id': 'https://socket.dev/vex/test-org/scan-123',
        author: 'Socket Security',
        timestamp: '2026-01-25T00:00:00Z',
        version: 1,
        statements: [
          {
            vulnerability: {
              name: 'CVE-2021-23337',
              '@id': 'https://nvd.nist.gov/vuln/detail/CVE-2021-23337',
            },
            products: [
              {
                '@id': 'pkg:npm/lodash@4.17.20',
              },
            ],
            status: 'affected',
          },
        ],
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/export/openvex/scan-123')
        .reply(200, mockVexDoc)

      const result = await getClient().exportOpenVEX('test-org', 'scan-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as any).version).toBe(1)

        expect((result.data as any).statements).toHaveLength(1)

        expect((result.data as any).statements?.[0].status).toBe('affected')
      }
    })

    it('should export OpenVEX with custom author and role', async () => {
      const mockVexDoc = {
        '@context': 'https://openvex.dev/ns/v0.2.0',
        '@id': 'https://socket.dev/vex/test-org/scan-123',
        author: 'Security Team',
        role: 'VEX Generator',
        timestamp: '2026-01-25T00:00:00Z',
        version: 1,
        statements: [],
      }

      nock('https://api.socket.dev')
        .get(
          '/v0/orgs/test-org/export/openvex/scan-123?author=Security%20Team&role=VEX%20Generator',
        )
        .reply(200, mockVexDoc)

      const result = await getClient().exportOpenVEX('test-org', 'scan-123', {
        author: 'Security Team',
        role: 'VEX Generator',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as any).author).toBe('Security Team')

        expect((result.data as any).role).toBe('VEX Generator')
      }
    })

    it('should handle error responses for exportOpenVEX', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/export/openvex/invalid-scan')
        .reply(404, { error: { message: 'Scan not found' } })

      const result = await getClient().exportOpenVEX('test-org', 'invalid-scan')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('getOrgAlertFullScans', () => {
    it('should list full scans associated with alert', async () => {
      const mockResponse = {
        endCursor: 'cursor-123',
        items: [
          {
            fullScanId: 'scan_abc',
            branchName: 'main',
            repoFullName: 'my-org/my-repo',
          },
          {
            fullScanId: 'scan_def',
            branchName: 'develop',
            repoFullName: 'my-org/my-repo',
          },
        ],
      }

      nock('https://api.socket.dev')
        .get(
          '/v0/orgs/test-org/alert-full-scan-search?alertKey=npm%2Flodash%2Fcve-2021-23337&per_page=50',
        )
        .reply(200, mockResponse)

      const result = await getClient().getOrgAlertFullScans('test-org', {
        alertKey: 'npm/lodash/cve-2021-23337',
        per_page: 50,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as any).items).toHaveLength(2)

        expect((result.data as any).items?.[0].fullScanId).toBe('scan_abc')

        expect((result.data as any).endCursor).toBe('cursor-123')
      }
    })

    it('should list full scans with date range filter', async () => {
      const mockResponse = {
        endCursor: null,
        items: [
          {
            fullScanId: 'scan_xyz',
            branchName: 'main',
            repoFullName: 'my-org/my-repo',
          },
        ],
      }

      nock('https://api.socket.dev')
        .get(
          '/v0/orgs/test-org/alert-full-scan-search?alertKey=npm%2Fexpress%2Fcve-2024-12345&range=-7d',
        )
        .reply(200, mockResponse)

      const result = await getClient().getOrgAlertFullScans('test-org', {
        alertKey: 'npm/express/cve-2024-12345',
        range: '-7d',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as any).items).toHaveLength(1)

        expect((result.data as any).endCursor).toBeNull()
      }
    })

    it('should handle pagination with cursor', async () => {
      const mockResponse = {
        endCursor: 'cursor-456',
        items: [
          {
            fullScanId: 'scan_page2',
            branchName: 'feature',
            repoFullName: 'my-org/my-repo',
          },
        ],
      }

      nock('https://api.socket.dev')
        .get(
          '/v0/orgs/test-org/alert-full-scan-search?alertKey=test-alert&startAfterCursor=cursor-123',
        )
        .reply(200, mockResponse)

      const result = await getClient().getOrgAlertFullScans('test-org', {
        alertKey: 'test-alert',
        startAfterCursor: 'cursor-123',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as any).endCursor).toBe('cursor-456')
      }
    })

    it('should handle error responses for getOrgAlertFullScans', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/alert-full-scan-search?alertKey=invalid-alert')
        .reply(400, { error: { message: 'Invalid alert key' } })

      const result = await getClient().getOrgAlertFullScans('test-org', {
        alertKey: 'invalid-alert',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })
})
