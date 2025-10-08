/**
 * @fileoverview Vitest configuration for Socket SDK test suite.
 * Configures test environment, coverage, and module resolution.
 */
import { defineConfig } from 'vitest/config'

// Check if coverage is enabled via CLI flags or environment.
const isCoverageEnabled =
  process.env['COVERAGE'] === 'true' ||
  process.env['npm_lifecycle_event']?.includes('coverage') ||
  process.argv.some(arg => arg.includes('coverage'))

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.{js,ts,mjs,mts,cjs}'],
    reporters: ['default'],
    setupFiles: ['./test/utils/setup.mts'],
    // Improve memory usage by running tests sequentially in CI.
    pool: 'forks',
    poolOptions: {
      forks: {
        // Use single fork for coverage to reduce memory, parallel otherwise.
        singleFork: isCoverageEnabled,
        ...(isCoverageEnabled && { maxForks: 1 }),
        // Isolate tests to prevent memory leaks between test files.
        isolate: true,
      },
      threads: {
        // Use single thread for coverage to reduce memory, parallel otherwise.
        singleThread: isCoverageEnabled,
        ...(isCoverageEnabled && { maxThreads: 1 }),
      },
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
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
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 99,
        statements: 100,
      },
    },
  },
})
