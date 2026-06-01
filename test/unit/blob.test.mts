/**
 * @file Tests for the content-addressed blob helpers (src/blob.ts). Covers
 *   single-blob fetch + decode, binary detection, truncation, chunked manifest
 *   reconstruction, and manifest error paths. The blob host is mocked with nock
 *   so no network is touched.
 */

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fetchBlob, tryDecodeText } from '../../src/blob'

const HOST = 'https://socketusercontent.com'

beforeEach(() => {
  nock.disableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
})

describe('tryDecodeText', () => {
  it('decodes valid UTF-8', () => {
    expect(tryDecodeText(new TextEncoder().encode('hello'))).toBe('hello')
  })

  it('returns undefined on a NUL byte', () => {
    expect(tryDecodeText(new Uint8Array([104, 0, 105]))).toBeUndefined()
  })

  it('returns undefined on invalid UTF-8', () => {
    expect(tryDecodeText(new Uint8Array([0xff, 0xfe, 0xfd]))).toBeUndefined()
  })
})

describe('fetchBlob single blob', () => {
  it('fetches and decodes a Q-prefixed text blob', async () => {
    nock(HOST)
      .get('/blob/Qabc')
      .reply(200, 'console.log(1)', { 'content-type': 'text/plain' })

    const result = await fetchBlob('Qabc', { baseUrl: HOST })
    expect(result.binary).toBe(false)
    expect(result.text).toBe('console.log(1)')
    expect(result.truncated).toBe(false)
    expect(result.contentType).toBe('text/plain')
    expect(result.bytes).toBe(14)
  })

  it('flags binary content (NUL byte) without text', async () => {
    nock(HOST)
      .get('/blob/Qbin')
      .reply(200, Buffer.from([0x00, 0x01, 0x02]))

    const result = await fetchBlob('Qbin', { baseUrl: HOST })
    expect(result.binary).toBe(true)
    expect(result.text).toBe('')
  })

  it('truncates beyond maxBytes', async () => {
    nock(HOST).get('/blob/Qbig').reply(200, 'abcdefghij')

    const result = await fetchBlob('Qbig', { baseUrl: HOST, maxBytes: 4 })
    expect(result.truncated).toBe(true)
    expect(result.text).toBe('abcd')
    expect(result.bytes).toBe(10)
  })

  it('throws on a non-2xx response', async () => {
    nock(HOST).get('/blob/Qmissing').reply(404, 'not found')
    await expect(fetchBlob('Qmissing', { baseUrl: HOST })).rejects.toThrow(
      /blob fetch 404/,
    )
  })
})

describe('fetchBlob chunked blob', () => {
  it('reconstructs an S-prefixed blob from its manifest', async () => {
    // S-hash manifest lives at the Q-swapped hash.
    nock(HOST)
      .get('/blob/Qhash')
      .reply(200, JSON.stringify({ chunks: ['Qc1', 'Qc2'], size: 6 }), {
        'content-type': 'application/json',
      })
    nock(HOST).get('/blob/Qc1').reply(200, 'abc')
    nock(HOST).get('/blob/Qc2').reply(200, 'def')

    const result = await fetchBlob('Shash', { baseUrl: HOST })
    expect(result.text).toBe('abcdef')
    expect(result.bytes).toBe(6)
    expect(result.binary).toBe(false)
  })

  it('throws when the manifest is not valid JSON', async () => {
    nock(HOST).get('/blob/Qbad').reply(200, '{ not json')
    await expect(fetchBlob('Sbad', { baseUrl: HOST })).rejects.toThrow(
      /not valid JSON/,
    )
  })

  it('throws when the manifest lacks a chunks array', async () => {
    nock(HOST)
      .get('/blob/Qnochunks')
      .reply(200, JSON.stringify({ size: 1 }))
    await expect(fetchBlob('Snochunks', { baseUrl: HOST })).rejects.toThrow(
      /missing a valid 'chunks' array/,
    )
  })

  it('fetches all chunks (no early-stop) when offset is present but size is absent', async () => {
    // With offsets but no `size`, the early-stop optimization must NOT fire:
    // stopping early would report the partial sum as the total and mislabel
    // truncation. The manifest has 3 chunks (3 bytes each = 9 total) with
    // offsets, no size, and maxBytes below the total — all 3 must still be
    // fetched and `bytes` must reflect the full 9, with truncated=true.
    nock(HOST)
      .get('/blob/Qmanifest')
      .reply(
        200,
        JSON.stringify({ chunks: ['Qa', 'Qb', 'Qc'], offset: [0, 3, 6] }),
        { 'content-type': 'application/json' },
      )
    nock(HOST).get('/blob/Qa').reply(200, 'aaa')
    nock(HOST).get('/blob/Qb').reply(200, 'bbb')
    nock(HOST).get('/blob/Qc').reply(200, 'ccc')

    const result = await fetchBlob('Smanifest', { baseUrl: HOST, maxBytes: 4 })
    // All 3 chunks fetched → true total 9 is known; bytes reports 9, not a
    // partial sum, and truncated is correctly true (9 > 4). Returned text is
    // the first 4 bytes of the concatenated 'aaabbbccc'.
    expect(result.bytes).toBe(9)
    expect(result.truncated).toBe(true)
    expect(result.text).toBe('aaab')
  })
})
