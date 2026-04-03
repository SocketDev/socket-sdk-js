/**
 * @fileoverview Shared coverage configuration for all vitest configs.
 * Ensures consistent coverage thresholds and exclusions across test modes.
 */

import type { CoverageOptions } from 'vitest'

/**
 * Base coverage configuration shared by all vitest config variants.
 * Use this for consistent coverage settings across regular and isolated test runs.
 */
export const baseCoverageConfig: CoverageOptions = {
  provider: 'v8',
  reporter: ['text', 'json', 'json-summary', 'html', 'lcov', 'clover'],
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
    'src/types.ts',
    'src/index.ts',
    'perf/**',
    // Explicit root-level exclusions
    '/scripts/**',
    '/test/**',
  ],
  include: ['src/**/*.{ts,mts,cts}'],
  all: true,
  clean: true,
  skipFull: false,
  ignoreClassMethods: ['constructor'],
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

/**
 * Relaxed coverage thresholds for isolated tests (lower bar for specialized tests).
 */
export const isolatedCoverageThresholds = {
  branches: 49,
  functions: 35,
  lines: 35,
  statements: 35,
}
