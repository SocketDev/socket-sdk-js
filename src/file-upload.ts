/** @fileoverview File upload utilities for Socket API with multipart form data support. */
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import FormData from 'form-data'

import { normalizePath } from '@socketsecurity/lib/paths/normalize'

import { getHttpModule, getResponse } from './http-client'
import { sanitizeHeaders } from './utils/header-sanitization'

import type { RequestOptions, RequestOptionsWithHooks } from './types'
import type { ReadStream } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import type { RequestOptions as HttpsRequestOptions } from 'node:https'

/**
 * Create multipart form-data body parts for file uploads.
 * Converts file paths to readable streams with proper multipart headers.
 *
 * @throws {Error} When file cannot be read (ENOENT, EACCES, EISDIR, etc.)
 */
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
      /* c8 ignore next 14 - File system errors during stream creation require specific file states */
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

/**
 * Create multipart form-data body part for JSON data.
 * Converts JSON object to readable stream with appropriate headers.
 */
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

/**
 * Create and execute a multipart/form-data upload request using form-data library.
 * Streams large files efficiently with automatic backpressure handling and early server validation.
 *
 * @throws {Error} When network errors occur or stream processing fails
 */
export async function createUploadRequest(
  baseUrl: string,
  urlPath: string,
  form: FormData,
  options?: RequestOptionsWithHooks | undefined,
): Promise<IncomingMessage> {
  // This function constructs and sends a multipart/form-data HTTP POST request
  // using the battle-tested form-data library. It automatically handles:
  // - Proper multipart boundaries and Content-Type headers
  // - Stream backpressure to avoid memory exhaustion
  // - Correct Content-Disposition headers with UTF-8 support

  // We call `flushHeaders()` early to ensure headers are sent before body transmission
  // begins. If the server rejects the request (e.g., bad org or auth), it will likely
  // respond immediately. We listen for that response while still streaming the body.
  //
  // This protects against cases where the server closes the connection (EPIPE/ECONNRESET)
  // mid-stream, which would otherwise cause hard-to-diagnose failures during file upload.
  //
  // Example failure this mitigates: `socket scan create --org badorg`

  const { hooks, ...rawOpts } = {
    __proto__: null,
    ...options,
  } as any as RequestOptionsWithHooks
  const opts = { __proto__: null, ...rawOpts } as any as RequestOptions

  return await new Promise((pass, fail) => {
    const url = new URL(urlPath, baseUrl)
    const method = 'POST'

    // Get headers from form-data with proper boundary
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

    // Send headers early to prompt server validation (auth, URL, quota, etc.).
    req.flushHeaders()

    // Concurrently wait for response while we stream body.
    getResponse(req).then(
      response => {
        hooks?.onResponse?.({
          method,
          url: url.toString(),
          duration: Date.now() - startTime,
          status: response.statusCode,
          statusText: response.statusMessage,
          headers: sanitizeHeaders(response.headers),
        })
        pass(response)
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

    // Pipe form data to request - form-data handles all backpressure automatically
    form.pipe(req)

    // Handle errors
    /* c8 ignore next 2 - form-data error events require stream failures that are difficult to test reliably */
    form.on('error', fail)
    req.on('error', fail)
  })
}
