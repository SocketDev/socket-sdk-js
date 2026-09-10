/**
 * @file Retry policy shared by Socket API clients.
 */
import { pRetry } from '@socketsecurity/lib/promises/retry'

import { DEFAULT_RETRIES, DEFAULT_RETRY_DELAY } from './constants.mts'
import { ResponseError } from './http-client.mts'

export async function executeSdkWithRetry<T>(
  operation: () => Promise<T>,
  options: SdkRetryOptions = {},
): Promise<T> {
  const { signal } = options
  signal?.throwIfAborted()
  const result = await pRetry(operation, {
    baseDelayMs: options.retryDelay ?? DEFAULT_RETRY_DELAY,
    onRetry(...args) {
      signal?.throwIfAborted()
      return getSdkRetryDelay(args[1])
    },
    onRetryRethrow: true,
    retries: options.retries ?? DEFAULT_RETRIES,
    signal,
  })
  signal?.throwIfAborted()
  if (result === undefined) {
    throw new Error('Request aborted')
  }
  return result
}

export function getSdkRetryDelay(error: unknown): number | undefined {
  if (!(error instanceof ResponseError)) {
    return undefined
  }
  const { status, headers } = error.response
  if (status === 429) {
    return parseSdkRetryAfter(headers['retry-after'])
  }
  if (status >= 400 && status < 500) {
    throw error
  }
  return undefined
}

export interface SdkRetryOptions {
  retries?: number | undefined
  retryDelay?: number | undefined
  signal?: AbortSignal | undefined
}

export function parseSdkRetryAfter(
  header: string | string[] | undefined,
): number | undefined {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) {
    return undefined
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }
  const delay = Date.parse(value) - Date.now()
  return delay > 0 ? delay : undefined
}
