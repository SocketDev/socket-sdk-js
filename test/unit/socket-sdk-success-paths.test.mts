/** @fileoverview Tests for SDK method success paths to increase coverage. */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../utils/environment.mts'

describe('SocketSdk - Success Path Coverage', () => {
  const getClient = setupTestClient('test-api-token', {
    retries: 0,
  })

  describe('Repository Management', () => {
    it('should successfully create a repository', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos')
        .reply(200, { data: { name: 'test-repo' } })

      const result = await getClient().createRepository('test-org', {
        description: 'Test repository',
        name: 'test-repo',
      })

      expect(result.success).toBe(true)
    })

    it('should successfully delete a repository', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/test-repo')
        .reply(200, { success: true })

      const result = await getClient().deleteRepository('test-org', 'test-repo')

      expect(result.success).toBe(true)
    })

    it('should successfully get a repository', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/test-repo')
        .reply(200, { data: { name: 'test-repo' } })

      const result = await getClient().getRepository('test-org', 'test-repo')

      expect(result.success).toBe(true)
    })

    it('should successfully update a repository', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/test-repo')
        .reply(200, { data: { name: 'test-repo' } })

      const result = await getClient().updateRepository(
        'test-org',
        'test-repo',
        {
          defaultBranch: 'develop',
        },
      )

      expect(result.success).toBe(true)
    })

    it('should successfully list repositories', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos')
        .reply(200, { data: [] })

      const result = await getClient().listRepositories('test-org')

      expect(result.success).toBe(true)
    })
  })

  describe('Repository Labels', () => {
    it('should successfully create a repository label', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/labels')
        .reply(200, { data: { name: 'bug' } })

      const result = await getClient().createRepositoryLabel('test-org', {
        color: '#FF0000',
        name: 'bug',
      })

      expect(result.success).toBe(true)
    })

    it('should successfully delete a repository label', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/labels/bug')
        .reply(200, { success: true })

      const result = await getClient().deleteRepositoryLabel('test-org', 'bug')

      expect(result.success).toBe(true)
    })

    it('should successfully get a repository label', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/labels/bug')
        .reply(200, { data: { name: 'bug' } })

      const result = await getClient().getRepositoryLabel('test-org', 'bug')

      expect(result.success).toBe(true)
    })

    it('should successfully update a repository label', async () => {
      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/repos/labels/bug')
        .reply(200, { data: { name: 'bug' } })

      const result = await getClient().updateRepositoryLabel(
        'test-org',
        'bug',
        {
          color: '#00FF00',
        },
      )

      expect(result.success).toBe(true)
    })

    it('should successfully list repository labels', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/labels')
        .reply(200, { data: [] })

      const result = await getClient().listRepositoryLabels('test-org')

      expect(result.success).toBe(true)
    })
  })

  describe('Full Scans', () => {
    it('should successfully delete a full scan', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/full-scans/scan-123')
        .reply(200, { success: true })

      const result = await getClient().deleteFullScan('test-org', 'scan-123')

      expect(result.success).toBe(true)
    })

    it('should successfully get a full scan', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123')
        .reply(200, { data: { id: 'scan-123' } })

      const result = await getClient().getFullScan('test-org', 'scan-123')

      expect(result.success).toBe(true)
    })

    it('should successfully get full scan metadata', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/metadata')
        .reply(200, { data: { id: 'scan-123' } })

      const result = await getClient().getFullScanMetadata(
        'test-org',
        'scan-123',
      )

      expect(result.success).toBe(true)
    })
  })

  describe('Organizations', () => {
    it('should successfully list organizations', async () => {
      nock('https://api.socket.dev')
        .get('/v0/organizations')
        .reply(200, { data: [] })

      const result = await getClient().listOrganizations()

      expect(result.success).toBe(true)
    })
  })

  describe('SBOM Export', () => {
    it('should successfully export SPDX', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/sbom/export/spdx')
        .reply(200, { data: { spdxVersion: 'SPDX-2.3' } })

      const result = await getClient().exportSPDX('test-org', 'scan-123')

      expect(result.success).toBe(true)
    })
  })

  describe('Entitlements - Filter Logic', () => {
    it('should filter enabled entitlements with complex data', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/entitlements')
        .reply(200, {
          items: [
            { enabled: true, key: 'firewall' },
            { enabled: false, key: 'scanning' },
            { enabled: true, key: 'alerts' },
            // Test edge cases
            // Empty key should be filtered
            { enabled: true, key: '' },
            { enabled: false, key: 'disabled' },
            // Missing enabled property
            { key: 'no-enabled-prop' },
            // Null item
            null,
            // Missing key property
            { enabled: true },
          ],
        })

      const result = await getClient().getEnabledEntitlements('test-org')

      // Should only return enabled items with non-empty keys
      expect(result).toEqual(['firewall', 'alerts'])
    })

    it('should handle all disabled entitlements', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/entitlements')
        .reply(200, {
          items: [
            { enabled: false, key: 'firewall' },
            { enabled: false, key: 'scanning' },
          ],
        })

      const result = await getClient().getEnabledEntitlements('test-org')

      expect(result).toEqual([])
    })

    it('should handle entitlements with special characters', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/entitlements')
        .reply(200, {
          items: [
            { enabled: true, key: 'fire-wall' },
            { enabled: true, key: 'scan_ning' },
            { enabled: true, key: 'alert.system' },
          ],
        })

      const result = await getClient().getEnabledEntitlements('test-org')

      expect(result).toEqual(['fire-wall', 'scan_ning', 'alert.system'])
    })
  })
})
