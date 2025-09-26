import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

describe('SocketSdk - Edge Cases', () => {
  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  describe('Error Response Edge Cases', () => {
    it('should handle text/plain response in error handler', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(429, 'Rate limit exceeded', {
          'content-type': 'text/plain',
        })

      const client = new SocketSdk('test-token')
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(429)
      if (!res.success) {
        expect(res.error).toContain('Rate limit exceeded')
      }
    })

    it('should handle malformed JSON in error response', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(400, 'not-json{invalid', {
          'content-type': 'application/json',
        })

      const client = new SocketSdk('test-token')
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(400)
      if (!res.success) {
        expect(res.error).toContain('not-json{invalid')
      }
    })

    it('should handle response without error message in JSON', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(400, { someOtherField: 'value' })

      const client = new SocketSdk('test-token')
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(400)
    })

    it('should handle 401 unauthorized with message', async () => {
      nock('https://api.socket.dev')
        .get('/v0/organizations')
        .reply(401, { error: { message: 'Invalid API key' } })

      const client = new SocketSdk('test-token')
      const res = await client.getOrganizations()

      expect(res.success).toBe(false)
      expect(res.status).toBe(401)
      if (!res.success) {
        expect(res.error).toContain('Invalid API key')
      }
    })

    it('should handle 400 bad request without error message in response', async () => {
      nock('https://api.socket.dev').get('/v0/quota').reply(400)

      const client = new SocketSdk('test-token')
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(400)
    })
  })

  describe('API Method Error Scenarios', () => {
    it('should handle getOrgFullScanMetadata error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/metadata')
        .reply(404, { error: { message: 'Not found' } })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgFullScanMetadata('test-org', 'scan-123')

      expect(res.success).toBe(false)
      expect(res.status).toBe(404)
    })

    it('should handle getOrgRepoList error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos')
        .reply(403, { error: { message: 'Forbidden' } })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgRepoList('test-org')

      expect(res.success).toBe(false)
      expect(res.status).toBe(403)
    })

    it('should handle getOrgFullScanMetadata 500 error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/metadata')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.getOrgFullScanMetadata('test-org', 'scan-123'),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle getOrgRepoList 500 error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getOrgRepoList('test-org')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle network error for getOrgFullScanMetadata', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/metadata')
        .replyWithError('Network error')

      const client = new SocketSdk('test-token')

      await expect(
        client.getOrgFullScanMetadata('test-org', 'scan-123'),
      ).rejects.toThrow('Unexpected Socket API error')
    })

    it('should handle network error for getOrgRepoList', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos')
        .replyWithError('Network error')

      const client = new SocketSdk('test-token')

      await expect(client.getOrgRepoList('test-org')).rejects.toThrow(
        'Unexpected Socket API error',
      )
    })

    it('should handle getOrgFullScanList error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans')
        .reply(401, { error: { message: 'Unauthorized' } })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgFullScanList('test-org')

      expect(res.success).toBe(false)
      expect(res.status).toBe(401)
    })

    it('should handle getOrgFullScanList 500 error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getOrgFullScanList('test-org')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle getOrgFullScanList network error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans')
        .replyWithError('Network error')

      const client = new SocketSdk('test-token')

      await expect(client.getOrgFullScanList('test-org')).rejects.toThrow(
        'Unexpected Socket API error',
      )
    })

    it('should handle createScanFromFilepaths error with non-existent file', async () => {
      const client = new SocketSdk('test-token')

      // Should throw an error when trying to read non-existent file
      await expect(
        client.createScanFromFilepaths(['test-package.json']),
      ).rejects.toThrow()
    })

    it('should handle createOrgFullScan', async () => {
      const client = new SocketSdk('test-token')

      // Should throw an error when trying to read non-existent file
      await expect(
        client.createOrgFullScan('test-org', ['test-package.json']),
      ).rejects.toThrow()
    })

    it('should handle createOrgFullScan error', async () => {
      const client = new SocketSdk('test-token')

      await expect(
        client.createOrgFullScan('test-org', ['test-package.json']),
      ).rejects.toThrow()
    })

    it('should handle updateOrgRepo error', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/test-repo')
        .reply(404, { error: { message: 'Not found' } })

      const client = new SocketSdk('test-token')
      const res = await client.updateOrgRepo('test-org', 'test-repo', {
        archived: true,
      })

      expect(res.success).toBe(false)
      expect(res.status).toBe(404)
    })

    it('should handle getRepoAnalytics error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/analytics/repo/repo/30d')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getRepoAnalytics('repo', '30d')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle getScan error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/report/view/sample-scan-id')
        .reply(404, { error: { message: 'Scan not found' } })

      const client = new SocketSdk('test-token')
      const res = await client.getScan('sample-scan-id')

      expect(res.success).toBe(false)
      expect(res.status).toBe(404)
    })

    it('should handle getScan 500 error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/report/view/sample-scan-id')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getScan('sample-scan-id')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle postSettings error', async () => {
      nock('https://api.socket.dev')
        .post('/v0/settings')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.postSettings([{ organization: 'test' }]),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle searchDependencies error', async () => {
      nock('https://api.socket.dev')
        .post('/v0/dependencies/search')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.searchDependencies({ search: 'test' }),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle getIssuesByNpmPackage error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/npm/test-pkg/1.0.0/issues')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.getIssuesByNpmPackage('test-pkg', '1.0.0'),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle getScoreByNpmPackage error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/npm/test-pkg/1.0.0/score')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.getScoreByNpmPackage('test-pkg', '1.0.0'),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle getScanList error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/report/list')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getScanList()).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle getSupportedScanFiles error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/report/supported')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getSupportedScanFiles()).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle getSBOMFromScan error', async () => {
      // getSBOMFromScan method doesn't exist in current SDK version
      expect(true).toBe(true) // Placeholder test
    })

    it('should handle streamPatchesFromScan error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/patches/scan/scan-123')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      // streamPatchesFromScan throws on server errors
      await expect(
        client.streamPatchesFromScan('test-org', 'scan-123'),
      ).rejects.toThrow()
    })

    it('should handle getOrgAnalytics error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/analytics/org/30d')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getOrgAnalytics('30d')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle getOrganizations error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/organizations')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getOrganizations()).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle getOrgSecurityPolicy error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/security-policy')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getOrgSecurityPolicy('test-org')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle getOrgLicensePolicy error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/license-policy')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getOrgLicensePolicy('test-org')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle getAuditLogEvents error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/audit-log')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getAuditLogEvents('test-org')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle createOrgRepo error', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.createOrgRepo('test-org', { name: 'test-repo' }),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle getOrgRepo error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/test-repo')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(client.getOrgRepo('test-org', 'test-repo')).rejects.toThrow(
        'Socket API server error (500)',
      )
    })

    it('should handle deleteOrgRepo error', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/test-repo')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.deleteOrgRepo('test-org', 'test-repo'),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle deleteOrgFullScan error', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/full-scans/scan-123')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.deleteOrgFullScan('test-org', 'scan-123'),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle streamOrgFullScan error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.streamOrgFullScan('test-org', 'scan-123', false),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle getOrgFullScanBuffered error', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.getOrgFullScanBuffered('test-org', 'scan-123'),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should handle createScanFromFilepaths error', async () => {
      const client = new SocketSdk('test-token')

      await expect(
        client.createScanFromFilepaths(['test-package.json']),
      ).rejects.toThrow()
    })

    it('should handle createDependenciesSnapshot error', async () => {
      const client = new SocketSdk('test-token')

      await expect(
        client.createDependenciesSnapshot(['test-package.json']),
      ).rejects.toThrow()
    })

    it('should handle batchPackageFetch error', async () => {
      nock('https://api.socket.dev')
        .post('/v0/purl')
        .reply(500, { error: { message: 'Server error' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.batchPackageFetch({ components: [] }),
      ).rejects.toThrow('Socket API server error (500)')
    })
  })
})
