/**
 * @file Fuzz entry forwards Vitest flags and returns status through the CLI
 *   runner.
 */

import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { spawnSync } from '@socketsecurity/lib-stable/process/spawn/child'
import type { runMain } from '../../../../../scripts/fleet/process/run-main.mts'

const boundary = vi.hoisted(() => ({
  runMain: vi.fn<typeof runMain>(),
  spawnSync: vi.fn<typeof spawnSync>(),
}))
vi.mock(
  import('../../../../../scripts/fleet/process/is-main-module.mts'),
  () => ({
    isMainModule: () => true,
  }),
)
vi.mock(import('../../../../../scripts/fleet/process/run-main.mts'), () => ({
  runMain: boundary.runMain,
}))
vi.mock(import('@socketsecurity/lib-stable/process/spawn/child'), () => ({
  spawnSync: boundary.spawnSync as typeof spawnSync,
}))

const argv = process.argv

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('Unexpected immediate exit')
  })
})

afterEach(() => {
  process.argv = argv
  vi.restoreAllMocks()
})

describe('fuzz JSON entry', () => {
  it.each([0, 7])(
    'returns child status %i without forwarding the result flag',
    async status => {
      process.argv = [
        ...argv.slice(0, 2),
        '--json',
        'example.fuzz.mts',
        '--reporter=dot',
      ]
      boundary.spawnSync.mockReturnValue({
        status,
        pid: 0,
        signal: null,
        output: [],
        stdout: '',
        stderr: '',
      })
      await import('../../../../../scripts/repo/fuzz.mts')
      const [main, meta] = boundary.runMain.mock.calls[0]!

      expect(await main()).toBe(status)
      expect(meta?.json).toBe('result')
      expect(boundary.spawnSync).toHaveBeenLastCalledWith(
        expect.any(String),
        ['run', 'example.fuzz.mts', '--reporter=dot'],
        expect.objectContaining({ stdio: 'inherit' }),
      )
      expect(process.exit).not.toHaveBeenCalled()
    },
  )
})
