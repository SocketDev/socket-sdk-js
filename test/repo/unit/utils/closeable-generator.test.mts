/**
 * @file Closeable generators release once after normal exhaustion.
 */

import { describe, expect, it } from 'vitest'

import { createCloseableGenerator } from '../../../../src/utils/closeable-generator.mts'

describe('closeable generator completion', () => {
  it('releases once after normal exhaustion', async () => {
    let released = 0
    async function* records() {
      yield 'example-record'
    }
    const iterator = createCloseableGenerator(records(), () => {
      released += 1
    })
    expect(await iterator.next()).toMatchObject({
      value: 'example-record',
      done: false,
    })
    expect(released).toBe(0)
    expect(await iterator.next()).toMatchObject({ done: true })
    await iterator.return(undefined)
    expect(released).toBe(1)
  })
})
