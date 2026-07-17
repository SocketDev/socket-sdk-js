/**
 * @file Contract tests pinning each SDK method to its exact Socket API path.
 *   These assert the precise request path (nock throws on any mismatch),
 *   guarding against path regressions that loose `url.includes()` interceptors
 *   would miss. Paths are verified against the depscan api-v0 route
 *   definitions.
 */

import os from 'node:os'
import path from 'node:path'

import nock from 'nock'
import { afterEach, describe, expect, it } from 'vitest'

import { setupTestClient } from '../../utils/environment.mts'

const API = 'https://api.socket.dev'

describe('SocketSdk - endpoint path contracts', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('API tokens', () => {
    it('getAPITokens GETs orgs/{org}/api-tokens', async () => {
      nock(API).get('/v0/orgs/test-org/api-tokens').reply(200, { data: [] })
      const result = await getClient().getAPITokens('test-org')
      expect(result.success).toBe(true)
    })

    it('postAPIToken POSTs orgs/{org}/api-tokens', async () => {
      nock(API)
        .post('/v0/orgs/test-org/api-tokens')
        .reply(200, { data: { id: 'tok-1' } })
      const result = await getClient().postAPIToken('test-org', {
        name: 'ci',
      })
      expect(result.success).toBe(true)
    })

    it('postAPITokenUpdate POSTs orgs/{org}/api-tokens/update with id in body', async () => {
      nock(API)
        .post(
          '/v0/orgs/test-org/api-tokens/update',
          body => body.id === 'tok-1',
        )
        .reply(200, { data: { id: 'tok-1' } })
      const result = await getClient().postAPITokenUpdate('test-org', 'tok-1', {
        name: 'renamed',
      })
      expect(result.success).toBe(true)
    })

    it('postAPITokensRevoke POSTs orgs/{org}/api-tokens/revoke with id in body', async () => {
      nock(API)
        .post('/v0/orgs/test-org/api-tokens/revoke', { id: 'tok-1' })
        .reply(200, { data: { status: 'revoked' } })
      const result = await getClient().postAPITokensRevoke('test-org', 'tok-1')
      expect(result.success).toBe(true)
    })

    it('postAPITokensRotate POSTs orgs/{org}/api-tokens/rotate with id in body', async () => {
      nock(API)
        .post('/v0/orgs/test-org/api-tokens/rotate', { id: 'tok-1' })
        .reply(200, { data: { id: 'tok-2' } })
      const result = await getClient().postAPITokensRotate('test-org', 'tok-1')
      expect(result.success).toBe(true)
    })
  })

  describe('Alert triage', () => {
    it('getOrgTriage GETs orgs/{org}/triage/alerts', async () => {
      nock(API).get('/v0/orgs/test-org/triage/alerts').reply(200, { data: [] })
      const result = await getClient().getOrgTriage('test-org')
      expect(result.success).toBe(true)
    })

    it('updateOrgAlertTriage POSTs orgs/{org}/triage/alerts with batched body', async () => {
      nock(API)
        .post(
          '/v0/orgs/test-org/triage/alerts',
          body =>
            Array.isArray(body.alertTriage) &&
            body.alertTriage[0].uuid === 'alert-1',
        )
        .reply(200, { data: { result: 'ok' } })
      const result = await getClient().updateOrgAlertTriage(
        'test-org',
        'alert-1',
        { note: 'triaged' },
      )
      expect(result.success).toBe(true)
    })
  })

  describe('SBOM export', () => {
    it('exportCDX GETs orgs/{org}/export/cdx/{id}', async () => {
      nock(API)
        .get('/v0/orgs/test-org/export/cdx/scan-123')
        .reply(200, { bomFormat: 'CycloneDX' })
      const result = await getClient().exportCDX('test-org', 'scan-123')
      expect(result.success).toBe(true)
    })

    it('exportSPDX GETs orgs/{org}/export/spdx/{id}', async () => {
      nock(API)
        .get('/v0/orgs/test-org/export/spdx/scan-123')
        .reply(200, { spdxVersion: 'SPDX-2.3' })
      const result = await getClient().exportSPDX('test-org', 'scan-123')
      expect(result.success).toBe(true)
    })
  })

  describe('Patches and files', () => {
    it('streamPatchesFromScan GETs orgs/{org}/patches/scan/{scanId}', async () => {
      nock(API).get('/v0/orgs/test-org/patches/scan/scan-123').reply(200, '')
      const stream = await getClient().streamPatchesFromScan(
        'test-org',
        'scan-123',
      )
      const reader = stream.getReader()
      // Drain the stream so the mocked request is consumed.
      let done = false
      while (!done) {
        done = (await reader.read()).done
      }
      expect(done).toBe(true)
    })

    it('downloadOrgFullScanFilesAsTar GETs orgs/{org}/full-scans/{id}/files/tar', async () => {
      nock(API)
        .get('/v0/orgs/test-org/full-scans/scan-123/files/tar')
        .reply(200, 'tar-bytes', { 'Content-Type': 'application/x-tar' })
      const outputPath = path.join(os.tmpdir(), 'sdk-contract-files.tar')
      const result = await getClient().downloadOrgFullScanFilesAsTar(
        'test-org',
        'scan-123',
        outputPath,
      )
      expect(result.success).toBe(true)
    })
  })
})
