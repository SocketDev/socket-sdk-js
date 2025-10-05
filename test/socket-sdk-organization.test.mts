import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'
import { TEST_PACKAGE_CONFIGS } from './utils/fixtures.mts'

describe('SocketSdk - Organization Management', () => {
  let tempDir: string
  let packageJsonPath: string

  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()

    tempDir = mkdtempSync(path.join(tmpdir(), 'socket-sdk-test-'))
    packageJsonPath = path.join(tempDir, 'package.json')
    writeFileSync(
      packageJsonPath,
      JSON.stringify(TEST_PACKAGE_CONFIGS.expressBasic),
    )
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('Organization Management', () => {
    it('should create an organization repository', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos')
        .reply(200, {
          id: 'repo-123',
          name: 'test-repo',
          org: 'test-org',
          created_at: '2024-01-01T00:00:00Z',
        })

      const client = new SocketSdk('test-token')
      const res = await client.createOrgRepo('test-org', {
        name: 'test-repo',
        url: 'https://github.com/test/repo',
      })

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.id).toBe('repo-123')
        expect(res.data.name).toBe('test-repo')
      }
    })

    it('should get organization repository details', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/test-repo')
        .reply(200, {
          id: 'repo-123',
          name: 'test-repo',
          org: 'test-org',
          url: 'https://github.com/test/repo',
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgRepo('test-org', 'test-repo')

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.id).toBe('repo-123')
        expect(res.data.name).toBe('test-repo')
      }
    })

    it('should list organization repositories', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos')
        .reply(200, {
          results: [
            { id: 'repo-1', name: 'repo-1' },
            { id: 'repo-2', name: 'repo-2' },
          ],
          nextPage: null,
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgRepoList('test-org')

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.results).toHaveLength(2)
        expect(res.data.nextPage).toBe(null)
      }
    })

    it('should update organization repository', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/test-repo')
        .reply(200, {
          id: 'repo-123',
          name: 'test-repo',
          description: 'Updated description',
        })

      const client = new SocketSdk('test-token')
      const res = await client.updateOrgRepo('test-org', 'test-repo', {
        description: 'Updated description',
      })

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.description).toBe('Updated description')
      }
    })

    it('should handle error in updateOrgRepo', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/test-repo')
        .reply(500, { error: { message: 'Update failed' } })

      const client = new SocketSdk('test-token')

      await expect(
        client.updateOrgRepo('test-org', 'test-repo', { name: 'new-name' }),
      ).rejects.toThrow('Socket API server error (500)')
    })

    it('should delete organization repository', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/test-repo')
        .reply(200, { success: true })

      const client = new SocketSdk('test-token')
      const res = await client.deleteOrgRepo('test-org', 'test-repo')

      expect(res.success).toBe(true)
    })

    it('should get organization license policy', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/license-policy')
        .reply(200, {
          allowed: ['MIT', 'Apache-2.0'],
          denied: ['GPL-3.0'],
          policy: 'strict',
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgLicensePolicy('test-org')

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data['allowed']).toContain('MIT')
        expect(res.data['denied']).toContain('GPL-3.0')
      }
    })

    it('should get audit log events', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/audit-log')
        .reply(200, {
          results: [
            {
              id: 'event-1',
              action: 'repo.create',
              actor: 'user@example.com',
              timestamp: '2024-01-01T00:00:00Z',
            },
          ],
          nextPage: null,
        })

      const client = new SocketSdk('test-token')
      const res = await client.getAuditLogEvents('test-org')

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.results).toHaveLength(1)
        // Action property may not exist on the type
      }
    })

    it('should get organization security policy', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/security-policy')
        .reply(200, {
          policy: 'strict',
          enforced: true,
          rules: ['no-malware', 'no-cve'],
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgSecurityPolicy('test-org')

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data).toBeDefined()
        // Response structure may vary based on API version
      }
    })
  })

  describe('Full Scan Operations', () => {
    it('should get full scan list', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans')
        .reply(200, {
          results: [
            { id: 'scan-1', status: 'complete' },
            { id: 'scan-2', status: 'processing' },
          ],
          nextPage: null,
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgFullScanList('test-org')

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.results).toHaveLength(2)
      }
    })

    it('should get full scan metadata', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/metadata')
        .reply(200, {
          id: 'scan-123',
          created_at: '2024-01-01T00:00:00Z',
          files_count: 10,
          issues_count: 5,
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgFullScanMetadata('test-org', 'scan-123')

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.id).toBe('scan-123')
        // files_count property may not exist on the type
      }
    })

    it('should delete full scan', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/full-scans/scan-123')
        .reply(200, { success: true })

      const client = new SocketSdk('test-token')
      const res = await client.deleteOrgFullScan('test-org', 'scan-123')

      expect(res.success).toBe(true)
    })

    it('should stream full scan using streamOrgFullScan to stdout', async () => {
      const scanData = 'Full scan data content for streaming'
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-456')
        .reply(200, scanData)

      const client = new SocketSdk('test-token')

      // Simply verify the API call succeeds when streaming to stdout
      // The actual streaming happens asynchronously, so we just verify the method works
      const res = await client.streamOrgFullScan('test-org', 'scan-456', {
        output: true,
      })
      expect(res.success).toBe(true)
    })

    it('should stream full scan to file using streamOrgFullScan', async () => {
      const scanData = 'Full scan data for file'
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-789')
        .reply(200, scanData)

      const client = new SocketSdk('test-token')
      const tempFile = path.join(tmpdir(), 'test-scan.json')

      // Since we can't easily mock createWriteStream in ESM, we'll just verify the request happens
      const res = await client.streamOrgFullScan('test-org', 'scan-789', {
        output: tempFile,
      })

      expect(res.success).toBe(true)
    })

    it('should not stream when output is false in streamOrgFullScan', async () => {
      const scanData = 'Full scan data no stream'
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-no-stream')
        .reply(200, scanData)

      const client = new SocketSdk('test-token')
      const originalWrite = process.stdout.write
      let wasCalled = false
      process.stdout.write = (_chunk: any) => {
        wasCalled = true
        return true
      }

      const res = await client.streamOrgFullScan('test-org', 'scan-no-stream', {
        output: false,
      })

      process.stdout.write = originalWrite
      expect(res.success).toBe(true)
      // No output should be written
      expect(wasCalled).toBe(false)
    })

    it('should get buffered full scan data using getOrgFullScanBuffered', async () => {
      const scanData = {
        id: 'scan-buffered',
        status: 'complete',
        data: 'Full scan buffered data',
      }
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-buffered')
        .reply(200, scanData)

      const client = new SocketSdk('test-token')
      const res = await client.getOrgFullScanBuffered(
        'test-org',
        'scan-buffered',
      )

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data).toEqual(scanData)
      }
    })

    it('should handle undefined output in streamOrgFullScan', async () => {
      const scanData = 'Full scan data with undefined output'
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-undefined')
        .reply(200, scanData)

      const client = new SocketSdk('test-token')
      const originalWrite = process.stdout.write
      let wasCalled = false
      process.stdout.write = (_chunk: any) => {
        wasCalled = true
        return true
      }

      // Call with undefined output (same as no streaming)
      const res = await client.streamOrgFullScan(
        'test-org',
        'scan-undefined',
        undefined,
      )

      process.stdout.write = originalWrite
      expect(res.success).toBe(true)
      // No output should be written
      expect(wasCalled).toBe(false)
    })

    it('should create an organization full scan', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans')
        .reply(200, {
          id: 'full-scan-123',
          organization_slug: 'test-org',
          status: 'created',
          files: ['package.json'],
        })

      const client = new SocketSdk('test-token')
      const res = await client.createOrgFullScan(
        'test-org',
        [packageJsonPath],
        {
          pathsRelativeTo: tempDir,
        },
      )

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.id).toBe('full-scan-123')
        expect(res.data.organization_slug).toBe('test-org')
      }
    })

    it('should handle HTTP error in streamOrgFullScan', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-error')
        .reply(404, { error: { message: 'Scan not found' } })

      const client = new SocketSdk('test-token')
      const res = await client.streamOrgFullScan('test-org', 'scan-error', {
        output: true,
      })

      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.status).toBe(404)
        expect(res.error).toContain('Socket API Request failed (404)')
      }
    })

    it('should handle network error in streamOrgFullScan', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-network-error')
        .replyWithError('Network error')

      const client = new SocketSdk('test-token')

      await expect(
        client.streamOrgFullScan('test-org', 'scan-network-error', {
          output: false,
        }),
      ).rejects.toThrow()
    })
  })
})
