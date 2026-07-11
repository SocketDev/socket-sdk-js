/**
 * @file V1-body param-normalization tests for the transparent v1
 *   content-addressed blob-cache path inside `SocketSdk#createFullScan`
 *   (`#tryCreateFullScanViaManifest`): `tmp` → `ephemeral`, `committers`
 *   (single string or array pass-through), and `pull_request` (numeric
 *   string, or the `0` no-PR sentinel omitted from the wire body). Happy-path
 *   and fallback-reason tests live in the sibling
 *   `socket-sdk-create-full-scan-cached*.test.mts` files.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createTestClient,
  setupNockEnvironment,
} from '../utils/environment.mts'
import {
  buildV1CreatedBody,
  FILE_CONTENT,
} from '../utils/full-scan-v1-fixtures.mts'

import type { JsonRecord } from '../utils/full-scan-v1-fixtures.mts'

describe('SocketSdk#createFullScan cache-aware v1 path — v1-body param normalization', () => {
  setupNockEnvironment()

  let tempDir: string
  let filePath: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-sdk-full-scan-cache-'))
    filePath = path.join(tempDir, 'package.json')
    writeFileSync(filePath, FILE_CONTENT)
  })

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true })
  })

  it('maps tmp:true to ephemeral:true and drops the tmp key', async () => {
    let capturedBody: JsonRecord | undefined

    const scope = nock('https://api.socket.dev')
    scope.on('request', (_req, _interceptor, body) => {
      capturedBody = JSON.parse(body) as JsonRecord
    })
    scope.post('/v1/orgs/test-org/full-scans').reply(201, buildV1CreatedBody())

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

    const scope = nock('https://api.socket.dev')
    scope.on('request', (_req, _interceptor, body) => {
      capturedBody = JSON.parse(body) as JsonRecord
    })
    scope.post('/v1/orgs/test-org/full-scans').reply(201, buildV1CreatedBody())

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

  it('passes an array of committers through flat', async () => {
    let capturedBody: JsonRecord | undefined

    const scope = nock('https://api.socket.dev')
    scope.on('request', (_req, _interceptor, body) => {
      capturedBody = JSON.parse(body) as JsonRecord
    })
    scope.post('/v1/orgs/test-org/full-scans').reply(201, buildV1CreatedBody())

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      // socket-cli casts options `as any` and may pass an array through.
      committers: ['alice@example.com', 'bob@example.com'] as unknown as string,
      pathsRelativeTo: tempDir,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    expect(capturedBody).toBeDefined()
    expect(capturedBody!['committers']).toEqual([
      'alice@example.com',
      'bob@example.com',
    ])
  })

  it('normalizes a numeric-string pull_request to a number', async () => {
    let capturedBody: JsonRecord | undefined

    const scope = nock('https://api.socket.dev')
    scope.on('request', (_req, _interceptor, body) => {
      capturedBody = JSON.parse(body) as JsonRecord
    })
    scope.post('/v1/orgs/test-org/full-scans').reply(201, buildV1CreatedBody())

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      // socket-cli sends `String(pullRequest)`.
      pull_request: '42' as unknown as number,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    expect(capturedBody).toBeDefined()
    expect(capturedBody!['pull_request']).toBe(42)
  })

  it('omits pull_request from the v1 body when it is the 0 no-PR sentinel', async () => {
    let capturedBody: JsonRecord | undefined

    const scope = nock('https://api.socket.dev')
    scope.on('request', (_req, _interceptor, body) => {
      capturedBody = JSON.parse(body) as JsonRecord
    })
    scope.post('/v1/orgs/test-org/full-scans').reply(201, buildV1CreatedBody())

    const client = createTestClient('test-api-token', { retries: 0 })
    const result = await client.createFullScan('test-org', [filePath], {
      pathsRelativeTo: tempDir,
      pull_request: 0,
      repo: 'test-repo',
    })

    expect(result.success).toBe(true)
    expect(capturedBody).toBeDefined()
    expect(capturedBody).not.toHaveProperty('pull_request')
  })
})
