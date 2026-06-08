/**
 * @file Tests for the content-addressed blob helpers (src/blob.ts). Covers
 *   single-blob fetch + decode, binary detection, truncation, chunked manifest
 *   reconstruction, manifest error paths, and content-hash verification. The
 *   blob host is mocked with nock so no network is touched. Hashes are derived
 *   from bodies via `blobHashOf` so the requested hash and the served bytes
 *   stay consistent — `verifyHash` is on by default, so a mismatched (fake)
 *   hash would make every fetch throw.
 */

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { blobHashOf, fetchBlob, tryDecodeText } from '../../src/blob.mts'

const HOST = 'https://socketusercontent.com'

// Serve `body` at its own content-address and return that Q-hash, so fetches
// pass the default integrity check. `sPrefix` returns the S-discriminated form
// (same digest body) for chunked-manifest entry points.
function serve(body: string | Uint8Array, sPrefix = false): string {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  const qHash = blobHashOf(bytes)
  nock(HOST)
    .get(`/blob/${encodeURIComponent(qHash)}`)
    .reply(200, Buffer.from(bytes))
  return sPrefix ? `S${qHash.slice(1)}` : qHash
}

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

describe('blobHashOf', () => {
  it('computes the canonical Q + base64url(sha256) address', () => {
    expect(blobHashOf(new TextEncoder().encode('hello'))).toBe(
      'QLPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ',
    )
  })
})

describe('fetchBlob single blob', () => {
  it('fetches and decodes a Q-prefixed text blob', async () => {
    const hash = blobHashOf(new TextEncoder().encode('console.log(1)'))
    nock(HOST)
      .get(`/blob/${encodeURIComponent(hash)}`)
      .reply(200, 'console.log(1)', { 'content-type': 'text/plain' })

    const result = await fetchBlob(hash, { baseUrl: HOST })
    expect(result.binary).toBe(false)
    expect(result.text).toBe('console.log(1)')
    expect(result.truncated).toBe(false)
    expect(result.contentType).toBe('text/plain')
    expect(result.bytes).toBe(14)
  })

  it('flags binary content (NUL byte) without text', async () => {
    const hash = serve(new Uint8Array([0x00, 0x01, 0x02]))

    const result = await fetchBlob(hash, { baseUrl: HOST })
    expect(result.binary).toBe(true)
    expect(result.text).toBe('')
  })

  it('truncates beyond maxBytes', async () => {
    const hash = serve('abcdefghij')

    const result = await fetchBlob(hash, { baseUrl: HOST, maxBytes: 4 })
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

describe('fetchBlob integrity verification', () => {
  it('throws when fetched bytes do not match the requested hash', async () => {
    // Serve mismatched content at a real-looking Q hash.
    const wrongHash = blobHashOf(new TextEncoder().encode('expected'))
    nock(HOST)
      .get(`/blob/${encodeURIComponent(wrongHash)}`)
      .reply(200, 'tampered')
    await expect(fetchBlob(wrongHash, { baseUrl: HOST })).rejects.toThrow(
      /blob integrity check failed/,
    )
  })

  it('skips verification when verifyHash is false', async () => {
    const wrongHash = blobHashOf(new TextEncoder().encode('expected'))
    nock(HOST)
      .get(`/blob/${encodeURIComponent(wrongHash)}`)
      .reply(200, 'tampered')
    const result = await fetchBlob(wrongHash, {
      baseUrl: HOST,
      verifyHash: false,
    })
    expect(result.text).toBe('tampered')
  })
})

describe('fetchBlob chunked blob', () => {
  it('reconstructs an S-prefixed blob from its manifest', async () => {
    const c1 = serve('abc')
    const c2 = serve('def')
    // Manifest body lives at the Q-swapped hash of the S-hash entry point.
    const sHash = serve(
      JSON.stringify({ chunks: [c1, c2], size: 6 }),
      /* sPrefix */ true,
    )

    const result = await fetchBlob(sHash, { baseUrl: HOST })
    expect(result.text).toBe('abcdef')
    expect(result.bytes).toBe(6)
    expect(result.binary).toBe(false)
  })

  it('throws when the manifest is not valid JSON', async () => {
    const sHash = serve('{ not json', true)
    await expect(fetchBlob(sHash, { baseUrl: HOST })).rejects.toThrow(
      /not valid JSON/,
    )
  })

  it('throws when the manifest lacks a chunks array', async () => {
    const sHash = serve(JSON.stringify({ size: 1 }), true)
    await expect(fetchBlob(sHash, { baseUrl: HOST })).rejects.toThrow(
      /missing a valid 'chunks' array/,
    )
  })

  it('fetches all chunks (no early-stop) when offset is present but size is absent', async () => {
    // With offsets but no `size`, the early-stop optimization must NOT fire:
    // stopping early would report the partial sum as the total and mislabel
    // truncation. 3 chunks (3 bytes each = 9 total) with offsets, no size, and
    // maxBytes below the total — all 3 must still be fetched and `bytes` must
    // reflect the full 9, with truncated=true.
    const a = serve('aaa')
    const b = serve('bbb')
    const c = serve('ccc')
    const sHash = serve(
      JSON.stringify({ chunks: [a, b, c], offset: [0, 3, 6] }),
      true,
    )

    const result = await fetchBlob(sHash, { baseUrl: HOST, maxBytes: 4 })
    // All 3 chunks fetched → true total 9 is known; bytes reports 9, not a
    // partial sum, and truncated is correctly true (9 > 4). Returned text is
    // the first 4 bytes of the concatenated 'aaabbbccc'.
    expect(result.bytes).toBe(9)
    expect(result.truncated).toBe(true)
    expect(result.text).toBe('aaab')
  })
})
