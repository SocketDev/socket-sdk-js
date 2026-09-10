/**
 * @file SDK scans and uploads through an owned local HTTP server.
 */

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { safeDeleteSync } from '@socketsecurity/lib-stable/fs/safe'
import { SocketSdk } from '../../../src/index.mts'
import { describe, expect, it } from 'vitest'
import { setupSdkCoverageClient } from '../../utils/sdk-api-coverage-client.mts'

describe('SDK scans and uploads', () => {
  const fixture = setupSdkCoverageClient()

  describe('Full Scan Archive Methods', () => {
    it('covers createOrgFullScanFromArchive', async () => {
      // Create a temporary test file to upload
      const testFilePath = `${os.tmpdir()}/test-archive-${Date.now()}.tar.gz`
      writeFileSync(testFilePath, 'test archive content')

      try {
        const result = await fixture.client.createOrgFullScanFromArchive(
          'test-org',
          testFilePath,
          {
            branch: 'main',
            commit_hash: 'abc123',
            commit_message: 'Test commit',
            repo: 'test-repo',
          },
        )
        // The method executes successfully
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
      } finally {
        // Clean up test file
        try {
          safeDeleteSync(testFilePath)
        } catch {
          // Ignore cleanup errors
        }
      }
    })

    it('covers downloadOrgFullScanFilesAsTar', async () => {
      // Create a temporary output file path
      const outputPath = `${os.tmpdir()}/test-download-${Date.now()}.tar`

      try {
        const result = await fixture.client.downloadOrgFullScanFilesAsTar(
          'test-org',
          'scan-1',
          outputPath,
        )
        // The method executes successfully
        expect(result.success).toBe(true)
        // Verify the file was written
        expect(existsSync(outputPath)).toBe(true)
        // Verify file has content
        const content = readFileSync(outputPath)
        expect(content.length).toBeGreaterThan(0)
      } finally {
        // Clean up output file
        try {
          safeDeleteSync(outputPath)
        } catch {
          // Ignore cleanup errors
        }
      }
    })
  })

  describe('Streaming Methods', () => {
    it('covers streamFullScan', async () => {
      const result = await fixture.client.streamFullScan('test-org', 'scan-1')
      expect(result.success).toBe(true)
    })

    it('covers streamPatchesFromScan', async () => {
      // This method returns a Promise<ReadableStream>
      // Just verify it executes without throwing
      const stream = await fixture.client.streamPatchesFromScan(
        'test-org',
        'scan-1',
      )
      expect(stream).toBeDefined()
    })

    it('covers streamPatchesFromScan error path', async () => {
      // The server returns 404 for invalid-scan
      await expect(
        fixture.client.streamPatchesFromScan('test-org', 'invalid-scan'),
      ).rejects.toThrow('GET Request failed')
    })

    it('covers sendApi method', async () => {
      // Test the generic sendApi method with POST. The urlPath follows the
      // documented form without a leading slash — the SDK appends it to the
      // trailing-slash baseUrl, and a leading slash would produce a
      // double-slash URL that nock's fail-closed net-connect guard misparses
      // as protocol-relative and refuses.
      const result = await fixture.client.sendApi('scan', {
        body: { repo: 'test' },
        method: 'POST',
      })
      expect(result).toBeDefined()
    })

    it('covers batchPackageStream generator', async () => {
      // Test the async generator method
      const componentsObj = {
        components: [{ purl: 'pkg:npm/lodash@4.17.21' }],
      }
      const generator = fixture.client.batchPackageStream(componentsObj)
      try {
        const first = await generator.next()
        expect(first.done).toBe(false)
        expect(first.value).toMatchObject({
          success: true,
          data: { type: 'npm', name: 'lodash' },
        })
      } finally {
        await generator.return(undefined)
      }
    })

    it('covers cache path with cacheTtl', async () => {
      // Create client with cache enabled to test cache code path
      const clientWithCache = new SocketSdk('test-token', {
        baseUrl: fixture.baseUrl,
        cache: true,
        cacheTtl: 5000,
        retries: 0,
      })

      // Make two identical requests - second should use cache
      const result1 = await clientWithCache.listOrganizations()
      const result2 = await clientWithCache.listOrganizations()

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })

    it('covers getFullScan', async () => {
      const result = await fixture.client.getFullScan('test-org', 'scan-1')
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })
  })

  describe('Response Type Variations', () => {
    it('covers getApi with response type', async () => {
      const result = await fixture.client.getIssuesByNpmPackage(
        'lodash',
        '4.17.21',
      )
      expect(result.success).toBe(true)
    })

    it('covers getApi with text response type', async () => {
      const result = await fixture.client.getIssuesByNpmPackage(
        'lodash',
        '4.17.21',
      )
      expect(result.success).toBe(true)
    })
  })

  describe('Upload Methods', () => {
    it('covers uploadManifestFiles', async () => {
      // Create a temporary test file
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-test-'))
      const testFile = path.join(tempDir, 'package.json')
      writeFileSync(
        testFile,
        JSON.stringify({ name: 'test-pkg', version: '1.0.0' }),
      )

      try {
        const result = await fixture.client.uploadManifestFiles(
          'test-org',
          [testFile],
          {
            pathsRelativeTo: tempDir,
          },
        )
        expect(result.success).toBe(true)
      } finally {
        safeDeleteSync(tempDir)
      }
    })
  })

  describe('Error Handling Paths', () => {
    it('covers retry logic through timeout', async () => {
      // This will succeed but exercise retry preparation code
      const result = await fixture.client.listOrganizations()
      expect(result.success).toBe(true)
    })

    it('covers cache when enabled', async () => {
      const cachedClient = new SocketSdk('test-token', {
        baseUrl: fixture.baseUrl,
        cache: true,
        timeout: 5000,
      })
      const result1 = await cachedClient.listOrganizations()
      const result2 = await cachedClient.listOrganizations()
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })

    it('covers methods with query parameters', async () => {
      const result = await fixture.client.listFullScans('test-org', {
        per_page: 10,
        page: 0,
      })
      expect(result.success).toBe(true)
    })
  })
})
