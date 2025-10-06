/** @fileoverview Tests for SBOM export functionality in CycloneDX and SPDX formats. */
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

describe('Socket SDK - SBOM Export', () => {
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

  describe('exportCDX', () => {
    it('should export CycloneDX SBOM successfully', async () => {
      const mockSBOM = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        serialNumber: 'urn:uuid:test-123',
        version: 1,
        components: [],
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/sbom/export/cdx')
        .reply(200, mockSBOM)

      const result = await client.exportCDX('test-org', 'scan-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockSBOM)
      }
    })

    it('should handle URL encoding for org slug and scan ID', async () => {
      const mockSBOM = { bomFormat: 'CycloneDX', components: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/full-scans/scan%23123/sbom/export/cdx')
        .reply(200, mockSBOM)

      const result = await client.exportCDX('test@org', 'scan#123')

      expect(result.success).toBe(true)
    })

    it('should handle 403 unauthorized access', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/unauthorized-org/full-scans/scan-123/sbom/export/cdx')
        .reply(403, { error: { message: 'Unauthorized' } })

      const result = await client.exportCDX('unauthorized-org', 'scan-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Unauthorized')
      }
    })

    it('should handle network errors by throwing', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/error-org/full-scans/scan-123/sbom/export/cdx')
        .replyWithError('Network timeout')

      await expect(client.exportCDX('error-org', 'scan-123')).rejects.toThrow(
        'Unexpected Socket API error',
      )
    })
  })

  describe('exportSPDX', () => {
    it('should export SPDX SBOM successfully', async () => {
      const mockSBOM = {
        spdxVersion: 'SPDX-2.3',
        dataLicense: 'CC0-1.0',
        SPDXID: 'SPDXRef-DOCUMENT',
        name: 'test-scan',
        packages: [],
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/sbom/export/spdx')
        .reply(200, mockSBOM)

      const result = await client.exportSPDX('test-org', 'scan-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockSBOM)
      }
    })

    it('should handle URL encoding for parameters', async () => {
      const mockSBOM = { spdxVersion: 'SPDX-2.3', packages: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/full-scans/scan%2B456/sbom/export/spdx')
        .reply(200, mockSBOM)

      const result = await client.exportSPDX('test@org', 'scan+456')

      expect(result.success).toBe(true)
    })

    it('should handle network errors by throwing', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/error-org/full-scans/scan-123/sbom/export/spdx')
        .replyWithError('Network timeout')

      await expect(client.exportSPDX('error-org', 'scan-123')).rejects.toThrow(
        'Unexpected Socket API error',
      )
    })

    it('should handle 404 scan not found', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/nonexistent/sbom/export/spdx')
        .reply(404, { error: { message: 'Full scan not found' } })

      const result = await client.exportSPDX('test-org', 'nonexistent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Full scan not found')
      }
    })
  })
})
