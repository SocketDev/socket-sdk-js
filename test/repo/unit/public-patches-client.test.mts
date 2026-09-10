/**
 * @file Public patch route contracts, authentication, and binary bytes.
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { SocketPatchClient } from '../../../src/public-patches-client.mts'
import { setupNockEnvironment } from '../../utils/environment.mts'

const PATCH_ORIGIN = 'https://patches-api.socket.dev'
const PURL = 'pkg:npm/@example/package@1.0.0'
const PAYLOAD = { components: [{ purl: PURL }] }

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
