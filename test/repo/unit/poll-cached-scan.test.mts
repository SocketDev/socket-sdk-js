/**
 * @file Unit tests for the cached-scan polling helper. Exercises the 200/202
 *   loop and the bounded timeout with an injected clock and sleep so no real
 *   time passes.
 */
import { describe, expect, it } from 'vitest'

import { ResponseError } from '../../../src/http-client.mts'
import {
  HTTP_STATUS_ACCEPTED,
  pollCachedScan,
  readProcessingBody,
} from '../../../src/utils/poll.mts'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'

// Build a minimal HttpResponse stand-in for the helper. Only status, ok, text()
// and headers are read by the code under test.
function makeResponse(status: number, body: string): HttpResponse {
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Accepted',
    ok: status >= 200 && status < 300,
    headers: { 'content-type': 'application/json' },
    text: () => body,
  } as unknown as HttpResponse
}

// A clock the test advances by hand. Returns the current value each call.
function makeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 0
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

describe('pollCachedScan', () => {
  it('returns parsed JSON on an immediate 200 (cache hit)', async () => {
    let calls = 0
    const result = await pollCachedScan({
      requestFn: async () => {
        calls += 1
        return makeResponse(200, JSON.stringify({ diff_scan: { id: 'd1' } }))
      },
    })

    expect(calls).toBe(1)
    expect(result).toEqual({ diff_scan: { id: 'd1' } })
  })

  it('polls on 202 then resolves with the 200 result (cache miss)', async () => {
    const clock = makeClock()
    const slept: number[] = []
    const statuses = [HTTP_STATUS_ACCEPTED, HTTP_STATUS_ACCEPTED, 200]
    let index = 0

    const result = await pollCachedScan({
      now: clock.now,
      pollIntervalMs: 2000,
      sleep: async (ms: number) => {
        slept.push(ms)
        clock.advance(ms)
      },
      requestFn: async () => {
        const status = statuses[index]!
        index += 1
        return status === 200
          ? makeResponse(200, JSON.stringify({ id: 'ready' }))
          : makeResponse(
              status,
              JSON.stringify({ status: 'processing', id: 'x' }),
            )
      },
    })

    // Three requests: 202, 202, 200. Two sleeps between them.
    expect(index).toBe(3)
    expect(slept).toEqual([2000, 2000])
    expect(result).toEqual({ id: 'ready' })
  })

  it('throws a bounded timeout error when 202 never clears', async () => {
    const clock = makeClock()
    await expect(
      pollCachedScan({
        label: 'diff-42',
        maxPollMs: 6000,
        pollIntervalMs: 2000,
        now: clock.now,
        sleep: async (ms: number) => {
          clock.advance(ms)
        },
        requestFn: async () =>
          makeResponse(
            HTTP_STATUS_ACCEPTED,
            JSON.stringify({ status: 'processing', id: 'diff-42' }),
          ),
      }),
    ).rejects.toThrow(/scan diff-42 still processing after 6s \(\d+ polls\)/)
  })

  it('uses the server-reported id from the 202 body over the label', async () => {
    const clock = makeClock()
    await expect(
      pollCachedScan({
        // The caller passes one label, but the server reports a different id;
        // the server's id should win in the surfaced message.
        label: 'caller-label',
        maxPollMs: 4000,
        pollIntervalMs: 2000,
        now: clock.now,
        sleep: async (ms: number) => {
          clock.advance(ms)
        },
        requestFn: async () =>
          makeResponse(
            HTTP_STATUS_ACCEPTED,
            JSON.stringify({ status: 'processing', id: 'server-id-99' }),
          ),
      }),
    ).rejects.toThrow(/scan server-id-99 still processing/)
  })

  it('falls back to the label when the 202 body has no id', async () => {
    const clock = makeClock()
    await expect(
      pollCachedScan({
        label: 'fallback-label',
        maxPollMs: 4000,
        pollIntervalMs: 2000,
        now: clock.now,
        sleep: async (ms: number) => {
          clock.advance(ms)
        },
        requestFn: async () =>
          makeResponse(
            HTTP_STATUS_ACCEPTED,
            JSON.stringify({ status: 'processing' }),
          ),
      }),
    ).rejects.toThrow(/scan fallback-label still processing/)
  })

  it('keeps polling when the 202 body is missing or not JSON', async () => {
    const clock = makeClock()
    const statuses = [HTTP_STATUS_ACCEPTED, 200]
    let index = 0
    const result = await pollCachedScan({
      pollIntervalMs: 1000,
      now: clock.now,
      sleep: async (ms: number) => {
        clock.advance(ms)
      },
      requestFn: async () => {
        const status = statuses[index]!
        index += 1
        // First poll returns a non-JSON 202 body; the loop must still proceed.
        return status === 200
          ? makeResponse(200, JSON.stringify({ id: 'done' }))
          : makeResponse(HTTP_STATUS_ACCEPTED, 'not json')
      },
    })

    expect(index).toBe(2)
    expect(result).toEqual({ id: 'done' })
  })

  it('lets a non-2xx response throw a ResponseError (no polling)', async () => {
    let calls = 0
    await expect(
      pollCachedScan({
        requestFn: async () => {
          calls += 1
          return makeResponse(
            404,
            JSON.stringify({ error: { message: 'nope' } }),
          )
        },
      }),
    ).rejects.toBeInstanceOf(ResponseError)

    expect(calls).toBe(1)
  })

  it('omits the scan label from the timeout message when not provided', async () => {
    const clock = makeClock()
    await expect(
      pollCachedScan({
        maxPollMs: 4000,
        pollIntervalMs: 2000,
        now: clock.now,
        sleep: async (ms: number) => {
          clock.advance(ms)
        },
        requestFn: async () =>
          makeResponse(
            HTTP_STATUS_ACCEPTED,
            JSON.stringify({ status: 'processing' }),
          ),
      }),
    ).rejects.toThrow(/Socket API scan still processing/)
  })
})

describe('readProcessingBody', () => {
  it('extracts status and id from a JSON 202 body', () => {
    const body = readProcessingBody(
      makeResponse(
        HTTP_STATUS_ACCEPTED,
        JSON.stringify({ status: 'processing', id: 'scan-7' }),
      ),
    )
    expect(body).toEqual({ id: 'scan-7', status: 'processing' })
  })

  it('returns undefined fields for non-string status/id', () => {
    const body = readProcessingBody(
      makeResponse(HTTP_STATUS_ACCEPTED, JSON.stringify({ status: 1, id: 2 })),
    )
    expect(body).toEqual({ id: undefined, status: undefined })
  })

  it('returns undefined for an empty body', () => {
    expect(readProcessingBody(makeResponse(HTTP_STATUS_ACCEPTED, ''))).toBe(
      undefined,
    )
  })

  it('returns undefined for a non-JSON body', () => {
    expect(
      readProcessingBody(makeResponse(HTTP_STATUS_ACCEPTED, '<html>nope')),
    ).toBe(undefined)
  })

  it('returns undefined for a JSON non-object body', () => {
    expect(
      readProcessingBody(makeResponse(HTTP_STATUS_ACCEPTED, '"a string"')),
    ).toBe(undefined)
  })
})
