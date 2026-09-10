/**
 * @file Contract generation accepts JSON results alongside its strict CLI
 *   options.
 */

import process from 'node:process'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { runMain } from '../../../../../scripts/fleet/process/run-main.mts'

const boundary = vi.hoisted(() => ({ runMain: vi.fn<typeof runMain>() }))
vi.mock(
  import('../../../../../scripts/fleet/process/is-main-module.mts'),
  () => ({
    isMainModule: () => true,
  }),
)
vi.mock(import('../../../../../scripts/fleet/process/run-main.mts'), () => ({
  runMain: boundary.runMain,
}))

const argv = process.argv

afterEach(() => {
  process.argv = argv
  vi.restoreAllMocks()
})

describe('contract generator JSON entry', () => {
  it('lists artifacts successfully with JSON result support enabled', async () => {
    process.argv = [...argv.slice(0, 2), '--json', '--list-artifacts']
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    await import('../../../../../scripts/repo/generate-sdk.mts')
    const [main, meta] = boundary.runMain.mock.calls[0]!

    expect(await main()).toBe(0)
    expect(meta?.json).toBe('result')
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining('openapi-v1.json'),
    )
  })
})
