/**
 * @file PURL transport, record validation, and incremental stream contracts.
 */

import { PassThrough, Readable } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { createSdkApiContext } from '../../../src/api-client.mts'
import { MAX_RESPONSE_SIZE } from '../../../src/constants.mts'
import {
  fetchPurlRecords,
  parsePurlRecord,
  readPurlResponse,
  streamBatchPurlRecords,
  streamPurlRecords,
} from '../../../src/purl.mts'
import { promiseWithResolvers } from '../../../src/utils.mts'
import { createPublicApiServer } from '../../utils/public-api-server.mts'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'
import type { IncomingMessage } from 'node:http'

const ARTIFACT = {
  inputPurl: 'pkg:npm/example-package@1.0.0',
  name: 'example-package',
  type: 'npm',
}

function createPurlResponse(
  raw?: Readable | undefined,
  text = '',
): HttpResponse {
  const body = Buffer.from(text)
  return {
    arrayBuffer: () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    body,
    headers: { 'content-type': 'application/x-ndjson' },
    json: () => JSON.parse(text),
    ok: true,
    rawResponse: raw as IncomingMessage | undefined,
    status: 200,
    statusText: 'OK',
    text: () => text,
  }
}

describe('PURL record parsing', () => {
  it.each(['return', 'throw'] as const)(
    'closes an unread PURL response on iterator %s',
    async operation => {
      const raw = new PassThrough()
      const iterator = readPurlResponse(createPurlResponse(raw))
      if (operation === 'return') {
        await iterator.return(undefined)
      } else {
        await expect(
          iterator.throw(new Error('Consumer stopped')),
        ).rejects.toThrow()
      }
      expect(raw.destroyed).toBe(true)
    },
  )

  it('closes a direct PURL response before awaiting a pending iterator read', async () => {
    const raw = new PassThrough()
    const iterator = readPurlResponse(createPurlResponse(raw))
    const pending = iterator.next()
    const rejected = expect(pending).rejects.toThrow()
    await iterator.return(undefined)
    await rejected
    expect(raw.destroyed).toBe(true)
  })

  it('reads the buffered body after the Node response stream has ended', async () => {
    const text = JSON.stringify(ARTIFACT)
    const raw = Readable.from([text])
    for await (const chunk of raw) {
      expect(chunk).toBe(text)
    }
    const iterator = readPurlResponse(createPurlResponse(raw, text))
    expect(await iterator.next()).toEqual({ done: false, value: ARTIFACT })
    expect((await iterator.next()).done).toBe(true)
  })
  it('rejects a summary whose error counts are missing', () => {
    expect(() =>
      parsePurlRecord(
        JSON.stringify({
          _type: 'summary',
          value: { purl_input: 1, resolved: 0, errors: {} },
        }),
      ),
    ).toThrow(TypeError)
  })

  it('preserves artifact, optional retry hints, and summary variants', () => {
    const records = [
      ARTIFACT,
      {
        _type: 'purlError',
        value: { inputPurl: 'pkg:npm/missing', error: 'not found' },
      },
      {
        _type: 'purlError',
        value: {
          inputPurl: 'pkg:npm/pending',
          error: 'timeout',
          retryable: true,
        },
      },
      {
        _type: 'summary',
        value: {
          purl_input: 3,
          resolved: 1,
          errors: {
            purl_malformed: 0,
            purl_ecosystem_not_enabled: 0,
            package_not_found: 1,
          },
        },
      },
    ]
    expect(
      records.map(record => parsePurlRecord(JSON.stringify(record))),
    ).toEqual(records)
  })

  it.each([
    'null',
    '[]',
    'true',
    '{}',
    '{"_type":"other","value":{}}',
    '{"_type":"purlError","value":{}}',
    '{"type":',
  ])('rejects invalid records: %s', value => {
    expect(() => parsePurlRecord(value)).toThrow()
  })

  it('decodes split UTF-8, CRLF, blank lines, and the final unterminated record', async () => {
    const record = { ...ARTIFACT, name: 'example-café' }
    const bytes = Buffer.from(
      `${JSON.stringify(record)}\r\n\r\n${JSON.stringify(ARTIFACT)}`,
    )
    const split = bytes.indexOf(Buffer.from('é')) + 1
    const response = createPurlResponse(
      Readable.from([bytes.subarray(0, split), bytes.subarray(split)]),
    )
    const results = []
    for await (const entry of readPurlResponse(response)) {
      results.push(entry)
    }
    expect(results).toEqual([record, ARTIFACT])
  })

  it('supports a browser-buffered response', async () => {
    const iterator = readPurlResponse(
      createPurlResponse(undefined, JSON.stringify(ARTIFACT)),
    )
    expect(await iterator.next()).toEqual({ value: ARTIFACT, done: false })
    expect((await iterator.next()).done).toBe(true)
  })

  it('yields the first complete record before EOF and closes on consumer return', async () => {
    const raw = new PassThrough()
    const iterator = readPurlResponse(createPurlResponse(raw))
    const first = iterator.next()
    raw.write(`${JSON.stringify(ARTIFACT)}\n`)
    expect(await first).toEqual({ value: ARTIFACT, done: false })
    expect(raw.readableEnded).toBe(false)
    await iterator.return(undefined)
    expect(raw.destroyed).toBe(true)
  })
})

describe('PURL HTTP streaming', () => {
  it('preserves the response size cap for buffered fetches', async () => {
    const server = await createPublicApiServer((request, response) => {
      request.resume()
      response.end(' '.repeat(MAX_RESPONSE_SIZE) + JSON.stringify(ARTIFACT))
    })
    try {
      const context = createSdkApiContext({
        baseUrl: server.baseUrl,
        retries: 0,
      })
      await expect(
        fetchPurlRecords(context, {
          path: 'batch',
          method: 'POST',
          body: { components: [] },
        }),
      ).rejects.toThrow()
    } finally {
      await server.close()
    }
  })
  it('streams before EOF and never retries a truncated response after yielding', async () => {
    const closed = promiseWithResolvers<void>()
    let requests = 0
    let truncate: (() => void) | undefined
    const server = await createPublicApiServer((request, response) => {
      requests += 1
      request.resume()
      response.writeHead(200, { 'content-type': 'application/x-ndjson' })
      response.write(`${JSON.stringify(ARTIFACT)}\n`)
      response.on('close', () => closed.resolve())
      truncate = () => response.destroy()
    })
    try {
      const context = createSdkApiContext({
        baseUrl: server.baseUrl,
        retries: 2,
        retryDelay: 0,
      })
      const iterator = streamPurlRecords(context, {
        path: 'batch',
        method: 'POST',
        body: { components: [] },
      })
      expect((await iterator.next()).value).toMatchObject({
        success: true,
        data: ARTIFACT,
      })
      truncate!()
      await expect(iterator.next()).rejects.toThrow()
      expect((await iterator.next()).done).toBe(true)
      await closed.promise
      expect(requests).toBe(1)
    } finally {
      await server.close()
    }
  })

  it('retries an error response before yielding and preserves the response body', async () => {
    let requests = 0
    const server = await createPublicApiServer((request, response) => {
      request.resume()
      requests += 1
      if (requests === 1) {
        response.writeHead(503, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ message: 'Try again' }))
      } else {
        response.end(JSON.stringify(ARTIFACT))
      }
    })
    try {
      const context = createSdkApiContext({
        baseUrl: server.baseUrl,
        retries: 1,
        retryDelay: 0,
      })
      const results = []
      for await (const result of streamPurlRecords(context, {
        path: 'batch',
      })) {
        results.push(result)
      }
      expect(results).toEqual([{ success: true, status: 200, data: ARTIFACT }])
      expect(requests).toBe(2)
    } finally {
      await server.close()
    }
  })

  it('returns a parsing error after a valid record without silently skipping it', async () => {
    const server = await createPublicApiServer((request, response) => {
      request.resume()
      response.end(`${JSON.stringify(ARTIFACT)}\n{"type":`)
    })
    try {
      const results = []
      for await (const result of streamPurlRecords(
        createSdkApiContext({ baseUrl: server.baseUrl, retries: 0 }),
        { path: 'batch' },
      )) {
        results.push(result)
      }
      expect(results).toHaveLength(2)
      expect(results[0]).toMatchObject({ success: true, data: ARTIFACT })
      expect(results[1]).toMatchObject({ success: false })
    } finally {
      await server.close()
    }
  })

  it.each([0, -1, 1.5, Infinity, NaN])(
    'rejects invalid pool limits before requesting: %s',
    async limit => {
      const context = createSdkApiContext({
        baseUrl: 'http://127.0.0.1:1/',
        retries: 0,
      })
      const payload = { components: [{ purl: ARTIFACT.inputPurl }] }
      await expect(
        streamBatchPurlRecords(context, 'batch', payload, {
          chunkSize: limit,
        }).next(),
      ).rejects.toBeInstanceOf(RangeError)
      await expect(
        streamBatchPurlRecords(context, 'batch', payload, {
          concurrencyLimit: limit,
        }).next(),
      ).rejects.toBeInstanceOf(RangeError)
    },
  )
})
