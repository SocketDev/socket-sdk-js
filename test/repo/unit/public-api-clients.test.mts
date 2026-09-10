/**
 * @file Public PURL and patch route contracts, authentication, and binary
 *   bytes.
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { SocketPatchClient } from '../../../src/public-patches-client.mts'
import { SocketPurlClient } from '../../../src/public-purl-client.mts'
import { setupNockEnvironment } from '../../utils/environment.mts'

import type {
  PublicApiClientOptions,
  PublicPurlQuery,
} from '../../../src/types/purl.mts'

const PURL_ORIGIN = 'https://purl-api.socket.dev'
const PATCH_ORIGIN = 'https://patches-api.socket.dev'
const PURL = 'pkg:npm/@example/package@1.0.0'
const ARTIFACT = {
  inputPurl: PURL,
  name: 'package',
  namespace: '@example',
  type: 'npm',
}
const PAYLOAD = { components: [{ purl: PURL }] }

describe('SocketPurlClient', () => {
  setupNockEnvironment()

  it('ignores inherited credentials and origins in client options', async () => {
    const options = Object.create({
      apiToken: 'test-api-token',
      baseUrl: 'https://example.invalid/',
    }) as PublicApiClientOptions
    options.retries = 0
    const client = new SocketPurlClient(options)
    nock(PURL_ORIGIN, { badheaders: ['authorization'] })
      .get(`/purl/${encodeURIComponent(PURL)}`)
      .reply(200, JSON.stringify(ARTIFACT))
    expect((await client.getPurl(PURL)).success).toBe(true)
    expect(() => client.batchOrgPackageFetch('example-org', PAYLOAD)).toThrow(
      TypeError,
    )
  })

  it('encodes a complete PURL and sends no anonymous Authorization header', async () => {
    nock(PURL_ORIGIN, { badheaders: ['authorization'] })
      .get(`/purl/${encodeURIComponent(PURL)}`)
      .query({ alerts: true, compact: false, actions: 'warn,error' })
      .reply(200, `${JSON.stringify(ARTIFACT)}\n`)
    const result = await new SocketPurlClient({ retries: 0 }).getPurl(PURL, {
      alerts: true,
      compact: false,
      actions: 'warn,error',
    })
    expect(result).toEqual({ success: true, status: 200, data: [ARTIFACT] })
  })

  it('supports explicit bearer credentials and organization labels', async () => {
    nock(PURL_ORIGIN, {
      reqheaders: { authorization: 'Bearer test-api-token' },
    })
      .post('/orgs/example-org/batch', PAYLOAD)
      .query({ labels: 'production', purlErrors: true })
      .reply(200, JSON.stringify(ARTIFACT))
    const result = await new SocketPurlClient({
      apiToken: 'test-api-token',
      authScheme: 'bearer',
      retries: 0,
    }).batchOrgPackageFetch('example-org', PAYLOAD, {
      labels: 'production',
      purlErrors: true,
    })
    expect(result).toMatchObject({ success: true, data: [ARTIFACT] })
  })

  it('chunks organization streams and preserves every record variant', async () => {
    const error = {
      _type: 'purlError',
      value: { error: 'not found', inputPurl: 'pkg:npm/missing' },
    }
    nock(PURL_ORIGIN)
      .post('/orgs/example-org/batch', PAYLOAD)
      .reply(200, JSON.stringify(ARTIFACT))
    nock(PURL_ORIGIN)
      .post('/orgs/example-org/batch', {
        components: [{ purl: 'pkg:npm/missing' }],
      })
      .reply(200, JSON.stringify(error))
    const results = []
    const client = new SocketPurlClient({
      apiToken: 'test-api-token',
      retries: 0,
    })
    for await (const result of client.batchOrgPackageStream(
      'example-org',
      { components: [...PAYLOAD.components, { purl: 'pkg:npm/missing' }] },
      { chunkSize: 1, concurrencyLimit: 1 },
    )) {
      results.push(result)
    }
    expect(results.map(result => result.data)).toEqual([ARTIFACT, error])
  })

  it('rejects organization requests without explicit credentials', () => {
    const client = new SocketPurlClient()
    expect(() => client.batchOrgPackageFetch('example-org', PAYLOAD)).toThrow(
      TypeError,
    )
    expect(() => client.batchOrgPackageStream('example-org', PAYLOAD)).toThrow(
      TypeError,
    )
  })

  it.each([
    { poll: true },
    { summary: true },
    { timeoutSec: 20 },
    { labels: 'production' },
    { alerts: 'true' },
    { actions: 'invalid' },
  ])('rejects unsupported JavaScript query options %j', query => {
    expect(() =>
      new SocketPurlClient().batchPackageFetch(
        PAYLOAD,
        query as PublicPurlQuery,
      ),
    ).toThrow(TypeError)
  })

  it('returns errors and hooks without dropping the service message', async () => {
    const calls: string[] = []
    nock(PURL_ORIGIN).post('/batch', PAYLOAD).reply(403, {
      error: 'Forbidden',
      message: 'Organization access denied',
    })
    const client = new SocketPurlClient({
      retries: 0,
      hooks: {
        onRequest: info => calls.push(info.method),
        onResponse: info => calls.push(String(info.status)),
      },
    })
    expect(await client.batchPackageFetch(PAYLOAD)).toMatchObject({
      success: false,
      status: 403,
      error: expect.stringContaining('Organization access denied'),
    })
    expect(calls).toEqual(['POST', '403'])
  })
})

describe('SocketPatchClient', () => {
  setupNockEnvironment()

  it('covers all public JSON routes with encoded identifiers', async () => {
    const client = new SocketPatchClient({ retries: 0 })
    const searches = { canAccessPaidPatches: false, patches: [] }
    const routes = [
      [
        'by-cve',
        'CVE-2026-12345',
        () => client.fetchPatchesByCVE('CVE-2026-12345'),
      ],
      [
        'by-ghsa',
        'GHSA-abcd-1234-abcd',
        () => client.fetchPatchesByGHSA('GHSA-abcd-1234-abcd'),
      ],
      ['by-package', PURL, () => client.fetchPatchesByPackage(PURL)],
      ['view', 'example/patch', () => client.viewPatch('example/patch')],
    ] as const
    for (const [route, identifier, call] of routes) {
      nock(PATCH_ORIGIN, { badheaders: ['authorization'] })
        .get(`/patch/${route}/${encodeURIComponent(identifier)}`)
        .reply(200, searches)
      expect(await call()).toEqual({
        success: true,
        status: 200,
        data: searches,
      })
    }
    nock(PATCH_ORIGIN)
      .post('/patch/batch', PAYLOAD)
      .reply(200, { canAccessPaidPatches: false, packages: [], skipped: [] })
    expect(await client.fetchPatches(PAYLOAD)).toMatchObject({
      success: true,
      data: { packages: [] },
    })
    nock(PATCH_ORIGIN)
      .post('/patch/package', { uuids: ['example-uuid'] })
      .reply(200, { results: {} })
    expect(await client.getPatchPackages(['example-uuid'])).toMatchObject({
      success: true,
      data: { results: {} },
    })
  })

  it('preserves binary bytes for blob and diff downloads', async () => {
    const bytes = Buffer.from([0, 255, 128, 10, 13])
    const client = new SocketPatchClient({ retries: 0 })
    nock(PATCH_ORIGIN)
      .get('/patch/blob/example-hash')
      .reply(200, bytes, { 'content-type': 'application/octet-stream' })
    nock(PATCH_ORIGIN)
      .get('/patch/diff/example-uuid')
      .reply(200, bytes, { 'content-type': 'application/octet-stream' })
    for (const result of [
      await client.getPatchBlob('example-hash'),
      await client.getPatchDiff('example-uuid'),
    ]) {
      expect(result.success).toBe(true)
      if (result.success) {
        expect([...result.data]).toEqual([...bytes])
      }
    }
  })

  it('does not accept runtime credentials on the anonymous patch surface', async () => {
    const options = { retries: 0, apiToken: 'test-api-token' }
    nock(PATCH_ORIGIN, { badheaders: ['authorization'] })
      .get('/patch/by-cve/CVE-2026-12345')
      .reply(200, { patches: [] })
    expect(
      (await new SocketPatchClient(options).fetchPatchesByCVE('CVE-2026-12345'))
        .success,
    ).toBe(true)
  })
})
