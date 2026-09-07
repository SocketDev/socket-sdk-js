/**
 * @file Build CLI argument parsing regression tests.
 */

import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { describe, expect, it } from 'vitest'

const scriptPath = fileURLToPath(
  new URL('../../../scripts/repo/build.mts', import.meta.url),
)

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
