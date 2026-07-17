/**
 * @file Fallback-reason tests for the transparent v1 content-addressed
 *   blob-cache path inside `SocketSdk#createFullScan`
 *   (`#tryCreateFullScanViaManifest`) — every way the v1 attempt bails to the
 *   v0 multipart upload: unsupported query params, a skipped/unrepresentable
 *   manifest path, an unexpected throw during manifest assembly, a 202 with no
 *   local match, a failed blob upload, and retry exhaustion with no progress or
 *   with shrinking-but-never-201 progress. Happy-path tests live in
 *   `socket-sdk-create-full-scan-cached.test.mts`; v1-body param normalization
 *   lives in `socket-sdk-create-full-scan-cached-params.test.mts`.
 */
import crypto from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assembleManifest } from '../../../src/full-scans-v1.mts'
import {
  createTestClient,
  setupNockEnvironment,
} from '../../utils/environment.mts'
import {
  buildV0Body,
  FILE_CONTENT,
} from '../../utils/full-scan-v1-fixtures.mts'

// Default passthrough to the real implementation; the one test in this file
// that needs a v1-attempt throw overrides with `mockRejectedValueOnce`, so
// the catch-all fallback can be exercised without corrupting disk state the
// v0 fallback would also need to read.
vi.mock(import('../../../src/full-scans-v1.mts'), async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, assembleManifest: vi.fn(actual.assembleManifest) }
})

describe('SocketSdk#createFullScan cache-aware v1 path — fallback reasons', () => {
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

  it('falls back to v0 with no v1 request when a path resolves outside pathsRelativeTo', async () => {
    const outsideDir = mkdtempSync(
      path.join(os.tmpdir(), 'socket-sdk-full-scan-outside-'),
    )
    const outsideFile = path.join(outsideDir, 'outside.json')
    writeFileSync(outsideFile, '{}')

    try {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans')
        .query({ repo: 'test-repo' })
        .reply(200, buildV0Body())

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.createFullScan(
        'test-org',
        [filePath, outsideFile],
        {
          pathsRelativeTo: tempDir,
          repo: 'test-repo',
        },
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('scan-v0')
      }
    } finally {
      rmSync(outsideDir, { force: true, recursive: true })
    }
  })

  it('falls back to v0 when the v1 manifest attempt throws unexpectedly', async () => {
    // assembleManifest/hashFile only throw for real disk problems (ENOENT,
    // EISDIR), and those same paths would also break the v0 fallback's own
    // file read — so the catch-all is exercised via a mocked rejection
    // instead, leaving the (perfectly readable) fixture file intact for v0.
    vi.mocked(assembleManifest).mockRejectedValueOnce(
      new Error('simulated assembleManifest failure'),
    )

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

  it('falls back to v0 when a 202 reports a missing blob with no local match', async () => {
    nock('https://api.socket.dev')
      .post('/v1/orgs/test-org/full-scans')
      .reply(202, {
        algo: 'sha256',
        missing: [{ hash: 'a'.repeat(64), path: 'no-such-file.json', size: 1 }],
        present: [],
        unsupported: [],
      })

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

  it('falls back to v0 when uploadBlobs returns a non-success result mid-loop', async () => {
    const scope = nock('https://api.socket.dev')
    scope.post('/v1/orgs/test-org/full-scans').reply(202, {
      algo: 'sha256',
      missing: [
        { hash: fileHash, path: 'package.json', size: FILE_CONTENT.length },
      ],
      present: [],
      unsupported: [],
    })
    // A 4xx keeps uploadBlobs resolving with `success: false` (rather than
    // throwing, which a 5xx would) so this exercises the
    // `if (!uploadResult.success)` fallback branch specifically.
    scope
      .post('/v1/orgs/test-org/blobs')
      .reply(403, { error: { message: 'forbidden' } })

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

  it('skips v1 entirely when integration_org_slug is set without integration_type', async () => {
    nock('https://api.socket.dev')
      .post('/v0/orgs/test-org/full-scans')
      .query({ integration_org_slug: 'gh-org', repo: 'test-repo' })
      .reply(200, buildV0Body())

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      integration_org_slug: 'gh-org',
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('scan-v0')
    }
  })

  it('falls back to v0 after exactly 3 manifest posts when progress never reaches a 201', async () => {
    const otherContent = '{"other":true}'
    const otherFilePath = path.join(tempDir, 'other.json')
    writeFileSync(otherFilePath, otherContent)
    const otherHash = crypto
      .createHash('sha256')
      .update(otherContent)
      .digest('hex')

    const missingSets = [
      [
        { hash: fileHash, path: 'package.json', size: FILE_CONTENT.length },
        { hash: otherHash, path: 'other.json', size: otherContent.length },
      ],
      [{ hash: otherHash, path: 'other.json', size: otherContent.length }],
      [{ hash: fileHash, path: 'package.json', size: FILE_CONTENT.length }],
    ]
    let fullScanCallCount = 0

    const scope = nock('https://api.socket.dev')
    scope
      .post('/v1/orgs/test-org/full-scans')
      .times(3)
      .reply(function () {
        const missing = missingSets[fullScanCallCount]!
        fullScanCallCount += 1
        return [202, { algo: 'sha256', missing, present: [], unsupported: [] }]
      })
    scope
      .post('/v1/orgs/test-org/blobs')
      .times(3)
      .reply(200, { already_existed: [], stored: [] })

    nock('https://api.socket.dev')
      .post('/v0/orgs/test-org/full-scans')
      .query({ repo: 'test-repo' })
      .reply(200, buildV0Body())

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan(
      'test-org',
      [filePath, otherFilePath],
      {
        pathsRelativeTo: tempDir,
        repo: 'test-repo',
      },
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('scan-v0')
    }
    expect(fullScanCallCount).toBe(3)
  })
})
