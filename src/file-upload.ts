import { createReadStream } from 'node:fs'
import path from 'node:path'

import FormData from 'form-data'

import { httpRequest } from '@socketsecurity/lib/http-request'
import { normalizePath } from '@socketsecurity/lib/paths/normalize'

import { MAX_RESPONSE_SIZE } from './constants'

import { sanitizeHeaders } from './utils/header-sanitization'

import type { RequestOptions, RequestOptionsWithHooks } from './types'
import type { HttpResponse } from '@socketsecurity/lib/http-request'
import type { ReadStream } from 'node:fs'
import type { Readable } from 'node:stream'

export function createRequestBodyForFilepaths(
  filepaths: string[],
  basePath: string,
): FormData {
  const form = new FormData()
  for (const absPath of filepaths) {
    const relPath = normalizePath(path.relative(basePath, absPath))
    const filename = path.basename(absPath)
    let stream: ReadStream
    try {
      stream = createReadStream(absPath, { highWaterMark: 1024 * 1024 })
      /* c8 ignore next 13 - createReadStream throws synchronously only for type validation errors; file system errors (ENOENT, EISDIR) are emitted asynchronously */
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      let message = `Failed to read file: ${absPath}`
      if (err.code === 'ENOENT') {
        message += '\n→ File does not exist. Check the file path and try again.'
      } else if (err.code === 'EACCES') {
        message += `\n→ Permission denied. Run: chmod +r "${absPath}"`
      } else if (err.code === 'EISDIR') {
        message += '\n→ Expected a file but found a directory.'
      } else if (err.code) {
        message += `\n→ Error code: ${err.code}`
      }
      throw new Error(message, { cause: e })
    }
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
  } as any as RequestOptionsWithHooks
  const opts = { __proto__: null, ...rawOpts } as any as RequestOptions
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
