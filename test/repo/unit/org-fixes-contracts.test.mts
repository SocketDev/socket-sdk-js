/**
 * @file Fix computation, package version, and verification request contracts.
 */
import nock from 'nock'
import { beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { validateOrgFixesOptions } from '../../../src/org-fixes.mts'
import { setupNockEnvironment } from '../../utils/environment.mts'

import type { OrgFixesOptions } from '../../../src/types/fixes.mts'

let client: SocketSdk

beforeEach(() => {
  client = new SocketSdk('test-token', {
    baseUrl: 'https://api.socket.dev/v0/',
    retries: 0,
  })
})

describe('organization fix contracts', () => {
  setupNockEnvironment()

  it('forwards tarball and extended fixes options without coercing the response', async () => {
    const options = {
      tar_hash: 'example-tar-hash',
      vulnerability_ids: '*',
      include_all_detected_ghsas: true,
      include_stateful_alert_ids: true,
      autofix_run_id: 'example-run',
    }
    const data = {
      fixDetails: {},
      allDetectedGhsas: ['GHSA-2345-6789-cfgh'],
      statefulAlertIds: { 'GHSA-2345-6789-cfgh': ['SOCKET-EXAMPLE-1'] },
    }
    nock('https://api.socket.dev')
      .get('/v0/orgs/example-org/fixes')
      .query(options)
      .reply(200, data)
    expect(await client.getOrgFixes('example-org', options)).toMatchObject({
      success: true,
      data,
    })
  })

  it('starts a computation with query parameters and an empty body', async () => {
    nock('https://api.socket.dev')
      .post('/v0/orgs/example-org/fixes/computations', '')
      .query({
        repo_slug: 'example-repo',
        vulnerability_ids: '*',
        allow_major_updates: false,
      })
      .reply(202, { id: 'example-computation', status: 'pending' })
    expect(
      await client.startOrgFixComputation('example-org', {
        repo_slug: 'example-repo',
        vulnerability_ids: '*',
        allow_major_updates: false,
      }),
    ).toMatchObject({
      success: true,
      status: 202,
      data: { id: 'example-computation', status: 'pending' },
    })
  })

  it.each(['pending', 'running', 'succeeded', 'failed'])(
    'preserves computation state %s and failure details',
    async status => {
      const data = {
        id: 'example-computation',
        status,
        createdAt: '2026-09-10T00:00:00Z',
        failureReason: 'timeout',
        failureDetail: 'Computation timed out',
        result: { fixDetails: {} },
      }
      nock('https://api.socket.dev')
        .get('/v0/orgs/example-org/fixes/computations/example-computation')
        .reply(200, data)
      expect(
        await client.getOrgFixComputation('example-org', 'example-computation'),
      ).toMatchObject({ success: true, status: 200, data })
    },
  )

  it.each([
    { repo_slug: 'example-repo', tar_hash: '', vulnerability_ids: '*' },
    { repo_slug: 'example-repo', tar_hash: 42, vulnerability_ids: '*' },
    { vulnerability_ids: '*' },
    {
      repo_slug: 'example-repo',
      tar_hash: 'example-tar',
      vulnerability_ids: '*',
    },
    { full_scan_id: ' ', vulnerability_ids: '*' },
    { repo_slug: 'example-repo', vulnerability_ids: '' },
  ])('rejects invalid target or vulnerability options', options => {
    expect(() => validateOrgFixesOptions(options as OrgFixesOptions)).toThrow(
      TypeError,
    )
  })

  it('preserves gzip bytes for the verification bundle', async () => {
    const bytes = Buffer.from([31, 139, 8, 0, 255, 128, 0])
    nock('https://api.socket.dev')
      .get('/v0/orgs/example-org/patches/verify-bundle/example-patch')
      .reply(200, bytes, { 'Content-Type': 'application/gzip' })
    const result = await client.downloadOrgPatchVerificationBundle(
      'example-org',
      'example-patch',
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Buffer.from(result.data)).toEqual(bytes)
    }
  })
})

describe('v1 package version history', () => {
  setupNockEnvironment()

  it('encodes the whole PURL and preserves unknown dates and prerelease flags', async () => {
    const purl =
      'pkg:npm/@example/module@1.0.0?download_url=https://example.test/package#src'
    const data = {
      purl,
      versions: JSON.parse(
        '[{"version":"2.0.0-beta.1","publishedAt":null,"prerelease":true},{"version":"1.0.0","publishedAt":null,"prerelease":null}]',
      ) as unknown,
    }
    nock('https://api.socket.dev')
      .get(`/v1/orgs/example-org/purl/versions/${encodeURIComponent(purl)}`)
      .query({ limit: '2' })
      .reply(200, data)
    expect(
      await client.getOrgPurlVersions('example-org', purl, { limit: 2 }),
    ).toMatchObject({ success: true, data })
  })

  it.each([0, -1, 1.5, Infinity, NaN])(
    'rejects invalid limit %s before a request',
    async limit => {
      await expect(
        client.getOrgPurlVersions('example-org', 'pkg:npm/example', { limit }),
      ).rejects.toBeInstanceOf(TypeError)
    },
  )

  it('supports an explicit v1 base for custom endpoints', async () => {
    nock('https://custom.example.test')
      .get('/api/orgs/example-org/purl/versions/pkg%3Anpm%2Fexample')
      .reply(200, { purl: 'pkg:npm/example', versions: [] })
    expect(
      await new SocketSdk('test-token', {
        retries: 0,
        apiV1BaseUrl: 'https://custom.example.test/api/',
      }).getOrgPurlVersions('example-org', 'pkg:npm/example'),
    ).toMatchObject({ success: true })
  })
})
