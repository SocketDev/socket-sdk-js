import { createReadStream } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { isErrnoException } from '@socketsecurity/lib/errors/predicates'
import { httpRequest } from '@socketsecurity/lib/http-request/request'
import { normalizePath } from '@socketsecurity/lib/paths/normalize'

import { MAX_RESPONSE_SIZE } from './constants.mts'

import { sanitizeHeaders } from './utils/header-sanitization.mts'

import type { RequestOptions, RequestOptionsWithHooks } from './types.mts'
import type FormData from 'form-data'
import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'
import type { ReadStream } from 'node:fs'
import type { Readable } from 'node:stream'

export function createRequestBodyForBlobs(
  entries: Array<{ absPath: string; hash: string; name: string }>,
): FormData {
  const FormDataCtor = getFormData()
  const form = new FormDataCtor()
  for (let i = 0, { length } = entries; i < length; i += 1) {
    const entry = entries[i]!
    const stream = openFileReadStreamOrThrow(entry.absPath)
    form.append(`sha256:${entry.hash}`, stream, {
      contentType: 'application/octet-stream',
      filename: entry.name,
    })
  }
  return form
}

export function createRequestBodyForFilepaths(
  filepaths: string[],
  basePath: string,
): FormData {
  const FormDataCtor = getFormData()
  const form = new FormDataCtor()
  for (let i = 0, { length } = filepaths; i < length; i += 1) {
    const absPath = filepaths[i]!
    const relPath = normalizePath(path.relative(basePath, absPath))
    const filename = path.basename(absPath)
    const stream = openFileReadStreamOrThrow(absPath)
    form.append(relPath, stream, {
      contentType: 'application/octet-stream',
      filename,
    })
  }
  return form
}

export async function createUploadRequest(
  baseUrl: string,
  urlPath: string,
  form: FormData,
  options?: RequestOptionsWithHooks | undefined,
): Promise<HttpResponse> {
  const { hooks, ...rawOpts } = {
    __proto__: null,
    ...options,
  } as unknown as RequestOptionsWithHooks
  const opts = { __proto__: null, ...rawOpts } as unknown as RequestOptions
  const url = new URL(urlPath, baseUrl).toString()
  const method = 'POST'
  const startTime = Date.now()

  const headers = {
    ...(opts.headers as Record<string, string>),
  }

  if (hooks?.onRequest) {
    hooks.onRequest({
      method,
      url,
      headers: sanitizeHeaders(headers),
      timeout: opts.timeout,
    })
  }

  try {
    const response = await httpRequest(url, {
      method,
      body: form as unknown as Readable,
      headers,
      maxResponseSize: MAX_RESPONSE_SIZE,
      timeout: opts.timeout,
    })

    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: Date.now() - startTime,
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeHeaders(response.headers),
      })
    }

    return response
  } catch (e) {
    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: Date.now() - startTime,
        error: e as Error,
      })
    }
    throw e
  }
}

/**
 * Open a read stream for `absPath`, translating a synchronous open failure
 * into an actionable error message. Shared by both multipart body builders so
 * the error-message shape (and the coverage-ignore justification) lives in
 * one place.
 */
const requireHere = createRequire(import.meta.url)

// Lazy, memoized form-data. Loading it eagerly binds node:http's native
// HTTPParser at MODULE EVAL (form-data requires node:http/https at its own
// module scope), which makes every SDK importer hostile to V8 startup
// snapshots (`--build-snapshot` aborts on the unserializable [Foreign]
// handles). Only the two multipart builders below construct it, so the
// require defers to first upload.
let formDataCtor: typeof FormData | undefined
export function getFormData(): typeof FormData {
  if (formDataCtor === undefined) {
    formDataCtor = requireHere('form-data') as typeof FormData
  }
  return formDataCtor
}

export function openFileReadStreamOrThrow(absPath: string): ReadStream {
  try {
    return createReadStream(absPath, { highWaterMark: 1024 * 1024 })
  } catch (e) {
    /* c8 ignore start - createReadStream throws synchronously only for type validation errors; file system errors (ENOENT, EISDIR) are emitted asynchronously */
    let message = `Failed to read file: ${absPath}`
    if (isErrnoException(e)) {
      if (e.code === 'ENOENT') {
        message += '\n→ File does not exist. Check the file path and try again.'
      } else if (e.code === 'EACCES') {
        message += `\n→ Permission denied. Run: chmod +r "${absPath}"`
      } else if (e.code === 'EISDIR') {
        message += '\n→ Expected a file but found a directory.'
      } else if (e.code) {
        message += `\n→ Error code: ${e.code}`
      }
    }
    throw new Error(message, { cause: e })
    /* c8 ignore stop */
  }
}
