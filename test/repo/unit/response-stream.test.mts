/**
 * @file Tests for src/utils/response-stream.mts — the drain that gives a
 *   streaming error response a readable body. Covers the buffered-transport
 *   passthrough, the accessors over the drained bytes, and the size cap that
 *   keeps a runaway error body from becoming the memory problem streaming was
 *   supposed to remove.
 */

import { Readable } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { MAX_RESPONSE_SIZE } from '../../../src/constants.mts'
import { bufferStreamedErrorResponse } from '../../../src/utils/response-stream.mts'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'
import type { IncomingMessage } from 'node:http'

function streamingResponse(chunks: Iterable<Buffer>): HttpResponse {
  const empty = Buffer.alloc(0)
  return {
    arrayBuffer: () => empty.buffer,
    body: empty,
    headers: { 'content-type': 'application/json' },
    json: () => undefined,
    ok: false,
    rawResponse: Readable.from(chunks) as unknown as IncomingMessage,
    status: 400,
    statusText: 'Bad Request',
    text: () => '',
  }
}

describe('bufferStreamedErrorResponse', () => {
  it('returns the response untouched when the transport buffered it', async () => {
    const buffered = { ...streamingResponse([]), rawResponse: undefined }

    expect(await bufferStreamedErrorResponse(buffered)).toBe(buffered)
  })

  it('exposes the drained bytes through every body accessor', async () => {
    const payload = '{"error":{"message":"nope"}}'
    const drained = await bufferStreamedErrorResponse(
      streamingResponse([
        Buffer.from(payload.slice(0, 5), 'utf8'),
        Buffer.from(payload.slice(5), 'utf8'),
      ]),
    )

    expect(drained.text()).toBe(payload)
    expect(drained.json()).toEqual({ error: { message: 'nope' } })
    expect(drained.body.toString('utf8')).toBe(payload)
    expect(Buffer.from(drained.arrayBuffer()).toString('utf8')).toBe(payload)
    // Status and headers survive so error reporting keeps its context.
    expect(drained.status).toBe(400)
    expect(drained.headers['content-type']).toBe('application/json')
  })

  it('stops reading once the body passes the size cap', async () => {
    const chunkSize = 1024 * 1024
    let chunksPulled = 0
    function* oversized(): Generator<Buffer> {
      // Enough chunks to exceed the cap twice over if the drain never stopped.
      for (let i = 0; i < (MAX_RESPONSE_SIZE / chunkSize) * 2; i += 1) {
        chunksPulled += 1
        yield Buffer.alloc(chunkSize, 0x61)
      }
    }

    const drained = await bufferStreamedErrorResponse(
      streamingResponse(oversized()),
    )

    expect(chunksPulled).toBeLessThanOrEqual(MAX_RESPONSE_SIZE / chunkSize + 1)
    expect(drained.body.byteLength).toBeLessThanOrEqual(MAX_RESPONSE_SIZE)
  })
})
