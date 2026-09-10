/**
 * @file Advanced v1 full-scan streaming and polling behavior.
 */
import { PassThrough } from 'node:stream'

import nock from 'nock'
import { beforeEach, describe, expect, it } from 'vitest'

import { createSdkApiContext } from '../../../src/api-client.mts'
import { SocketSdk } from '../../../src/index.mts'
import {
  pollOrgFullScanV1,
  validateFullScanPollOptions,
} from '../../../src/full-scan-polling-v1.mts'
import { setupNockEnvironment } from '../../utils/environment.mts'

const path = '/v1/orgs/example-org/full-scans/example-scan'
const artifact = { id: 'example-artifact', name: 'example-package' }
let client: SocketSdk

beforeEach(() => {
  client = new SocketSdk('test-token', { retries: 0 })
})
const context = createSdkApiContext({
  baseUrl: 'https://api.socket.dev/v0/',
  retries: 0,
})

async function collectRecords(
  records: AsyncIterable<unknown>,
): Promise<unknown[]> {
  const values: unknown[] = []
  for await (const value of records) {
    values.push(value)
  }
  return values
}

describe('v1 full-scan result states', () => {
  setupNockEnvironment()

  it('reads processing JSON from the streaming response', async () => {
    nock('https://api.socket.dev')
      .get(path)
      .reply(202, { status: 'processing', id: 'example-scan', progress: 0.75 })
    expect(
      await client.getOrgFullScanV1('example-org', 'example-scan'),
    ).toMatchObject({
      success: true,
      status: 202,
      data: { status: 'processing', id: 'example-scan', progress: 0.75 },
    })
  })

  it('yields the first record before the response ends and preserves split UTF-8', async () => {
    const stream = new PassThrough()
    nock('https://api.socket.dev')
      .get(path)
      .reply(200, () => stream, {
        'X-Socket-Scan-Status': 'complete',
        'X-Socket-Scanned-At': '2026-09-10T00:00:00Z',
      })
    const pending = client.getOrgFullScanV1('example-org', 'example-scan')
    stream.write(`${JSON.stringify(artifact)}\r\n`)
    const result = await pending
    expect(result).toMatchObject({
      success: true,
      data: { status: 'complete', scannedAt: '2026-09-10T00:00:00Z' },
    })
    if (!result.success || result.data.status !== 'complete') {
      throw new Error('Expected complete scan')
    }
    expect(await result.data.records.next()).toMatchObject({
      done: false,
      value: artifact,
    })
    expect(stream.writableEnded).toBe(false)
    const nextArtifact = { id: 'example-unicode', name: 'café' }
    const bytes = Buffer.from(`${JSON.stringify(nextArtifact)}\n`)
    const offset = bytes.indexOf(Buffer.from('é')) + 1
    stream.write(bytes.subarray(0, offset))
    stream.end(bytes.subarray(offset))
    expect(await collectRecords(result.data.records)).toEqual([nextArtifact])
  })

  it('closes the response when a consumer stops after one record', async () => {
    const stream = new PassThrough()
    nock('https://api.socket.dev')
      .get(path)
      .reply(200, () => stream, { 'X-Socket-Scan-Status': 'complete' })
    const pending = client.getOrgFullScanV1('example-org', 'example-scan')
    stream.write(`${JSON.stringify(artifact)}\n`)
    const result = await pending
    if (!result.success || result.data.status !== 'complete') {
      throw new Error('Expected complete scan')
    }
    for await (const value of result.data.records) {
      expect(value).toMatchObject(artifact)
      break
    }
    expect((await result.data.records.next()).done).toBe(true)
    stream.destroy()
  })

  it('rejects malformed records after yielding earlier records without replay', async () => {
    nock('https://api.socket.dev')
      .get(path)
      .once()
      .reply(200, `${JSON.stringify(artifact)}\n{"incomplete":`, {
        'X-Socket-Scan-Status': 'complete',
      })
    const result = await client.getOrgFullScanV1('example-org', 'example-scan')
    if (!result.success || result.data.status !== 'complete') {
      throw new Error('Expected complete scan')
    }
    expect(await result.data.records.next()).toMatchObject({ value: artifact })
    await expect(result.data.records.next()).rejects.toBeInstanceOf(Error)
  })

  it('returns the terminal failure without treating HTTP 200 as a complete scan', async () => {
    const error = {
      code: 'scan_failed',
      retryable: true,
      message: 'immutable scan failed',
    }
    nock('https://api.socket.dev')
      .get(path)
      .reply(200, `${JSON.stringify({ type: 'error', value: error })}\n`, {
        'X-Socket-Scan-Status': 'failed',
      })
    expect(
      await client.getOrgFullScanV1('example-org', 'example-scan'),
    ).toMatchObject({
      success: true,
      status: 200,
      data: { status: 'failed', error },
    })
  })

  it.each([
    { status: 200, body: '{}', headers: {} },
    { status: 202, body: { status: 'processing' }, headers: {} },
    { status: 200, body: '{}', headers: { 'X-Socket-Scan-Status': 'failed' } },
  ])(
    'rejects malformed response state $status',
    async ({ status, body, headers }) => {
      nock('https://api.socket.dev').get(path).reply(status, body, headers)
      await expect(
        client.getOrgFullScanV1('example-org', 'example-scan'),
      ).rejects.toBeInstanceOf(Error)
    },
  )
})

describe('v1 full-scan polling', () => {
  setupNockEnvironment()

  it('polls processing until complete using the same request path', async () => {
    let now = 0
    const delays: number[] = []
    nock('https://api.socket.dev')
      .get(path)
      .reply(202, { status: 'processing', id: 'example-scan' })
      .get(path)
      .reply(200, `${JSON.stringify(artifact)}\n`, {
        'X-Socket-Scan-Status': 'complete',
      })
    const result = await pollOrgFullScanV1(
      context,
      'example-org',
      'example-scan',
      {
        maxPollMs: 100,
        pollIntervalMs: 10,
        runtime: {
          now: () => now,
          async sleep(milliseconds) {
            delays.push(milliseconds)
            now += milliseconds
          },
        },
      },
    )
    expect(delays).toEqual([10])
    if (!result.success || result.data.status !== 'complete') {
      throw new Error('Expected complete scan')
    }
    expect(await collectRecords(result.data.records)).toEqual([artifact])
  })

  it('stops polling on a terminal failed response even when retryable is true', async () => {
    const error = {
      code: 'scan_failed',
      retryable: true,
      message: 'immutable scan failed',
    }
    nock('https://api.socket.dev')
      .get(path)
      .once()
      .reply(200, `${JSON.stringify({ type: 'error', value: error })}\n`, {
        'X-Socket-Scan-Status': 'failed',
      })
    expect(
      await client.pollOrgFullScanV1('example-org', 'example-scan'),
    ).toMatchObject({ success: true, data: { status: 'failed', error } })
  })

  it('returns a bounded timeout without a further request', async () => {
    await expect(
      pollOrgFullScanV1(context, 'example-org', 'example-scan', {
        maxPollMs: 0,
      }),
    ).rejects.toBeInstanceOf(Error)
  })

  it('cancels before a request when its signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      pollOrgFullScanV1(context, 'example-org', 'example-scan', {
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(Error)
  })

  it('cancels between polls without starting another request', async () => {
    const controller = new AbortController()
    nock('https://api.socket.dev')
      .get(path)
      .once()
      .reply(202, { status: 'processing', id: 'example-scan' })
    const result = pollOrgFullScanV1(context, 'example-org', 'example-scan', {
      signal: controller.signal,
      runtime: {
        now: () => 0,
        async sleep() {
          controller.abort()
        },
      },
    })
    await expect(result).rejects.toBeInstanceOf(Error)
  })

  it('aborts an in-flight response when the polling deadline expires', async () => {
    const stream = new PassThrough()
    let expire = () => {}
    let cancelled = false
    const slowContext = createSdkApiContext({
      baseUrl: 'https://api.socket.dev/v0/',
      retries: 0,
      hooks: { onResponse: () => expire() },
    })
    nock('https://api.socket.dev')
      .get(path)
      .reply(202, () => stream)
    stream.write('{"status":"processing"')
    try {
      await expect(
        pollOrgFullScanV1(slowContext, 'example-org', 'example-scan', {
          runtime: {
            now: () => 0,
            async sleep() {},
            scheduleDeadline(milliseconds, onExpire) {
              expect(milliseconds).toBeGreaterThan(0)
              expire = onExpire
              return () => {
                cancelled = true
              }
            },
          },
        }),
      ).rejects.toBeInstanceOf(Error)
      expect(cancelled).toBe(true)
    } finally {
      stream.destroy()
    }
  })

  it.each([
    [0, 0],
    [-1, 1],
    [1, -1],
    [Infinity, 1],
    [1, NaN],
  ])('rejects invalid polling bounds', (timeout, interval) => {
    expect(() => validateFullScanPollOptions(timeout, interval)).toThrow(
      RangeError,
    )
  })
})
