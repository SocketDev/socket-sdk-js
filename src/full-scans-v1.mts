/**
 * @file Content-addressed full-scan and blob-upload primitives for the v1
 *   API. These endpoints are internal/preview — hidden from the public
 *   OpenAPI spec — so the types here are hand-written rather than generated
 *   (mirrors src/blob.mts, the other hand-written non-OpenAPI module).
 */
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import path from 'node:path'

import { isAbsolute, normalizePath } from '@socketsecurity/lib/paths/normalize'

export type FileHashResult = {
  // oxlint-disable-next-line socket/no-bare-crypto-named-usage -- TS type-literal property key, not a value-level reference to node:crypto's `hash` export.
  hash: string
  size: number
}

export type FullScanManifestEntry = {
  // oxlint-disable-next-line socket/no-bare-crypto-named-usage -- TS type-literal property key; also the literal wire-contract JSON field name.
  hash: string
  size: number
}

export type FullScanManifest = {
  algo: 'sha256'
  files: Record<string, FullScanManifestEntry>
}

export type BlobRef = {
  // oxlint-disable-next-line socket/no-bare-crypto-named-usage -- TS type-literal property key; also the literal wire-contract JSON field name.
  hash: string
  path: string
  size: number
}

export type CreateFullScanFromManifestParams = {
  branch?: string | undefined
  commit_hash?: string | undefined
  commit_message?: string | undefined
  committers?: string[] | undefined
  ephemeral?: boolean | undefined
  make_default_branch?: boolean | undefined
  pull_request?: number | undefined
  repo: string
  scan_type?: string | undefined
  set_as_pending_head?: boolean | undefined
  workspace?: string | undefined
}

export type FullScanV1CreatedData = {
  branch: string
  commit_hash: string
  commit_message: string
  committers: string[]
  created_at: string
  html_report_url: string
  id: string
  organization_id: string
  pull_request: number
  repository_id: string
  scan_type: string
  unsupported_files: BlobRef[]
  updated_at: string
}

export type FullScanV1PendingData = {
  algo: string
  missing: BlobRef[]
  present: BlobRef[]
  unsupported: BlobRef[]
}

export type CreateFullScanFromManifestResult =
  | {
      cause: undefined
      data: FullScanV1CreatedData
      error: undefined
      status: 201
      success: true
    }
  | {
      cause: undefined
      data: FullScanV1PendingData
      error: undefined
      status: 202
      success: true
    }

export type BlobsUploadData = {
  already_existed: string[]
  stored: string[]
}

export type UploadBlobsResult = {
  cause: undefined
  data: BlobsUploadData
  error: undefined
  status: 200
  success: true
}

export type BlobUploadEntry = {
  // oxlint-disable-next-line socket/no-bare-crypto-named-usage -- TS type-literal property key, not a value-level reference to node:crypto's `hash` export.
  hash?: string | undefined
  localPath: string
  name?: string | undefined
}

export type ManifestLocalEntry = {
  absPath: string
  // oxlint-disable-next-line socket/no-bare-crypto-named-usage -- TS type-literal property key, not a value-level reference to node:crypto's `hash` export.
  hash: string
  relPath: string
  size: number
}

export type SkippedManifestPath = {
  path: string
  reason: string
}

export type AssembledManifest = {
  entries: ManifestLocalEntry[]
  manifest: FullScanManifest
  skipped: SkippedManifestPath[]
}

// The v1 base has no fixed relationship to a custom base URL, so derivation
// only recognizes the SDK's own default version segment.
const V0_BASE_URL_SUFFIX = '/v0/'

/**
 * Build a v1 content-addressed manifest for `filepaths` (absolute paths)
 * relative to `basePath`. A path that cannot be represented in a v1 manifest
 * — outside `basePath`, absolute, or a duplicate of an already-included
 * relative path — is recorded in `skipped` instead of `entries`/`manifest`.
 * Every included file is streamed through `hashFile`, so peak memory stays
 * bounded regardless of file count or size.
 */
export async function assembleManifest(
  basePath: string,
  filepaths: string[],
): Promise<AssembledManifest> {
  const entries: ManifestLocalEntry[] = []
  const files: Record<string, FullScanManifestEntry> = {}
  const seen = new Set<string>()
  const skipped: SkippedManifestPath[] = []

  for (let i = 0, { length } = filepaths; i < length; i += 1) {
    const absPath = filepaths[i]!
    const relPath = normalizePath(path.relative(basePath, absPath))

    if (
      relPath === '' ||
      relPath === '.' ||
      relPath === '..' ||
      relPath.startsWith('../') ||
      isAbsolute(relPath)
    ) {
      skipped.push({
        path: absPath,
        reason: `resolves outside the manifest base "${basePath}" (relative path: "${relPath}")`,
      })
      continue
    }

    if (seen.has(relPath)) {
      skipped.push({
        path: absPath,
        reason: `duplicate manifest path "${relPath}"`,
      })
      continue
    }
    seen.add(relPath)

    const { hash, size } = await hashFile(absPath)
    entries.push({ absPath, hash, relPath, size })
    files[relPath] = { hash, size }
  }

  return {
    entries,
    manifest: { algo: 'sha256', files },
    skipped,
  }
}

/**
 * Derive the v1 API base URL from a v0 base URL by swapping the trailing
 * `/v0/` segment for `/v1/`. Returns undefined when `baseUrl` does not end in
 * `/v0/` — a custom base with a different version segment has no known v1
 * counterpart.
 */
export function deriveApiV1BaseUrl(baseUrl: string): string | undefined {
  return baseUrl.endsWith(V0_BASE_URL_SUFFIX)
    ? `${baseUrl.slice(0, -V0_BASE_URL_SUFFIX.length)}/v1/`
    : undefined
}

/**
 * Stream-hash a file's contents with sha256 (1 MiB read chunks), never
 * buffering the whole file in memory. Returns the lowercase hex digest and
 * the total byte count read.
 */
export async function hashFile(filePath: string): Promise<FileHashResult> {
  const hash = crypto.createHash('sha256')
  let size = 0
  const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 })
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: string | Buffer) => {
      size += Buffer.byteLength(chunk)
      hash.update(chunk)
    })
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })
  return { hash: hash.digest('hex'), size }
}
