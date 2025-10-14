/**
 * @fileoverview Vitest configuration for Socket SDK test suite.
 * Configures test environment, coverage, and module resolution.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'vitest/config'

// Check if coverage is enabled via CLI flags or environment.
const isCoverageEnabled =
  process.env['COVERAGE'] === 'true' ||
  process.env['npm_lifecycle_event']?.includes('coverage') ||
  process.argv.some(arg => arg.includes('coverage'))

// Set environment variable so tests can detect coverage mode
if (isCoverageEnabled) {
  process.env['COVERAGE'] = 'true'
}

// Check for local sibling projects to use in development.
// Falls back to published versions in CI.
function getLocalPackageAliases() {
  const aliases = {}
  const rootDir = path.join(import.meta.dirname, '..')

  // Check for ../socket-registry/registry/dist
  const registryPath = path.join(rootDir, '..', 'socket-registry', 'registry', 'dist')
  if (existsSync(path.join(registryPath, '../package.json'))) {
    aliases['@socketsecurity/registry'] = registryPath
  }

  // Check for ../socket-packageurl-js/dist
  const packageurlPath = path.join(rootDir, '..', 'socket-packageurl-js', 'dist')
  if (existsSync(path.join(packageurlPath, '../package.json'))) {
    aliases['@socketregistry/packageurl-js'] = packageurlPath
  }

  return aliases
}

export default defineConfig({
  cacheDir: './.cache/vitest',
  resolve: {
    alias: getLocalPackageAliases(),
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.{js,ts,mjs,mts,cjs}'],
    // Exclude tests that need isolation (they use separate config)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'test/quota-utils-error-handling.test.mts',
      'test/json-parsing-edge-cases.test.mts',
      'test/socket-sdk-retry.test.mts',
      'test/http-client-retry.test.mts',
      'test/getapi-sendapi-methods.test.mts',
      'test/entitlements.test.mts',
      'test/socket-sdk-upload-simple.test.mts',
    ],
    reporters: process.env.TEST_REPORTER === 'json'
      ? ['json', 'default']
      : ['default'],
    setupFiles: ['./test/utils/setup.mts'],
    // Optimize test execution for speed
    // Threads are faster than forks
    pool: 'threads',
    // No special pool matching needed - nock issues are handled in test setup
    poolOptions: {
      forks: {
        // Configuration for tests that opt into fork isolation via { pool: 'forks' }
        // During coverage, use multiple forks for better isolation
        singleFork: false,
        maxForks: isCoverageEnabled ? 4 : 16,
        minForks: isCoverageEnabled ? 1 : 2,
        isolate: true,
      },
      threads: {
        // Maximize parallelism for speed
        // During coverage, use single thread for remaining tests
        singleThread: isCoverageEnabled,
        maxThreads: isCoverageEnabled ? 1 : 16,
        minThreads: isCoverageEnabled ? 1 : 4,
        // IMPORTANT: isolate: false for performance and test compatibility
        //
        // Tradeoff Analysis:
        // - isolate: true  = Full isolation, slower, breaks nock/module mocking
        // - isolate: false = Shared worker context, faster, mocking works
        //
        // We choose isolate: false because:
        // 1. Significant performance improvement (faster test runs)
        // 2. Nock HTTP mocking works correctly across all test files
        // 3. Vi.mock() module mocking functions properly
        // 4. Test state pollution is prevented through proper beforeEach/afterEach
        // 5. Our tests are designed to clean up after themselves
        //
        // Tests requiring true isolation should use pool: 'forks' or be marked
        // with { pool: 'forks' } in the test file itself.
        isolate: false,
        // Use worker threads for better performance
        useAtomics: true,
      },
    },
    // Reduce timeouts for faster failures
    testTimeout: 10_000,
    hookTimeout: 10_000,
    // Speed optimizations
    // Note: cache is now configured via Vite's cacheDir
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
