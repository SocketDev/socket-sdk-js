/**
 * @file Content-addressed blob fetching for socketusercontent.com (or a
 *   compatible host). Lives outside the generated SocketSdk class because the
 *   blob CDN is not part of the api.socket.dev OpenAPI surface — it is a
 *   separate content store keyed by hash. Handles single-blob (`Q`-prefixed)
 *   and chunked (`S`-prefixed) hashes: a chunked blob is reconstructed from the
 *   manifest stored at its `Q`-swapped hash. Returns decoded text when the
 *   bytes are valid UTF-8 without NULs, otherwise flags the result as binary so
 *   callers can refuse to forward it to a model.
 */

import crypto from 'node:crypto'

import { errorMessage } from '@socketsecurity/lib/errors/message'
import { httpRequest } from '@socketsecurity/lib/http-request/request'

export interface BlobResult {
  binary: boolean
  bytes: number
  contentType: string | undefined
  text: string
  truncated: boolean
}

export interface ChunkedFetchResult {
  // Concatenated chunk bytes, possibly fewer than `totalSize` when stopped
  // early at maxBytes.
  bytes: Uint8Array
  // Total file size from the manifest, regardless of how many chunks were
  // fetched.
  totalSize: number
}

export interface FetchBlobOptions {
  baseUrl: string
  // Extra headers merged into the outbound request. Values overwrite
  // user-agent if it is also set here.
  extraHeaders?: Record<string, string> | undefined
  // Hard cap on bytes returned. Larger blobs are truncated and flagged.
  maxBytes?: number | undefined
  // Hard cap on the bytes any single request may buffer, enforced at the
  // socket layer (httpRequest's maxResponseSize) so an oversized body is
  // rejected before it is read into memory — `maxBytes` only trims what was
  // already buffered, so this is what actually bounds peak memory. Defaults to
  // `maxBytes` (or DEFAULT_MAX_BYTES), floored at MIN_MAX_RESPONSE_BYTES so a
  // chunked manifest still fits.
  maxResponseBytes?: number | undefined
  // Called with the resolved URL right before each request is dispatched
  // (chunked blobs fire this once per chunk).
  onRequest?: ((url: string) => void) | undefined
  userAgent?: string | undefined
  // Verify that fetched bytes content-address to the requested hash (the whole
  // point of a content-addressed store). On by default; throws on mismatch.
  // Set false only to read from a store that does not use Socket's hash scheme.
  verifyHash?: boolean | undefined
}

export interface RawFetchResult {
  bytes: Uint8Array
  contentType: string | undefined
}

export interface ChunkedManifest {
  _version?: string | undefined
  chunks?: unknown | undefined
  offset?: unknown | undefined
  size?: number | undefined
}

const DEFAULT_MAX_BYTES = 1024 * 1024 // 1 MB

// Floor for the per-request socket-layer cap so a chunked manifest (a small
// JSON document listing chunk hashes) still fits even when a caller passes a
// tiny maxBytes.
const MIN_MAX_RESPONSE_BYTES = 1024 * 1024 // 1 MB

// Socket's content-addressed blob hash: 'Q' + base64url(sha256(bytes)). The
// 'S' (file-stream / chunked-manifest) prefix shares the same digest body, just
// a different discriminator — its content is stored at the 'Q'-swapped hash.
//
// TEMPORARY LOCAL COPY: the canonical helpers are blobHashOf / verifyBlobHash in
// @socketsecurity/lib's crypto/hash.ts (which itself mirrors depscan
// workspaces/lib/src/storage/hash.ts). Swap this module to import them once a
// lib version exposing them is published and pinned here. Lock-step: if the
// upstream hash scheme changes, update all three.
const BLOB_HASH_PREFIX = 'Q'

/**
 * Compute the content-address of `bytes` under Socket's blob hash scheme: `Q` +
 * base64url(sha256(bytes)).
 */
export function blobHashOf(bytes: Uint8Array): string {
  return BLOB_HASH_PREFIX + crypto.hash('sha256', bytes, 'base64url')
}

/**
 * Fetch a content-addressed blob by hash. Single-blob (`Q`) hashes resolve to
 * one GET; chunked (`S`) hashes are reconstructed from their manifest. Bytes
 * beyond `maxBytes` (default 1 MB) are dropped and `truncated` is set.
 */
export async function fetchBlob(
  hash: string,
  options: FetchBlobOptions,
): Promise<BlobResult> {
  options = { __proto__: null, ...options } as typeof options
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  let buf: Uint8Array
  let contentType: string | undefined
  let originalSize: number

  if (hash[0] === 'S') {
    const chunked = await fetchChunkedBytes(hash, options, maxBytes)
    buf = chunked.bytes
    contentType = undefined
    originalSize = chunked.totalSize
  } else {
    const raw = await fetchRawBytes(hash, options)
    buf = raw.bytes
    contentType = raw.contentType
    originalSize = buf.length
  }

  const truncated = originalSize > maxBytes
  const bodyBytes = buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf
  const decoded = tryDecodeText(bodyBytes)

  return {
    binary: decoded === undefined,
    bytes: originalSize,
    contentType,
    text: decoded ?? '',
    truncated,
  }
}

/**
 * Resolve an `S`-prefixed chunked blob: fetch the manifest at the `Q`-swapped
 * hash, then fetch the listed chunks and concatenate them. Honors `maxBytes` by
 * stopping at the first chunk past the cap (using the manifest's `offset` array
 * when present, otherwise running totals).
 */
export async function fetchChunkedBytes(
  sHash: string,
  options: FetchBlobOptions,
  maxBytes: number,
): Promise<ChunkedFetchResult> {
  const manifestHash = `Q${sHash.slice(1)}`
  const manifestRaw = await fetchRawBytes(manifestHash, options)

  let manifest: ChunkedManifest
  try {
    manifest = JSON.parse(
      new TextDecoder('utf-8').decode(manifestRaw.bytes),
    ) as ChunkedManifest
  } catch (e) {
    throw new Error(
      `chunked blob manifest at ${manifestHash} is not valid JSON: ${errorMessage(e)}`,
    )
  }
  if (
    !Array.isArray(manifest.chunks) ||
    manifest.chunks.some(c => typeof c !== 'string' || !c)
  ) {
    throw new Error(
      `chunked blob manifest at ${manifestHash} is missing a valid 'chunks' array`,
    )
  }
  const chunks = manifest.chunks as string[]
  const totalSize = typeof manifest.size === 'number' ? manifest.size : -1
  // Offsets enable the early-stop optimization, but only when `size` is also
  // present (totalSize >= 0). Without `size`, stopping early would force the
  // fallback `totalSize = total` (the sum of only the FETCHED chunks), which
  // understates the true blob size and makes fetchBlob report wrong
  // `bytes`/`truncated`. Require all three: numeric size, one offset per chunk,
  // every offset numeric.
  const rawOffset = manifest.offset
  const offsets =
    totalSize >= 0 &&
    Array.isArray(rawOffset) &&
    rawOffset.length === chunks.length &&
    rawOffset.every(n => typeof n === 'number')
      ? rawOffset
      : undefined

  // Decide how many chunks we actually need. With offsets (and a known size)
  // we can stop at the first chunk whose start is at or past maxBytes; without,
  // we fetch everything and truncate after concatenation.
  let needed = chunks.length
  if (offsets) {
    needed = 0
    for (let i = 0; i < chunks.length; i += 1) {
      if (offsets[i]! >= maxBytes) {
        break
      }
      needed = i + 1
    }
  }

  const chunkBuffers = await Promise.all(
    chunks
      .slice(0, needed)
      .map(async c => (await fetchRawBytes(c, options)).bytes),
  )

  let total = 0
  for (const cb of chunkBuffers) {
    total += cb.length
  }
  const concat = new Uint8Array(total)
  let pos = 0
  for (const cb of chunkBuffers) {
    concat.set(cb, pos)
    pos += cb.length
  }

  return {
    bytes: concat,
    totalSize: totalSize >= 0 ? totalSize : total,
  }
}

/**
 * Single GET against `<baseUrl>/blob/<hash>`. No prefix logic — callers pass an
 * already-resolved hash (manifest hash, chunk hash, or single blob).
 */
export async function fetchRawBytes(
  hash: string,
  options: FetchBlobOptions,
): Promise<RawFetchResult> {
  options = { __proto__: null, ...options } as typeof options
  const url = `${options.baseUrl.replace(/\/$/u, '')}/blob/${encodeURIComponent(hash)}`

  const headers: Record<string, string> = {}
  if (options.userAgent) {
    headers['user-agent'] = options.userAgent
  }
  if (options.extraHeaders) {
    Object.assign(headers, options.extraHeaders)
  }

  // Cap the response at the socket layer so an oversized body is rejected
  // before it is buffered into memory (the lone path in this SDK that would
  // otherwise read an unbounded body — see downloadPatch / http-client.ts).
  const maxResponseSize = Math.max(
    options.maxResponseBytes ?? options.maxBytes ?? DEFAULT_MAX_BYTES,
    MIN_MAX_RESPONSE_BYTES,
  )

  options.onRequest?.(url)
  let res
  try {
    res = await httpRequest(url, { headers, maxResponseSize })
  } catch (e) {
    throw new Error(`blob request to ${url} failed: ${errorMessage(e)}`)
  }
  if (!res.ok) {
    throw new Error(`blob fetch ${res.status} for ${url}: ${res.text()}`)
  }

  const bytes = new Uint8Array(res.arrayBuffer())

  // Content-addressed integrity check: the bytes must hash to the hash we asked
  // for. httpRequest rejects (throws) past maxResponseSize rather than
  // truncating, so `bytes` is always the complete body and this is sound.
  if (options.verifyHash !== false) {
    verifyBlobHash(hash, bytes)
  }

  const contentTypeHeader = res.headers['content-type']
  return {
    bytes,
    contentType:
      typeof contentTypeHeader === 'string' ? contentTypeHeader : undefined,
  }
}

/**
 * Decode bytes as UTF-8 in fatal mode to detect binary content. Returns
 * undefined when the bytes are not valid UTF-8 or contain a NUL byte (a typical
 * binary marker).
 */
export function tryDecodeText(bytes: Uint8Array): string | undefined {
  // NUL bytes inside the first 4 KB strongly suggest binary; cheap pre-check.
  const probeEnd = Math.min(bytes.length, 4096)
  for (let i = 0; i < probeEnd; i += 1) {
    if (bytes[i] === 0) {
      return undefined
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}

/**
 * Throw if `bytes` does not content-address to `hash`. `S`-prefixed (file-
 * stream) hashes share the digest body with their `Q` form, so both verify
 * against the same sha256; any other prefix is treated as a `Q`-style hash.
 */
export function verifyBlobHash(hash: string, bytes: Uint8Array): void {
  const expectedDigest = hash.slice(1)
  const actualDigest = crypto.hash('sha256', bytes, 'base64url')
  if (actualDigest !== expectedDigest) {
    throw new Error(
      `blob integrity check failed for ${hash}: content hashes to ` +
        `${BLOB_HASH_PREFIX}${actualDigest}`,
    )
  }
}
