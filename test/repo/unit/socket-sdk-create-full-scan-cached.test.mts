/**
 * @file Happy-path tests for the transparent v1 content-addressed blob-cache
 *   path inside `SocketSdk#createFullScan` (`#tryCreateFullScanViaManifest`):
 *   a first-try 201, the exact v0 `CreateOrgFullScan` key-set parity on that
 *   201 mapping, and the cache-miss round trip (upload missing blobs, re-post
 *   the manifest). Fallback reasons live in
 *   `socket-sdk-create-full-scan-cached-fallback.test.mts`; v1-body param
 *   normalization (tmp/committers/pull_request) lives in
 *   `socket-sdk-create-full-scan-cached-params.test.mts`.
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
} from '../../utils/environment.mts'
import {
  buildV0Body,
  buildV1CreatedBody,
  FILE_CONTENT,
} from '../../utils/full-scan-v1-fixtures.mts'

import type { JsonRecord } from '../../utils/full-scan-v1-fixtures.mts'
import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'

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

  afterEach(async () => {
    await safeDelete(tempDir)
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

  it('emits exactly the v0 CreateOrgFullScan key set on the transparent v1 success path', async () => {
    nock('https://api.socket.dev')
      .post('/v1/orgs/test-org/full-scans')
      .reply(201, buildV1CreatedBody())

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
      workspace: 'test-workspace',
    })

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    // Exact key set from openapi.json's `CreateOrgFullScan` 201 schema
    // (additionalProperties: false), sorted.
    // oxlint-disable-next-line unicorn/no-array-sort -- toSorted throws on Node <20 (engines floor 18.20.8); Object.keys returns a fresh array so in-place sort is safe.
    expect(Object.keys(result.data).sort()).toEqual([
      'api_url',
      'branch',
      'commit_hash',
      'commit_message',
      'committers',
      'created_at',
      'html_report_url',
      'html_url',
      'id',
      'integration_branch_url',
      'integration_commit_url',
      'integration_pull_request_url',
      'integration_repo_url',
      'integration_type',
      'organization_id',
      'organization_slug',
      'pull_request',
      'repo',
      'repository_id',
      'repository_slug',
      'scan_state',
      'scan_type',
      'unmatchedFiles',
      'updated_at',
      'workspace',
    ])

    const data = result.data as unknown as JsonRecord
    expect(data['organization_slug']).toBe('test-org')
    expect(data['repo']).toBe('test-repo')
    expect(data['repository_slug']).toBe('test-repo')
    expect(data['workspace']).toBe('test-workspace')
    expect(data['api_url']).toBeNull()
    expect(data['html_url']).toBeNull()
    expect(data['integration_type']).toBeNull()
    expect(data['integration_repo_url']).toBeNull()
    expect(data['integration_branch_url']).toBeNull()
    expect(data['integration_commit_url']).toBeNull()
    expect(data['integration_pull_request_url']).toBeNull()
    expect(data['scan_state']).toBeNull()
  })

  it('defaults workspace to an empty string when not provided', async () => {
    nock('https://api.socket.dev')
      .post('/v1/orgs/test-org/full-scans')
      .reply(201, buildV1CreatedBody())

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as unknown as JsonRecord)['workspace']).toBe('')
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
    scope.on('request', (_req, interceptor, body) => {
      if (interceptor.path === '/v1/orgs/test-org/blobs') {
        requestOrder.push('blobs')
        blobBody = body
      }
    })
    scope
      .post('/v1/orgs/test-org/blobs')
      .reply(200, { already_existed: [], stored: [`sha256:${fileHash}`] })

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
})
