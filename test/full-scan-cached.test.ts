import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index.js'

process.on('unhandledRejection', cause => {
  throw new Error('Unhandled rejection', { cause })
})

const NDJSON =
  '{"type":"npm","name":"lodash","version":"4.17.21"}\n' +
  '{"type":"npm","name":"react","version":"18.2.0"}\n'

describe('SocketSdk#getOrgFullScanCached', () => {
  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  it('returns parsed artifacts on a 200 cache hit', async () => {
    nock('https://api.socket.dev')
      .get('/v0/orgs/test-org/full-scans/scan-1')
      .query({ cached: 'true' })
      .reply(200, NDJSON)

    const client = new SocketSdk('apiKey')
    const res = await client.getOrgFullScanCached('test-org', 'scan-1')

    expect(res).toEqual({
      success: true,
      status: 200,
      data: [
        { type: 'npm', name: 'lodash', version: '4.17.21' },
        { type: 'npm', name: 'react', version: '18.2.0' }
      ]
    })
  })

  it('polls on 202 until the cached result is ready', async () => {
    nock('https://api.socket.dev')
      .get('/v0/orgs/test-org/full-scans/scan-2')
      .query({ cached: 'true' })
      .reply(202, { status: 'processing', id: 'scan-2' })
    nock('https://api.socket.dev')
      .get('/v0/orgs/test-org/full-scans/scan-2')
      .query({ cached: 'true' })
      .reply(200, NDJSON)

    const client = new SocketSdk('apiKey')
    const res = await client.getOrgFullScanCached('test-org', 'scan-2', {
      pollIntervalMs: 1
    })

    expect(res.success).toBe(true)
    expect(res).toMatchObject({ status: 200 })
    expect((res as { data: unknown[] }).data).toHaveLength(2)
  })

  it('returns a not-ready error when polling exceeds the budget', async () => {
    nock('https://api.socket.dev')
      .get('/v0/orgs/test-org/full-scans/scan-3')
      .query({ cached: 'true' })
      .reply(202, { status: 'processing', id: 'scan-3' })

    const client = new SocketSdk('apiKey')
    const res = await client.getOrgFullScanCached('test-org', 'scan-3', {
      pollIntervalMs: 5,
      maxPollMs: 1
    })

    expect(res.success).toBe(false)
    expect(res).toMatchObject({
      status: 202,
      error: 'Cached full scan not ready'
    })
  })

  it('omits the cached param and does not poll when cached is false', async () => {
    nock('https://api.socket.dev')
      .get('/v0/orgs/test-org/full-scans/scan-4')
      .reply(200, NDJSON)

    const client = new SocketSdk('apiKey')
    const res = await client.getOrgFullScanCached('test-org', 'scan-4', {
      cached: false
    })

    expect(res).toMatchObject({ success: true, status: 200 })
  })

  it('surfaces a 404 as an error result', async () => {
    nock('https://api.socket.dev')
      .get('/v0/orgs/test-org/full-scans/missing')
      .query({ cached: 'true' })
      .reply(404, { error: { message: 'Not found' } })

    const client = new SocketSdk('apiKey')
    const res = await client.getOrgFullScanCached('test-org', 'missing')

    expect(res.success).toBe(false)
    expect(res).toMatchObject({ status: 404 })
  })
})
