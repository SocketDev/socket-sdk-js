import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import FormData from 'form-data'

import { normalizePath } from '@socketsecurity/lib/paths/normalize'

import { readIncomingResponse } from '@socketsecurity/lib/http-request'

import { getHttpModule, getResponse } from './http-client'
import { sanitizeHeaders } from './utils/header-sanitization'

import type { RequestOptions, RequestOptionsWithHooks } from './types'
import type { HttpResponse } from '@socketsecurity/lib/http-request'
import type { ReadStream } from 'node:fs'
import type { RequestOptions as HttpsRequestOptions } from 'node:https'

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
    } catch (error) {
      const err = error as NodeJS.ErrnoException
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
      throw new Error(message, { cause: error })
    }
    form.append(relPath, stream, {
      contentType: 'application/octet-stream',
      filename,
    })
  }
  return form
}

export function createRequestBodyForJson(
  jsonData: unknown,
  basename = 'data.json',
): FormData {
  const ext = path.extname(basename)
  const name = path.basename(basename, ext)
  const jsonStream = Readable.from(JSON.stringify(jsonData), {
    highWaterMark: 1024 * 1024,
  })
  const form = new FormData()
  form.append(name, jsonStream, {
    contentType: 'application/json',
    filename: basename,
  })
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

  return await new Promise((pass, fail) => {
    const url = new URL(urlPath, baseUrl)
    const method = 'POST'

    const formHeaders = form.getHeaders()
    const headers = {
      ...(opts as HttpsRequestOptions)?.headers,
      ...formHeaders,
    }
    const startTime = Date.now()

    const req = getHttpModule(baseUrl).request(url, {
      method,
      ...opts,
      headers,
    })

    hooks?.onRequest?.({
      method,
      url: url.toString(),
      headers: sanitizeHeaders(headers),
      timeout: opts.timeout,
    })

    req.flushHeaders()

    void getResponse(req).then(
      async msg => {
        hooks?.onResponse?.({
          method,
          url: url.toString(),
          duration: Date.now() - startTime,
          status: msg.statusCode,
          statusText: msg.statusMessage,
          headers: sanitizeHeaders(msg.headers),
        })
        try {
          pass(await readIncomingResponse(msg))
        } catch (err) {
          /* c8 ignore next - readIncomingResponse stream read error */
          fail(err)
        }
      },
      error => {
        hooks?.onResponse?.({
          method,
          url: url.toString(),
          duration: Date.now() - startTime,
          error: error as Error,
        })
        fail(error)
      },
    )

    form.pipe(req)

    /* c8 ignore next 1 - form-data error events require stream failures that are difficult to test reliably */
    form.on('error', fail)
  })
}
