/**
 * @file Bounded generator merging with one completion handler per pending step.
 */

import { promiseWithResolvers } from '../utils.mts'

export function assertPositivePurlLimit(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(
      `Invalid ${name} in PURL streaming: received ${value}; provide a positive integer`,
    )
  }
}

export type GeneratorCompletion<Value> = {
  generator: AsyncGenerator<Value>
  result: IteratorResult<Value>
}

export function createGeneratorCompletionQueue<Value>() {
  const completed: Array<GeneratorCompletion<Value>> = []
  let waiter:
    | ReturnType<typeof promiseWithResolvers<GeneratorCompletion<Value>>>
    | undefined
  let failure: { error: unknown } | undefined
  return {
    add(generator: AsyncGenerator<Value>): void {
      void generator.next().then(
        result => {
          const step = { generator, result }
          if (waiter) {
            const current = waiter
            waiter = undefined
            current.resolve(step)
          } else {
            completed.push(step)
          }
        },
        error => {
          if (waiter) {
            const current = waiter
            waiter = undefined
            current.reject(error)
          } else {
            failure ??= { error }
          }
        },
      )
    },
    take(): Promise<GeneratorCompletion<Value>> {
      if (failure) {
        return Promise.reject(failure.error)
      }
      const step = completed.shift()
      if (step) {
        return Promise.resolve(step)
      }
      waiter = promiseWithResolvers<GeneratorCompletion<Value>>()
      return waiter.promise
    },
  }
}

export async function* mergeAsyncGenerators<Value>(
  factories: Iterable<() => AsyncGenerator<Value>>,
  concurrencyLimit: number,
  cancel: () => void,
): AsyncGenerator<Value> {
  assertPositivePurlLimit(concurrencyLimit, 'concurrencyLimit')
  const remaining = factories[Symbol.iterator]()
  const running = new Set<AsyncGenerator<Value>>()
  const queue = createGeneratorCompletionQueue<Value>()
  function enqueue(): boolean {
    const next = remaining.next()
    if (next.done) {
      return false
    }
    const generator = next.value()
    running.add(generator)
    queue.add(generator)
    return true
  }
  try {
    while (running.size < concurrencyLimit) {
      if (!enqueue()) {
        break
      }
    }
    while (running.size) {
      const { generator, result } = await queue.take()
      if (result.done) {
        running.delete(generator)
        enqueue()
      } else {
        yield result.value
        queue.add(generator)
      }
    }
  } finally {
    cancel()
    remaining.return?.()
    await Promise.allSettled(
      [...running].map(generator => generator.return(undefined)),
    )
  }
}
