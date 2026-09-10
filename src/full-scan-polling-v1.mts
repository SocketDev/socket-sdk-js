/**
 * @file Bounded and cancellable polling for advanced v1 full-scan results.
 */
import { setTimeout as waitForPoll } from 'node:timers/promises'

import { DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT } from './constants.mts'
import { getOrgFullScanV1 } from './full-scan-results-v1.mts'
import {
  createPollDeadline,
  releasePollAfterRecords,
} from './utils/poll-deadline.mts'

import type { PollDeadlineScheduler } from './utils/poll-deadline.mts'

import type { SdkApiContext } from './api-client.mts'
import type {
  FullScanV1TerminalResult,
  PollFullScanV1Options,
} from './types/full-scan-results-v1.mts'

export type FullScanV1PollRuntime = {
  scheduleDeadline?: PollDeadlineScheduler | undefined
  now: () => number
  sleep: (
    milliseconds: number,
    signal?: AbortSignal | undefined,
  ) => Promise<void>
}

export type PollFullScanV1RequestOptions = PollFullScanV1Options & {
  baseUrl?: string | undefined
  runtime?: FullScanV1PollRuntime | undefined
}

export const defaultFullScanPollRuntime: FullScanV1PollRuntime = {
  now: Date.now,
  async sleep(milliseconds, signal) {
    await waitForPoll(milliseconds, undefined, { signal })
  },
}

export async function pollOrgFullScanV1(
  context: SdkApiContext,
  orgSlug: string,
  fullScanId: string,
  options: PollFullScanV1RequestOptions = {},
): Promise<FullScanV1TerminalResult> {
  const {
    baseUrl,
    runtime = defaultFullScanPollRuntime,
    maxPollMs = DEFAULT_POLL_TIMEOUT,
    pollIntervalMs = DEFAULT_POLL_INTERVAL,
    signal = context.requestOptions.signal,
  } = options
  validateFullScanPollOptions(maxPollMs, pollIntervalMs)
  const requestDeadline = createPollDeadline(
    maxPollMs,
    signal,
    runtime.scheduleDeadline,
  )
  let releaseAfterRecords = false
  const requestContext: SdkApiContext = {
    ...context,
    requestOptions: {
      ...context.requestOptions,
      signal: requestDeadline.signal,
    },
  }
  const deadline = runtime.now() + maxPollMs
  try {
    if (maxPollMs === 0) {
      throw new Error(
        'Full scan polling deadline is zero. Supply a positive timeout.',
      )
    }
    for (;;) {
      requestDeadline.signal.throwIfAborted()
      const result = await getOrgFullScanV1(
        requestContext,
        orgSlug,
        fullScanId,
        baseUrl,
      )
      if (!result.success) {
        return result
      }
      if (result.data.status === 'failed') {
        return { ...result, data: result.data }
      }
      if (result.data.status === 'complete') {
        releaseAfterRecords = true
        return {
          ...result,
          data: {
            ...result.data,
            records: releasePollAfterRecords(result.data.records, () =>
              requestDeadline.release(),
            ),
          },
        }
      }
      if (runtime.now() + pollIntervalMs > deadline) {
        throw new Error(
          'Full scan is still processing after the polling timeout. Poll this scan again later.',
        )
      }
      await runtime.sleep(pollIntervalMs, requestDeadline.signal)
    }
  } catch (error) {
    return context.handleApiError(error)
  } finally {
    requestDeadline.cancelTimer()
    if (!releaseAfterRecords) {
      requestDeadline.release()
    }
  }
}

export function validateFullScanPollOptions(
  maxPollMs: number,
  pollIntervalMs: number,
): void {
  if (
    !Number.isSafeInteger(maxPollMs) ||
    maxPollMs < 0 ||
    maxPollMs > 2_147_483_647 ||
    !Number.isFinite(pollIntervalMs) ||
    pollIntervalMs <= 0
  ) {
    throw new RangeError(
      'Invalid full-scan polling options: expected a nonnegative timeout and positive interval. Supply finite milliseconds.',
    )
  }
}
