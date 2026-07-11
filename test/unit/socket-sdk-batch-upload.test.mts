/**
 * @file Tests for multi-part upload operations (dependencies snapshot, full
 *   scan).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import * as path from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index.mts'
import { setupNockEnvironment } from '../utils/environment.mts'
import { NO_RETRY_CONFIG } from '../utils/fast-test-config.mts'

import type { IncomingHttpHeaders } from 'node:http'

describe('SocketSdk - Batch Operations', () => {
  describe('Multi-part Upload', () => {
    setupNockEnvironment()

    let tempDir: string
    let packageJsonPath: string
    let packageLockPath: string

    beforeEach(() => {
      // Create a temporary directory for test files
      tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-sdk-test-'))

      // Create test manifest files
      packageJsonPath = path.join(tempDir, 'package.json')
      packageLockPath = path.join(tempDir, 'package-lock.json')

      writeFileSync(
        packageJsonPath,
        JSON.stringify(
          {
            name: 'test-project',
            version: '1.0.0',
            dependencies: {
              express: '^4.18.0',
              lodash: '^4.17.21',
            },
          },
          null,
          2,
        ),
      )

      writeFileSync(
        packageLockPath,
        JSON.stringify(
          {
            name: 'test-project',
            version: '1.0.0',
            lockfileVersion: 2,
            requires: true,
            packages: {
              '': {
                name: 'test-project',
                version: '1.0.0',
                dependencies: {
                  express: '^4.18.0',
                  lodash: '^4.17.21',
                },
              },
            },
          },
          null,
          2,
        ),
      )
    })

    afterEach(() => {
      // Clean up temporary files
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should upload files with createDependenciesSnapshot', async () => {
      let capturedHeaders: IncomingHttpHeaders = {}

      nock('https://api.socket.dev')
        .post('/v0/dependencies/upload')
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- nock reply context
        .reply(function (this: any) {
          capturedHeaders = this.req.headers
          return [
            200,
            {
              id: 'snapshot-123',
              status: 'complete',
              files: ['package.json', 'package-lock.json'],
            },
          ]
        })

      const client = new SocketSdk('test-token', NO_RETRY_CONFIG)
      const res = await client.createDependenciesSnapshot(
        [packageJsonPath, packageLockPath],
        { pathsRelativeTo: tempDir },
      )

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data['id']).toBe('snapshot-123')
        expect(res.data['files']).toContain('package.json')
        expect(res.data['files']).toContain('package-lock.json')
      }

      // Verify multipart headers
      expect(capturedHeaders['content-type']).toBeDefined()
      const contentType = Array.isArray(capturedHeaders['content-type'])
        ? capturedHeaders['content-type'][0]
        : capturedHeaders['content-type']
      expect(contentType).toContain('multipart/form-data')
      expect(contentType).toContain('boundary=')
    })

    it('should upload files with createFullScan', async () => {
      let capturedHeaders: IncomingHttpHeaders = {}

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans')
        .query({ repo: 'test-repo' })
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- nock reply context
        .reply(function (this: any) {
          capturedHeaders = this.req.headers
          return [
            200,
            {
              id: 'org-scan-456',
              organization_slug: 'test-org',
              status: 'complete',
              files: ['package.json', 'package-lock.json'],
            },
          ]
        })

      const client = new SocketSdk('test-token', NO_RETRY_CONFIG)
      const res = await client.createFullScan(
        'test-org',
        [packageJsonPath, packageLockPath],
        { pathsRelativeTo: tempDir, repo: 'test-repo' },
      )

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.id).toBe('org-scan-456')
        expect(res.data.organization_slug).toBe('test-org')
      }

      // Verify multipart headers
      const contentType = Array.isArray(capturedHeaders['content-type'])
        ? capturedHeaders['content-type'][0]
        : capturedHeaders['content-type']
      expect(contentType).toContain('multipart/form-data')
      expect(contentType).toContain('boundary=')
    })

    it('should upload files with createFullScan with workspace option', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans')
        .query({ repo: 'test-repo', workspace: 'my-workspace' })
        .reply(200, {
          id: 'org-scan-789',
          organization_slug: 'test-org',
          status: 'complete',
          workspace: 'my-workspace',
        })

      const client = new SocketSdk('test-token', NO_RETRY_CONFIG)
      const res = await client.createFullScan(
        'test-org',
        [packageJsonPath, packageLockPath],
        {
          pathsRelativeTo: tempDir,
          repo: 'test-repo',
          workspace: 'my-workspace',
        },
      )

      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.id).toBe('org-scan-789')
      }
    })

    it('should handle connection interruption during upload', async () => {
      nock('https://api.socket.dev')
        .post('/v0/dependencies/upload')
        .replyWithError(new Error('socket hang up'))

      const client = new SocketSdk('test-token', NO_RETRY_CONFIG)

      await expect(
        client.createDependenciesSnapshot([packageJsonPath], {
          pathsRelativeTo: tempDir,
        }),
      ).rejects.toThrow()
    })

    it('should handle non-existent file paths', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.json')

      // The SDK validates files and returns an error result for unreadable files
      const client = new SocketSdk('test-token', NO_RETRY_CONFIG)

      const res = await client.createDependenciesSnapshot([nonExistentPath], {
        pathsRelativeTo: tempDir,
      })

      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe('No readable manifest files found')
        expect(res.status).toBe(400)
      }
    })
  })
})
