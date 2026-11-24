/**
 * @file Build CLI argument parsing regression tests.
 */

import process from 'node:process'
import path from 'node:path'

import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { describe, expect, it } from 'vitest'

import { selectBuildMode } from '../../scripts/build/run.mts'
import { REPO_ROOT } from '../../scripts/paths/repo.mts'
import { BUILD_RUNNER_PATH } from '../../scripts/paths/runners.mts'

const scriptPath = path.join(REPO_ROOT, BUILD_RUNNER_PATH)

describe('build CLI', () => {
  it.each([['--help'], ['--unknown-option', '--help']])(
    'prints help for %j without invoking build-only dependencies',
    async (...args) => {
      const { code, stdout } = await spawn(
        process.execPath,
        [scriptPath, ...args],
        {
          stdio: 'pipe',
          stdioString: true,
        },
      )
      expect(code).toBe(0)
      expect(stdout).toContain('Usage: pnpm build [options]')
    },
  )
})

describe('build mode selection', () => {
  it.each([
    [{ src: false, types: false, watch: false }, 'full'],
    [{ src: true, types: true, watch: false }, 'full'],
    [{ src: true, types: false, watch: false }, 'source'],
    [{ src: false, types: true, watch: false }, 'types'],
    [{ src: false, types: false, watch: true }, 'watch'],
    [{ src: true, types: true, watch: true }, 'watch'],
  ] as const)('selects %j as %s', (options, expected) => {
    expect(selectBuildMode(options)).toBe(expected)
  })
})
