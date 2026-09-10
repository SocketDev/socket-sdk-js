/**
 * @file Clean CLI argument parsing regression tests.
 */

import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { describe, expect, it } from 'vitest'

import { selectCleanTasks } from '../../../scripts/repo/clean.mts'

const scriptPath = fileURLToPath(
  new URL('../../../scripts/repo/clean.mts', import.meta.url),
)

describe('clean CLI', () => {
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
      expect(stdout).toContain('Usage: pnpm clean [options]')
    },
  )
})

describe('clean task selection', () => {
  it('keeps dependencies when cleaning the default build artifacts', () => {
    expect(selectCleanTasks({}).map(task => task.name)).toEqual([
      'cache',
      'coverage',
      'dist',
    ])
    expect(selectCleanTasks({ all: true }).map(task => task.name)).toEqual([
      'cache',
      'coverage',
      'dist',
    ])
  })

  it('requires explicit modules selection even with all enabled', () => {
    expect(selectCleanTasks({ modules: true })).toEqual([
      { name: 'node_modules', pattern: '**/node_modules' },
    ])
    expect(selectCleanTasks({ all: true, modules: true }).at(-1)).toEqual({
      name: 'node_modules',
      pattern: '**/node_modules',
    })
  })

  it('combines narrow targets and lets dist subsume declarations', () => {
    expect(selectCleanTasks({ cache: true, types: true })).toEqual([
      { name: 'cache', pattern: '**/.cache' },
      {
        name: 'declarations',
        patterns: ['dist/**/*.d.mts', 'dist/**/*.d.mts.map'],
      },
    ])
    expect(selectCleanTasks({ dist: true, types: true })).toEqual([
      { name: 'dist', patterns: ['dist', '*.tsbuildinfo', '.tsbuildinfo'] },
    ])
  })
})
