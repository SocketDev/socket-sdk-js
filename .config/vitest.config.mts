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
    reporters: process.env.TEST_REPORTER === 'json'
      ? ['json', 'default']
      : ['default'],
    setupFiles: ['./test/utils/setup.mts'],
    // Optimize test execution for speed
    // Threads are faster than forks
    pool: 'threads',
    poolOptions: {
      threads: {
        // Maximize parallelism for speed
        singleThread: isCoverageEnabled,
        maxThreads: isCoverageEnabled ? 1 : 16,
        minThreads: isCoverageEnabled ? 1 : 4,
        // Don't isolate to reduce overhead
        isolate: false,
        // Use worker threads for better performance
        useAtomics: true,
      },
    },
    // Reduce timeouts for faster failures
    testTimeout: 10_000,
    hookTimeout: 10_000,
    // Speed optimizations
    cache: {
      dir: './.cache/vitest'
    },
    sequence: {
      // Run tests concurrently within suites
      concurrent: true,
    },
    // Bail early on first failure in CI
    bail: process.env.CI ? 1 : 0,
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
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99,
      },
    },
  },
})
