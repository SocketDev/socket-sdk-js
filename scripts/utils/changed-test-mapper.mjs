/**
 * @fileoverview Maps changed source files to test files for affected test running.
 * Uses git utilities from socket-registry to detect changes.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'

import {
  getChangedFilesSync,
  getStagedFilesSync,
} from '@socketsecurity/registry/lib/git'
import { normalizePath } from '@socketsecurity/registry/lib/path'

const rootPath = path.resolve(process.cwd())

/**
 * Core files that require running all tests when changed.
 */
const CORE_FILES = [
  'src/constants.ts',
  'src/http-client.ts',
  'src/types.ts',
  'src/utils.ts',
  'src/quota-utils.ts',
  'src/index.ts',
]

/**
 * Map source files to their corresponding test files.
 * @param {string} filepath - Path to source file
 * @returns {string[]} Array of test file paths
 */
function mapSourceToTests(filepath) {
  const normalized = normalizePath(filepath)

  // Skip non-code files
  const ext = path.extname(normalized)
  const codeExtensions = ['.js', '.mjs', '.cjs', '.ts', '.cts', '.mts', '.json']
  if (!codeExtensions.includes(ext)) {
    return []
  }

  // Core utilities affect all tests
  if (CORE_FILES.some(f => normalized.includes(f))) {
    return ['all']
  }

  // Map specific files to their test files
  const basename = path.basename(normalized, path.extname(normalized))
  const testFile = `test/${basename}.test.mts`

  // Check if corresponding test exists
  if (existsSync(path.join(rootPath, testFile))) {
    return [testFile]
  }

  // Special mappings for SDK files
  if (normalized.includes('src/socket-sdk-class.ts')) {
    // Main SDK class affects most tests
    return ['all']
  }
  if (normalized.includes('src/file-upload.ts')) {
    return ['test/socket-sdk-upload-simple.test.mts', 'test/create-request-body-json.test.mts']
  }
  if (normalized.includes('src/user-agent.ts')) {
    return ['test/authentication-basic.test.mts']
  }
  if (normalized.includes('src/promise-queue.ts')) {
    return ['test/promise-queue.test.mts']
  }
  if (normalized.includes('src/testing.ts')) {
    return ['test/testing-utilities.test.mts']
  }

  // If no specific mapping, run all tests to be safe
  return ['all']
}

/**
 * Get affected test files to run based on changed files.
 * @param {Object} options
 * @param {boolean} options.staged - Use staged files instead of all changes
 * @param {boolean} options.all - Run all tests
 * @returns {{tests: string[] | 'all' | null, reason?: string}} Object with test patterns and reason
 */
export function getTestsToRun(options = {}) {
  const { all = false, staged = false } = options

  // All mode runs all tests
  if (all || process.env.FORCE_TEST === '1') {
    return { tests: 'all', reason: 'explicit --all flag' }
  }

  // CI always runs all tests
  if (process.env.CI === 'true') {
    return { tests: 'all', reason: 'CI environment' }
  }

  // Get changed files
  const changedFiles = staged ? getStagedFilesSync() : getChangedFilesSync()

  if (changedFiles.length === 0) {
    // No changes, skip tests
    return { tests: null }
  }

  const testFiles = new Set()
  let runAllTests = false
  let runAllReason = ''

  for (const file of changedFiles) {
    const normalized = normalizePath(file)

    // Test files always run themselves
    if (normalized.startsWith('test/') && normalized.includes('.test.')) {
      testFiles.add(file)
      continue
    }

    // Source files map to test files
    if (normalized.startsWith('src/')) {
      const tests = mapSourceToTests(normalized)
      if (tests.includes('all')) {
        runAllTests = true
        runAllReason = 'core file changes'
        break
      }
      for (const test of tests) {
        testFiles.add(test)
      }
      continue
    }

    // Config changes run all tests
    if (normalized.includes('vitest.config')) {
      runAllTests = true
      runAllReason = 'vitest config changed'
      break
    }

    if (normalized.includes('tsconfig')) {
      runAllTests = true
      runAllReason = 'TypeScript config changed'
      break
    }

    // Package.json changes might affect tests
    if (normalized === 'package.json') {
      runAllTests = true
      runAllReason = 'package.json changed'
      break
    }

    // Test fixtures/data changes
    if (normalized.startsWith('test/fixtures/') || normalized.startsWith('test/data/')) {
      // Run all tests as fixtures might be used across multiple tests
      runAllTests = true
      runAllReason = 'test fixtures changed'
      break
    }
  }

  if (runAllTests) {
    return { tests: 'all', reason: runAllReason }
  }

  if (testFiles.size === 0) {
    return { tests: null }
  }

  return { tests: Array.from(testFiles) }
}
