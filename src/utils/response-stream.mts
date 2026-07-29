/**
 * @file Helpers for responses whose body is left unread. A streaming request
 *   resolves on headers and hands back the socket on `rawResponse`, which is
 *   what keeps large scan payloads out of memory — but the error path still
 *   needs the body to report what the API said, so it drains it here under a
 *   size cap.
 */

import { MAX_RESPONSE_SIZE } from '../constants.mts'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'

/**
 * Drain a stream-mode error response so the error path has a body to report.
 * A streaming response resolves with an unread body, so `text()` is empty until
 * the stream is consumed — error handling reads that body for the API's message
 * and hint. Reads at most `MAX_RESPONSE_SIZE` bytes and releases the socket.
 *
 * @param response - The streaming response for a non-2xx status.
 *
 * @returns A response whose body accessors return the drained bytes.
 */
export async function bufferStreamedErrorResponse(
  response: HttpResponse,
): Promise<HttpResponse> {
  const raw = response.rawResponse
  if (!raw) {
    return response
  }
  const chunks: Buffer[] = []
  let totalBytes = 0
  try {
    for await (const chunk of raw) {
      const buffer = chunk as Buffer
      totalBytes += buffer.length
      if (totalBytes > MAX_RESPONSE_SIZE) {
        raw.destroy()
        break
      }
      chunks.push(buffer)
    }
    /* c8 ignore start - a socket error mid-drain keeps the partial body, which is better error context than none */
  } catch {
    raw.destroy()
  }
  /* c8 ignore stop */
  const body = Buffer.concat(chunks)
  return {
    ...response,
    arrayBuffer() {
      return body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength,
      )
    },
    body,
    json() {
      return JSON.parse(body.toString('utf8'))
    },
    text() {
      return body.toString('utf8')
    },
  }
}
