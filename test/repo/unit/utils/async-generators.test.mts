/**
 * @file Merged asynchronous generators close pending readers on failure.
 */

import { describe, expect, it } from 'vitest'

import { promiseWithResolvers } from '../../../../src/utils.mts'
import { mergeAsyncGenerators } from '../../../../src/utils/async-generators.mts'

describe('PURL batch pool', () => {
  it('propagates a generator failure and closes another suspended generator', async () => {
    const failure = new Error('example failure')
    const suspended = promiseWithResolvers<void>()
    let cleaned = false
    async function* waiting(): AsyncGenerator<string> {
      try {
        await suspended.promise
        yield 'example item'
      } finally {
        cleaned = true
      }
    }
    async function* failing(): AsyncGenerator<string> {
      yield await Promise.reject(failure)
    }
    const iterator = mergeAsyncGenerators([waiting, failing], 2, () =>
      suspended.resolve(),
    )
    await expect(iterator.next()).rejects.toBe(failure)
    expect(cleaned).toBe(true)
  })
})
