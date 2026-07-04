/**
 * @file Shared coverage configuration for all vitest configs. Ensures
 *   consistent coverage thresholds and exclusions across test modes.
 */

import type { CoverageOptions } from 'vitest'

/**
 * Base coverage configuration shared by all vitest config variants. Use this
 * for consistent coverage settings across regular and isolated test runs.
 */
export const baseCoverageConfig: CoverageOptions = {
  all: true,
  clean: true,
  exclude: [
    '**/*.config.*',
    '**/node_modules/**',
    '**/[.]**',
    '**/*.d.ts',
    '**/virtual:*',
    'coverage/**',
    'dist/**',
    'scripts/**',
    'types/**',
    'test/**',
    '**/*.mjs',
    '**/*.cjs',
    'src/types.mts',
    'src/index.mts',
    'perf/**',
    // Explicit root-level exclusions
    '/scripts/**',
    '/test/**',
  ],
  ignoreClassMethods: ['constructor'],
  include: ['src/**/*.{ts,mts,cts}'],
  provider: 'v8',
  reporter: ['text', 'json', 'json-summary', 'html', 'lcov', 'clover'],
  skipFull: false,
}

/**
 * Standard coverage thresholds for main test suite.
 */
export const mainCoverageThresholds = {
  branches: 82,
  functions: 98,
  lines: 93,
  statements: 93,
}

// The isolated tier carries no coverage thresholds of its own: its 12-test
// roster covers a narrow slice of src/ while the coverage denominator is all
// of src/, so any tier-level global threshold fails whenever unrelated code
// grows. The enforced gate is the merged main+isolated aggregate in
// `.config/repo/cover.json`, checked by `scripts/fleet/cover.mts`.
