/**
 * @file Tests for the v1 content-addressed full-scan and blob-upload
 *   primitives (src/full-scans-v1.mts) and the SocketSdk methods built on
 *   them (createFullScanFromManifest, uploadBlobs).
 */
import crypto from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  assembleManifest,
  deriveApiV1BaseUrl,
  hashFile,
} from '../../../src/full-scans-v1.mts'
import {
  createTestClient,
  setupNockEnvironment,
} from '../../utils/environment.mts'

import type { FullScanManifest } from '../../../src/full-scans-v1.mts'

/**
 * Nock hands multipart request bodies back hex-encoded when they aren't
 * UTF-8-representable; the fixture files in this suite are plain text so the
 * body is already readable, but decode defensively rather than assume.
 */
function decodeMultipartBody(body: string): string {
  return body.includes('Content-Disposition')
    ? body
    : Buffer.from(body, 'hex').toString('utf8')
}

describe('full-scans-v1', () => {
  setupNockEnvironment()

  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-sdk-full-scans-v1-'))
  })

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true })
  })

  const manifest: FullScanManifest = {
    algo: 'sha256',
    files: {
      'package.json': { hash: 'a'.repeat(64), size: 10 },
    },
  }

  describe('hashFile', () => {
    it('computes the sha256 digest and byte size of a known file', async () => {
      const content = 'hello world'
      const filePath = path.join(tempDir, 'known.txt')
      writeFileSync(filePath, content)

      const result = await hashFile(filePath)

      expect(result.hash).toBe(
        crypto.createHash('sha256').update(content).digest('hex'),
      )
      expect(result.size).toBe(Buffer.byteLength(content))
    })

    it('rejects when the path is a directory (EISDIR at stream time)', async () => {
      await expect(hashFile(tempDir)).rejects.toMatchObject({
        code: 'EISDIR',
      })
    })
  })

  describe('assembleManifest', () => {
    it('builds a posix-relative manifest for nested paths', async () => {
      const nestedDir = path.join(tempDir, 'sub', 'dir')
      mkdirSync(nestedDir, { recursive: true })
      const nestedFile = path.join(nestedDir, 'file1.txt')
      const topFile = path.join(tempDir, 'file2.txt')
      writeFileSync(nestedFile, 'nested')
      writeFileSync(topFile, 'top')

      const result = await assembleManifest(tempDir, [nestedFile, topFile])

      expect(result.skipped).toEqual([])
      expect(result.entries).toHaveLength(2)
      expect(result.manifest.algo).toBe('sha256')
      const fileKeys = Object.keys(result.manifest.files)
      expect(fileKeys).toHaveLength(2)
      expect(fileKeys).toContain('file2.txt')
      expect(fileKeys).toContain('sub/dir/file1.txt')
      expect(result.manifest.files['sub/dir/file1.txt']!.size).toBe(
        Buffer.byteLength('nested'),
      )
    })

    it('skips a path outside basePath', async () => {
      const basePath = path.join(tempDir, 'base')
      mkdirSync(basePath, { recursive: true })
      const outsideFile = path.join(tempDir, 'outside.txt')
      writeFileSync(outsideFile, 'outside')

      const result = await assembleManifest(basePath, [outsideFile])

      expect(result.entries).toEqual([])
      expect(result.manifest.files).toEqual({})
      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0]!.path).toBe(outsideFile)
    })

    it('skips a duplicate relative path', async () => {
      const filePath = path.join(tempDir, 'dup.txt')
      writeFileSync(filePath, 'dup')

      const result = await assembleManifest(tempDir, [filePath, filePath])

      expect(result.entries).toHaveLength(1)
      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0]!.reason).toContain('duplicate')
    })
  })

  describe('deriveApiV1BaseUrl', () => {
    it('swaps the trailing v0/ segment for v1/', () => {
      expect(deriveApiV1BaseUrl('https://api.socket.dev/v0/')).toBe(
        'https://api.socket.dev/v1/',
      )
    })

    it('returns undefined when the base has no v0/ segment', () => {
      expect(deriveApiV1BaseUrl('https://example.com/api/')).toBeUndefined()
    })
  })

  describe('SocketSdk#createFullScanFromManifest', () => {
    it('returns a 201 success result and passes through the created data', async () => {
      nock('https://api.socket.dev')
        .post('/v1/orgs/test-org/full-scans')
        .reply(201, {
          branch: 'main',
          commit_hash: 'abc123',
          commit_message: 'test',
          committers: ['dev'],
          created_at: '2026-01-01T00:00:00Z',
          html_report_url: 'https://socket.dev/report/scan-1',
          id: 'scan-1',
          organization_id: 'org-1',
          pull_request: 1,
          repository_id: 'repo-1',
          scan_type: 'full',
          unsupported_files: [],
          updated_at: '2026-01-01T00:00:00Z',
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.createFullScanFromManifest(
        'test-org',
        manifest,
        { repo: 'test-repo' },
      )

      expect(result.success).toBe(true)
      expect(result.status).toBe(201)
      if (result.success && result.status === 201) {
        expect(result.data.id).toBe('scan-1')
        expect(result.data.unsupported_files).toEqual([])
      }
    })

    it('returns a 202 pending result with the blob-presence breakdown', async () => {
      nock('https://api.socket.dev')
        .post('/v1/orgs/test-org/full-scans')
        .reply(202, {
          algo: 'sha256',
          missing: [{ hash: 'a'.repeat(64), path: 'package.json', size: 10 }],
          present: [],
          unsupported: [],
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.createFullScanFromManifest(
        'test-org',
        manifest,
        { repo: 'test-repo' },
      )

      expect(result.success).toBe(true)
      expect(result.status).toBe(202)
      if (result.success && result.status === 202) {
        expect(result.data.missing).toHaveLength(1)
        expect(result.data.present).toEqual([])
      }
    })

    it('returns a 403 error result', async () => {
      nock('https://api.socket.dev')
        .post('/v1/orgs/test-org/full-scans')
        .reply(403, {
          error: 'Forbidden',
          message: 'missing scope full-scans:create',
          statusCode: 403,
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.createFullScanFromManifest(
        'test-org',
        manifest,
        { repo: 'test-repo' },
      )

      expect(result.success).toBe(false)
      expect(result.status).toBe(403)
    })

    it('sends only the defined params keys in the JSON body', async () => {
      let capturedBody: Record<string, unknown> | undefined

      const scope = nock('https://api.socket.dev')
      scope.on('request', (_req, _interceptor, body) => {
        capturedBody = JSON.parse(body) as Record<string, unknown>
      })
      scope.post('/v1/orgs/test-org/full-scans').reply(201, {
        branch: 'main',
        commit_hash: '',
        commit_message: '',
        committers: [],
        created_at: '2026-01-01T00:00:00Z',
        html_report_url: 'https://socket.dev/report/scan-1',
        id: 'scan-1',
        organization_id: 'org-1',
        pull_request: 0,
        repository_id: 'repo-1',
        scan_type: 'full',
        unsupported_files: [],
        updated_at: '2026-01-01T00:00:00Z',
      })

      const client = createTestClient('test-api-token', { retries: 0 })
      await client.createFullScanFromManifest('test-org', manifest, {
        repo: 'test-repo',
      })

      expect(capturedBody).toBeDefined()
      expect(capturedBody!['repo']).toBe('test-repo')
      expect(capturedBody!['manifest']).toEqual(manifest)
      expect(capturedBody).not.toHaveProperty('ephemeral')
      expect(capturedBody).not.toHaveProperty('branch')
      expect(capturedBody).not.toHaveProperty('workspace')
    })
  })

  describe('SocketSdk#uploadBlobs', () => {
    it('sends a multipart part named sha256:<hash> per entry', async () => {
      const filePath = path.join(tempDir, 'a.txt')
      writeFileSync(filePath, 'blob content')
      const hash = crypto
        .createHash('sha256')
        .update('blob content')
        .digest('hex')

      let capturedBody = ''
      const blobScope1 = nock('https://api.socket.dev')
      blobScope1.on('request', (_req, _interceptor, body) => {
        capturedBody = decodeMultipartBody(body)
      })
      blobScope1
        .post('/v1/orgs/test-org/blobs')
        .reply(200, { already_existed: [], stored: [`sha256:${hash}`] })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.uploadBlobs('test-org', [
        { hash, localPath: filePath, name: 'a.txt' },
      ])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.stored).toEqual([`sha256:${hash}`])
      }
      expect(capturedBody).toContain(`name="sha256:${hash}"`)
      expect(capturedBody).toContain('filename="a.txt"')
    })

    it('auto-hashes and defaults name to the basename when omitted', async () => {
      const filePath = path.join(tempDir, 'nested', 'b.txt')
      mkdirSync(path.dirname(filePath), { recursive: true })
      writeFileSync(filePath, 'auto hash content')
      const expectedHash = crypto
        .createHash('sha256')
        .update('auto hash content')
        .digest('hex')

      let capturedBody = ''
      const blobScope2 = nock('https://api.socket.dev')
      blobScope2.on('request', (_req, _interceptor, body) => {
        capturedBody = decodeMultipartBody(body)
      })
      blobScope2
        .post('/v1/orgs/test-org/blobs')
        .reply(200, { already_existed: [`sha256:${expectedHash}`], stored: [] })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.uploadBlobs('test-org', [
        { localPath: filePath },
      ])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.already_existed).toEqual([`sha256:${expectedHash}`])
      }
      expect(capturedBody).toContain(`name="sha256:${expectedHash}"`)
      expect(capturedBody).toContain('filename="b.txt"')
    })

    it('resolves to an error envelope (never rejects) when a localPath does not exist', async () => {
      const missingPath = path.join(tempDir, 'missing.txt')
      const client = createTestClient('test-api-token', { retries: 0 })

      const result = await client.uploadBlobs('test-org', [
        { localPath: missingPath },
      ])

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.error).toContain(missingPath)
      }
    })

    it('resolves to an error envelope (never rejects) when a localPath is a directory', async () => {
      const dirPath = path.join(tempDir, 'a-directory')
      mkdirSync(dirPath, { recursive: true })
      const client = createTestClient('test-api-token', { retries: 0 })

      const result = await client.uploadBlobs('test-org', [
        { localPath: dirPath },
      ])

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.error).toContain(dirPath)
      }
    })
  })

  describe('underivable v1 base URL', () => {
    it('createFullScanFromManifest fails closed with no network call', async () => {
      const client = createTestClient('test-api-token', {
        baseUrl: 'https://example.com/api/',
        retries: 0,
      })

      const result = await client.createFullScanFromManifest(
        'test-org',
        manifest,
        { repo: 'test-repo' },
      )

      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.error).toContain('v1')
    })

    it('uploadBlobs fails closed with no network call', async () => {
      const client = createTestClient('test-api-token', {
        baseUrl: 'https://example.com/api/',
        retries: 0,
      })

      const result = await client.uploadBlobs('test-org', [
        { hash: 'a'.repeat(64), localPath: path.join(tempDir, 'unused.txt') },
      ])

      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.error).toContain('v1')
    })
  })
})
