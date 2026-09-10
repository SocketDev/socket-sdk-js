/**
 * @file Cancellable polling deadlines that release timers and parent listeners.
 */
import { createCloseableGenerator } from './closeable-generator.mts'

export type PollDeadlineScheduler = (
  milliseconds: number,
  expire: () => void,
) => () => void

export interface PollDeadline {
  signal: AbortSignal
  cancelTimer(): void
  release(): void
}

export function createPollDeadline(
  milliseconds: number,
  parent?: AbortSignal | undefined,
  schedule = schedulePollDeadline,
): PollDeadline {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(parent?.reason)
  const expire = () =>
    controller.abort(
      new Error(
        'Full scan polling exceeded its deadline. Poll this scan again later.',
      ),
    )
  if (parent?.aborted) {
    forwardAbort()
  } else {
    parent?.addEventListener('abort', forwardAbort, { once: true })
  }
  const cancelTimer = schedule(milliseconds, expire)
  return {
    signal: controller.signal,
    cancelTimer,
    release() {
      cancelTimer()
      parent?.removeEventListener('abort', forwardAbort)
    },
  }
}

export function releasePollAfterRecords<T>(
  records: AsyncGenerator<T>,
  release: () => void,
): AsyncGenerator<T> {
  return createCloseableGenerator(records, release)
}

export function schedulePollDeadline(
  milliseconds: number,
  expire: () => void,
): () => void {
  const timer = setTimeout(expire, milliseconds)
  timer.unref()
  return () => clearTimeout(timer)
}
