/**
 * @file Tests for the transparent v1 content-addressed blob-cache path inside
 *   `SocketSdk#createFullScan` (`#tryCreateFullScanViaManifest`). Covers the
 *   happy path (all blobs present, cache-miss round trip), every fallback
 *   reason (route unavailable, generic v1 error, unsupported query params),
 *   404 memoization across calls, and the no-progress retry abort — all while
 *   asserting the v0 caller-visible envelope never changes shape.
 */
import crypto from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createTestClient,
  setupNockEnvironment,
} from '../utils/environment.mts'

const ORG_SLUG = 'test-org'
const FILE_CONTENT = '{"name":"pkg","version":"1.0.0"}'

type JsonRecord = Record<string, unknown>

/**
 * Minimal but complete v1 201 (`FullScanV1CreatedData`) response body — every
 * field is required by the type, so every 201 fixture needs the full set.
 */
function buildV1CreatedBody(overrides?: JsonRecord | undefined): JsonRecord {
  return {
    branch: 'main',
    commit_hash: 'abc123',
    commit_message: 'test',
    committers: [],
    created_at: '2026-01-01T00:00:00Z',
    html_report_url: 'https://socket.dev/report/scan-v1',
    id: 'scan-v1',
    organization_id: 'org-1',
    pull_request: 0,
    repository_id: 'repo-1',
    scan_type: 'full',
    unsupported_files: [],
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Minimal v0 create-response body (create-shared.ts field set); only the
 * fields these tests assert on need real values.
 */
function buildV0Body(overrides?: JsonRecord | undefined): JsonRecord {
  return {
    api_url: 'https://api.socket.dev/v0/scans/scan-v0',
    created_at: '2026-01-01T00:00:00Z',
    html_report_url: 'https://socket.dev/report/scan-v0',
    id: 'scan-v0',
    integration_repo_url: 'https://github.com/org/repo',
    integration_type: 'api',
    organization_id: 'org-1',
    organization_slug: ORG_SLUG,
    repo: 'test-repo',
    repository_id: 'repo-1',
    repository_slug: 'test-repo',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('SocketSdk#createFullScan cache-aware v1 path', () => {
  setupNockEnvironment()

  let tempDir: string
  let filePath: string
  let fileHash: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-sdk-full-scan-cache-'))
    filePath = path.join(tempDir, 'package.json')
    writeFileSync(filePath, FILE_CONTENT)
    fileHash = crypto.createHash('sha256').update(FILE_CONTENT).digest('hex')
  })

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true })
  })

  it('creates via v1 on the first try when every blob is already present', async () => {
    nock('https://api.socket.dev')
      .post('/v1/orgs/test-org/full-scans')
      .reply(
        201,
        buildV1CreatedBody({
          unsupported_files: [
            { hash: 'f'.repeat(64), path: 'ignored.min.js', size: 1 },
          ],
        }),
      )

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('scan-v1')
      expect(result.data.html_report_url).toBe(
        'https://socket.dev/report/scan-v1',
      )
      const unmatchedFiles = (result.data as unknown as JsonRecord)[
        'unmatchedFiles'
      ]
      expect(unmatchedFiles).toEqual(['ignored.min.js'])
    }
  })

  it('uploads missing blobs and re-posts the manifest on a cache miss', async () => {
    const requestOrder: string[] = []
    const scope = nock('https://api.socket.dev')

    scope.post('/v1/orgs/test-org/full-scans').reply(function () {
      requestOrder.push('full-scans-1')
      return [
        202,
        {
          algo: 'sha256',
          missing: [
            { hash: fileHash, path: 'package.json', size: FILE_CONTENT.length },
          ],
          present: [],
          unsupported: [],
        },
      ]
    })

    let blobBody = ''
    scope.post('/v1/orgs/test-org/blobs').reply(function (_uri, requestBody) {
      requestOrder.push('blobs')
      blobBody = String(requestBody)
      return [200, { already_existed: [], stored: [`sha256:${fileHash}`] }]
    })

    scope.post('/v1/orgs/test-org/full-scans').reply(function () {
      requestOrder.push('full-scans-2')
      return [201, buildV1CreatedBody()]
    })

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('scan-v1')
    }
    expect(requestOrder).toEqual(['full-scans-1', 'blobs', 'full-scans-2'])
    expect(blobBody).toContain(`name="sha256:${fileHash}"`)
    expect(blobBody).toContain('filename="package.json"')
  })

  it('falls back to v0 and memoizes when the v1 route is absent (404)', async () => {
    let v1HitCount = 0
    nock('https://api.socket.dev')
      .post('/v1/orgs/test-org/full-scans')
      .reply(() => {
        v1HitCount += 1
        return [404, { error: 'not found' }]
      })

    nock('https://api.socket.dev')
      .post('/v0/orgs/test-org/full-scans')
      .query({ repo: 'test-repo' })
      .times(2)
      .reply(200, buildV0Body())

    const client = createTestClient('test-api-token', { retries: 0 })

    const firstResult = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })
    expect(firstResult.success).toBe(true)
    if (firstResult.success) {
      expect(firstResult.data.id).toBe('scan-v0')
    }

    const secondResult = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })
    expect(secondResult.success).toBe(true)
    if (secondResult.success) {
      expect(secondResult.data.id).toBe('scan-v0')
    }

    expect(v1HitCount).toBe(1)
  })

  it('falls back to v0 for a genuine v1 error without memoizing', async () => {
    nock('https://api.socket.dev')
      .post('/v1/orgs/test-org/full-scans')
      .reply(400, { error: { message: 'invalid repo' } })

    nock('https://api.socket.dev')
      .post('/v0/orgs/test-org/full-scans')
      .query({ repo: 'test-repo' })
      .reply(200, buildV0Body())

    const client = createTestClient('test-api-token', { retries: 0 })

    const firstResult = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })
    expect(firstResult.success).toBe(true)
    if (firstResult.success) {
      expect(firstResult.data.id).toBe('scan-v0')
    }

    // No memoization on a non-404 failure — the next call must try v1 again.
    const secondV1Mock = nock('https://api.socket.dev')
      .post('/v1/orgs/test-org/full-scans')
      .reply(201, buildV1CreatedBody({ id: 'scan-v1-second' }))

    const secondResult = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })
    expect(secondResult.success).toBe(true)
    if (secondResult.success) {
      expect(secondResult.data.id).toBe('scan-v1-second')
    }
    expect(secondV1Mock.isDone()).toBe(true)
  })

  it('skips v1 entirely when integration_type is set', async () => {
    nock('https://api.socket.dev')
      .post('/v0/orgs/test-org/full-scans')
      .query({ integration_type: 'github', repo: 'test-repo' })
      .reply(200, buildV0Body())

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      integration_type: 'github',
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('scan-v0')
    }
  })

  it('maps tmp:true to ephemeral:true and drops the tmp key', async () => {
    let capturedBody: JsonRecord | undefined
    nock('https://api.socket.dev')
      .post('/v1/orgs/test-org/full-scans')
      .reply(function (_uri, requestBody) {
        capturedBody = requestBody as JsonRecord
        return [201, buildV1CreatedBody()]
      })

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
      tmp: true,
    })

    expect(result.success).toBe(true)
    expect(capturedBody).toBeDefined()
    expect(capturedBody!['ephemeral']).toBe(true)
    expect(capturedBody).not.toHaveProperty('tmp')
  })

  it('maps a single committers string to a one-element array', async () => {
    let capturedBody: JsonRecord | undefined
    nock('https://api.socket.dev')
      .post('/v1/orgs/test-org/full-scans')
      .reply(function (_uri, requestBody) {
        capturedBody = requestBody as JsonRecord
        return [201, buildV1CreatedBody()]
      })

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      committers: 'alice@example.com',
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    expect(capturedBody).toBeDefined()
    expect(capturedBody!['committers']).toEqual(['alice@example.com'])
  })

  it('falls back to v0 when a 202 reports no progress across retries', async () => {
    const scope = nock('https://api.socket.dev')
    const sameMissing = {
      algo: 'sha256',
      missing: [
        { hash: fileHash, path: 'package.json', size: FILE_CONTENT.length },
      ],
      present: [],
      unsupported: [],
    }

    scope.post('/v1/orgs/test-org/full-scans').reply(202, sameMissing)
    scope
      .post('/v1/orgs/test-org/blobs')
      .reply(200, { already_existed: [], stored: [`sha256:${fileHash}`] })
    scope.post('/v1/orgs/test-org/full-scans').reply(202, sameMissing)

    nock('https://api.socket.dev')
      .post('/v0/orgs/test-org/full-scans')
      .query({ repo: 'test-repo' })
      .reply(200, buildV0Body())

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('scan-v0')
    }
  })
})
