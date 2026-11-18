/**
 * @file Vitest configuration for the SDK unit and integration suites.
 */

import process from 'node:process'

import { defineConfig } from 'vitest/config'

import {
  baseCoverageConfig,
  mainCoverageThresholds,
} from '../vitest.coverage.config.mts'

process.env['TZ'] ??= 'UTC'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['test/**/*.fuzz.mts'],
    include: ['test/**/*.test.mts'],
    isolate: true,
    maxWorkers: 4,
    setupFiles: ['test/utils/setup.mts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: { ...baseCoverageConfig, thresholds: mainCoverageThresholds },
  },
})
