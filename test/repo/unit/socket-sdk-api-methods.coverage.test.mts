/**
 * @file Core SDK API methods through an owned local HTTP server.
 */

import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { safeDeleteSync } from '@socketsecurity/lib-stable/fs/safe'
import { describe, expect, it } from 'vitest'
import { setupSdkCoverageClient } from '../../utils/sdk-api-coverage-client.mts'

describe('Core SDK API methods', () => {
  const fixture = setupSdkCoverageClient()

  describe('Package Analysis Methods', () => {
    it('covers getIssuesByNpmPackage', async () => {
      const result = await fixture.client.getIssuesByNpmPackage(
        'lodash',
        '4.17.21',
      )
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('covers getScoreByNpmPackage', async () => {
      const result = await fixture.client.getScoreByNpmPackage(
        'lodash',
        '4.17.21',
      )
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('covers batchPackageFetch', async () => {
      const result = await fixture.client.batchPackageFetch({
        components: [{ purl: 'pkg:npm/lodash@4.17.21' }],
      })
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('covers batchPackageStream', async () => {
      const componentsObj = {
        components: [
          { purl: 'pkg:npm/lodash@4.17.21' },
          { purl: 'pkg:npm/react@18.0.0' },
        ],
      }
      const generator = fixture.client.batchPackageStream(componentsObj)

      // Consume the generator
      const results = []
      for await (const result of generator) {
        results.push(result)
      }

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('Organization Methods', () => {
    it('covers listOrganizations', async () => {
      const result = await fixture.client.listOrganizations()
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('covers createRepository', async () => {
      const result = await fixture.client.createRepository(
        'test-org',
        'test-repo',
      )
      expect(result.success).toBe(true)
    })

    it('covers createRepository with all options', async () => {
      const result = await fixture.client.createRepository(
        'test-org',
        'test-repo',
        {
          archived: false,
          default_branch: 'main',
          description: 'Test repository',
          homepage: 'https://example.com',
          visibility: 'private',
          workspace: 'default',
        },
      )
      expect(result.success).toBe(true)
    })

    it('covers getRepository', async () => {
      const result = await fixture.client.getRepository('test-org', 'test-repo')
      expect(result.success).toBe(true)
    })

    it('covers listRepositories', async () => {
      const result = await fixture.client.listRepositories('test-org')
      expect(result.success).toBe(true)
    })

    it('covers updateRepository', async () => {
      const result = await fixture.client.updateRepository(
        'test-org',
        'test-repo',
        {},
      )
      expect(result.success).toBe(true)
    })

    it('covers deleteRepository', async () => {
      const result = await fixture.client.deleteRepository(
        'test-org',
        'test-repo',
      )
      expect(result.success).toBe(true)
    })
  })

  describe('Full Scan Methods', () => {
    it('covers listFullScans', async () => {
      const result = await fixture.client.listFullScans('test-org')
      expect(result.success).toBe(true)
    })

    it('covers getFullScanMetadata', async () => {
      const result = await fixture.client.getFullScanMetadata(
        'test-org',
        'scan-1',
      )
      expect(result.success).toBe(true)
    })

    it('covers createFullScan', async () => {
      // Create a temporary test file
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-test-'))
      const testFile = path.join(tempDir, 'package.json')
      writeFileSync(
        testFile,
        JSON.stringify({ name: 'test-pkg', version: '1.0.0' }),
      )

      try {
        const result = await fixture.client.createFullScan(
          'test-org',
          [testFile],
          {
            branch: 'main',
            commit_message: 'test',
            make_default_branch: false,
            pathsRelativeTo: tempDir,
            repo: 'test-repo',
          },
        )
        expect(result.success).toBe(true)
      } finally {
        safeDeleteSync(tempDir)
      }
    })

    it('covers deleteFullScan', async () => {
      const result = await fixture.client.deleteFullScan('test-org', 'scan-1')
      expect(result.success).toBe(true)
    })
  })

  describe('Diff Scan Methods', () => {
    it('covers createOrgDiffScanFromIds', async () => {
      const result = await fixture.client.createOrgDiffScanFromIds('test-org', {
        after: 'after-id',
        before: 'before-id',
      })
      expect(result.success).toBe(true)
    })

    it('covers createOrgDiffScanFromIds with all options', async () => {
      const result = await fixture.client.createOrgDiffScanFromIds('test-org', {
        after: 'after-id',
        before: 'before-id',
        description: 'Compare versions',
        external_href: 'https://github.com/org/repo/pull/123',
        merge: false,
      })
      expect(result.success).toBe(true)
    })

    it('covers getDiffScanById', async () => {
      const result = await fixture.client.getDiffScanById('test-org', 'diff-1')
      expect(result.success).toBe(true)
    })

    it('covers getDiffScanGfm', async () => {
      const result = await fixture.client.getDiffScanGfm('test-org', 'diff-1')
      expect(result.success).toBe(true)
    })

    it('covers getDiffScanGfm with options', async () => {
      const result = await fixture.client.getDiffScanGfm('test-org', 'diff-1', {
        github_installation_id: 'install-123',
      })
      expect(result.success).toBe(true)
    })

    it('covers listOrgDiffScans', async () => {
      const result = await fixture.client.listOrgDiffScans('test-org')
      expect(result.success).toBe(true)
    })

    it('covers deleteOrgDiffScan', async () => {
      const result = await fixture.client.deleteOrgDiffScan(
        'test-org',
        'diff-1',
      )
      expect(result.success).toBe(true)
    })
  })

  describe('SBOM Methods', () => {
    it('covers exportCDX', async () => {
      const result = await fixture.client.exportCDX('test-org', 'scan-1')
      expect(result.success).toBe(true)
    })

    it('covers exportSPDX', async () => {
      const result = await fixture.client.exportSPDX('test-org', 'scan-1')
      expect(result.success).toBe(true)
    })
  })

  describe('Patches Methods', () => {
    it('covers viewPatch', async () => {
      const result = await fixture.client.viewPatch(
        'test-org',
        'patch-uuid-123',
      )
      // viewPatch returns the patch data directly, not wrapped in success/data
      expect(result).toBeDefined()
    })

    it('covers fetchPatchesByCVE', async () => {
      const result = await fixture.client.fetchPatchesByCVE(
        'test-org',
        'CVE-2021-44228',
      )
      expect(result).toBeDefined()
    })

    it('covers fetchPatchesByGHSA', async () => {
      const result = await fixture.client.fetchPatchesByGHSA(
        'test-org',
        'GHSA-jfhm-5ghh-2f97',
      )
      expect(result).toBeDefined()
    })

    it('covers fetchPatchesByPackage', async () => {
      const result = await fixture.client.fetchPatchesByPackage(
        'test-org',
        'pkg:npm/lodash@4.17.21',
      )
      expect(result).toBeDefined()
    })

    it('covers fetchPatchesBatch', async () => {
      const result = await fixture.client.fetchPatchesBatch('test-org', [
        { purl: 'pkg:npm/lodash@4.17.21' },
      ])
      expect(result).toBeDefined()
    })

    it('covers fetchPatchRecords', async () => {
      const result = await fixture.client.fetchPatchRecords('test-org', [
        'patch-uuid-123',
      ])
      expect(result).toBeDefined()
    })

    it('covers getPatchDiff', async () => {
      const result = await fixture.client.getPatchDiff(
        'test-org',
        'patch-uuid-123',
      )
      expect(result).toBeDefined()
    })

    it('covers getPatchBlob', async () => {
      const result = await fixture.client.getPatchBlob('test-org', 'deadbeef')
      expect(result).toBeDefined()
    })

    it('covers getPatchPackages', async () => {
      const result = await fixture.client.getPatchPackages('test-org', [
        'patch-uuid-123',
      ])
      expect(result).toBeDefined()
    })

    it('covers patchPackageStats', async () => {
      const result = await fixture.client.patchPackageStats('test-org', [
        'patch-key-1',
      ])
      expect(result).toBeDefined()
    })

    it('covers lookupPatchPackage', async () => {
      const result = await fixture.client.lookupPatchPackage('test-org', [
        'patch-key-1',
      ])
      expect(result).toBeDefined()
    })
  })

  describe('Quota Methods', () => {
    it('covers getQuota', async () => {
      const result = await fixture.client.getQuota()
      expect(result.success).toBe(true)
    })
  })

  describe('Settings Methods', () => {
    it('covers postSettings', async () => {
      const result = await fixture.client.postSettings([
        {
          organization: 'test-org',
        },
      ])
      expect(result.success).toBe(true)
    })
  })

  describe('Dependencies Methods', () => {
    it('covers searchDependencies', async () => {
      const result = await fixture.client.searchDependencies({
        limit: 10,
        orgSlug: 'test-org',
        repoName: 'test-repo',
      })
      expect(result.success).toBe(true)
    })

    it('covers createDependenciesSnapshot', async () => {
      // Create a temporary test file
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-test-'))
      const testFile = path.join(tempDir, 'package.json')
      writeFileSync(
        testFile,
        JSON.stringify({ name: 'test-pkg', version: '1.0.0' }),
      )

      try {
        const result = await fixture.client.createDependenciesSnapshot(
          [testFile],
          {
            pathsRelativeTo: tempDir,
            queryParams: {
              branch: 'main',
              orgSlug: 'test-org',
              repoName: 'test-repo',
            },
          },
        )
        expect(result.success).toBe(true)
      } finally {
        safeDeleteSync(tempDir)
      }
    })
  })
})
