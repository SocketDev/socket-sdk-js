/** @fileoverview Tests for SBOM export functionality in CycloneDX and SPDX formats. */
import nock from 'nock'
import { beforeEach, describe, expect, it } from 'vitest'

import { assertError, assertSuccess } from './utils/assertions.mts'
import { createTestClient, isCoverageMode, setupTestEnvironment } from './utils/environment.mts'

import type { SocketSdk } from '../src/index'

describe.skipIf(isCoverageMode)('Socket SDK - SBOM Export', () => {
  setupTestEnvironment()

  let client: SocketSdk

  beforeEach(() => {
    client = createTestClient('test-api-token', { retries: 0 })
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
      assertSuccess(result)
    })

    it('should handle URL encoding for org slug and scan ID', async () => {
      const mockSBOM = { bomFormat: 'CycloneDX', components: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/full-scans/scan%23123/sbom/export/cdx')
        .reply(200, mockSBOM)

      const result = await client.exportCDX('test@org', 'scan#123')
      assertSuccess(result)
    })

    it('should handle 403 unauthorized access', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/unauthorized-org/full-scans/scan-123/sbom/export/cdx')
        .reply(403, { error: { message: 'Unauthorized' } })

      const result = await client.exportCDX('unauthorized-org', 'scan-123')
      assertError(result, 403, 'Unauthorized')
    })

    it('should handle network errors by throwing', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/error-org/full-scans/scan-123/sbom/export/cdx')
        .replyWithError('Network timeout')

      await expect(client.exportCDX('error-org', 'scan-123')).rejects.toThrow(
        'Unexpected Socket API error',
      )
    })

    it('should handle server errors by throwing', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/sbom/export/cdx')
        .reply(500, { error: { message: 'Internal server error' } })

      await expect(client.exportCDX('test-org', 'scan-123')).rejects.toThrow(
        'Socket API server error (500)',
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
      assertSuccess(result)
    })

    it('should handle URL encoding for parameters', async () => {
      const mockSBOM = { spdxVersion: 'SPDX-2.3', packages: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/full-scans/scan%2B456/sbom/export/spdx')
        .reply(200, mockSBOM)

      const result = await client.exportSPDX('test@org', 'scan+456')
      assertSuccess(result)
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
      assertError(result, 404, 'Full scan not found')
    })

    it('should handle server errors by throwing', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/sbom/export/spdx')
        .reply(500, { error: { message: 'Internal server error' } })

      await expect(client.exportSPDX('test-org', 'scan-123')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })
  })
})
