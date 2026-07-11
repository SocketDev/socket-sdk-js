/**
 * @file Polling helper for Socket API scan endpoints that support the
 *   `cached=true` flag. A cache hit returns 200 with the result; a cache miss
 *   returns 202 Accepted and enqueues a background job, so the client must poll
 *   until a 200 arrives. This helper drives that loop behind the scenes so
 *   callers only ever observe the final 200 result (or a bounded timeout).
 */
import { debugLog } from '@socketsecurity/lib/debug/output'
import { parseJson } from '@socketsecurity/lib/json/parse'
import { isObject } from '@socketsecurity/lib/objects/predicates'
import { DateNow } from '@socketsecurity/lib/primordials/date'
import { ErrorCtor } from '@socketsecurity/lib/primordials/error'
import { sleep as defaultSleep } from '@socketsecurity/lib/promises/timers'

import { DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT } from '../constants.mts'
import { getResponseJson } from '../http-client.mts'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'
import type { JsonValue } from '@socketsecurity/lib/json/types'

// HTTP 202 Accepted: the cached scan is still being computed; poll again.
export const HTTP_STATUS_ACCEPTED = 202

// Body the API returns alongside a 202: { status: 'processing', id: '<scanId>' }.
export type ProcessingBody = {
  id?: string | undefined
  status?: string | undefined
}

export type PollCachedScanOptions = {
  // Performs a single GET request and resolves with its raw response. The
  // helper calls this once per poll attempt so retry/timeout/hooks plumbing
  // stays in the request function the caller provides.
  requestFn: () => Promise<HttpResponse>
  // Human-readable label for the resource being polled (e.g. a diff scan id),
  // used only in the timeout error message.
  label?: string | undefined
  // Maximum wall-clock time to keep polling before throwing. Defaults to
  // DEFAULT_POLL_TIMEOUT.
  maxPollMs?: number | undefined
  // Delay between polls when a 202 is received. Defaults to
  // DEFAULT_POLL_INTERVAL.
  pollIntervalMs?: number | undefined
  // Injectable clock and sleep for deterministic tests. Default to the real
  // clock and the lib sleep helper (which fake timers advance correctly).
  now?: (() => number) | undefined
  sleep?: ((ms: number) => Promise<void>) | undefined
}

/**
 * Drive the 200/202 cached-scan polling loop. Resolves with the parsed JSON of
 * the first 200 response. Each 202 is read for its `{ status, id }` payload,
 * logged via debugLog, and the server-reported id (falling back to label) is
 * used in the timeout message. A non-2xx response throws via getResponseJson
 * (so the caller's existing error handling fires). Repeated 202s past maxPollMs
 * throw a bounded timeout error naming the scan and poll count.
 */
export async function pollCachedScan(
  options: PollCachedScanOptions,
): Promise<JsonValue | undefined> {
  const {
    label,
    maxPollMs = DEFAULT_POLL_TIMEOUT,
    now = DateNow,
    pollIntervalMs = DEFAULT_POLL_INTERVAL,
    requestFn,
    sleep = defaultSleep,
  } = {
    __proto__: null,
    ...options,
  } as PollCachedScanOptions

  const deadline = now() + maxPollMs
  let attempt = 0
  let response = await requestFn()
  while (response.status === HTTP_STATUS_ACCEPTED) {
    attempt += 1
    // Surface what the server reported: { status: 'processing', id } so the
    // server's own scan id wins over the caller-supplied label when present.
    const processing = readProcessingBody(response)
    const scanId = processing?.id || label
    const target = scanId ? `scan ${scanId}` : 'scan'
    debugLog(
      `Socket API ${target} ${processing?.status ?? 'processing'} (poll attempt ${attempt})`,
    )
    // Cache miss: the result is still being computed. Stop if the next poll
    // would land past the wall-clock budget, otherwise wait and poll again.
    if (now() + pollIntervalMs > deadline) {
      throw new ErrorCtor(
        `Socket API ${target} still processing after ${Math.round(maxPollMs / 1000)}s (${attempt} polls).\n→ The cached result is not ready yet.\n→ Try: poll again later, or call again with cached:false to live-compute.`,
      )
    }
    await sleep(pollIntervalMs)
    response = await requestFn()
  }
  // 200 → parse and return. Non-2xx → getResponseJson throws ResponseError,
  // which the caller's catch turns into a {success:false} result.
  return await getResponseJson(response)
}

/**
 * Read the `{ status, id }` payload the API sends with a 202 Accepted. Returns
 * undefined when the body is absent or not JSON — the loop still polls on
 * status alone, so a missing body never breaks polling.
 */
export function readProcessingBody(
  response: HttpResponse,
): ProcessingBody | undefined {
  const text = response.text()
  if (!text) {
    return undefined
  }
  try {
    const parsed = parseJson(text)
    if (isObject(parsed)) {
      const { id, status } = parsed as Record<string, unknown>
      return {
        id: typeof id === 'string' ? id : undefined,
        status: typeof status === 'string' ? status : undefined,
      }
    }
  } catch {
    // Non-JSON 202 body: nothing to surface, keep polling on status.
  }
  return undefined
}
