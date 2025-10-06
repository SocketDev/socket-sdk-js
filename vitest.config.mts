/**
 * @fileoverview Vitest configuration for Socket SDK test suite.
 * Configures test environment, coverage, and module resolution.
 */
import path from 'node:path'

import { defineConfig } from 'vitest/config'

const isCoverage = process.argv.includes('--coverage')

export default defineConfig({
  resolve: {
    // Map dist imports to src when running coverage, use dist otherwise.
    alias: isCoverage
      ? {
          '../dist/index': path.resolve(__dirname, './src/index.ts'),
          '../dist/http-client.js': path.resolve(
            __dirname,
            './src/http-client.ts',
          ),
          '../dist/testing': path.resolve(__dirname, './src/testing.ts'),
        }
      : {},
  },
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
        singleFork: true,
        maxForks: 1,
        // Isolate tests to prevent memory leaks between test files.
        isolate: true,
      },
      threads: {
        singleThread: true,
        // Limit thread concurrency to prevent RegExp compiler exhaustion.
        maxThreads: 1,
      },
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
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
      ],
      include: ['src/**/*.{ts,mts,cts}'],
      all: true,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 99,
        statements: 100,
      },
    },
  },
})
