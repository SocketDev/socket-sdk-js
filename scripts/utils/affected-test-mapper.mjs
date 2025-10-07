/**
 * @fileoverview Maps changed source files to test files for affected test running.
 * Uses git utilities from socket-registry to detect changes.
 */

import path from 'node:path'
import { existsSync } from 'node:fs'
import { normalizePath } from '@socketsecurity/registry/lib/path'
import {
  getChangedFilesSync,
  getStagedFilesSync,
} from '@socketsecurity/registry/lib/git'

const rootPath = path.resolve(process.cwd())

/**
 * Core files that require running all tests when changed.
 * These are utilities or core classes that affect everything.
 */
const CORE_FILES = [
  'src/constants.ts',
  'src/types.ts',
  'src/utils.ts',
  'src/http-client.ts',
  'src/socket-sdk-class.ts',
]

/**
 * Map source files to their corresponding test files.
 * @param {string} filepath - Path to source file
 * @returns {string[]} Array of test file patterns
 */
function mapSourceToTests(filepath) {
  const normalized = normalizePath(filepath)

  // Skip non-code files
  const ext = path.extname(normalized)
  const codeExtensions = ['.js', '.mjs', '.cjs', '.ts', '.cts', '.mts', '.json']
  if (!codeExtensions.includes(ext)) {
    return []
  }

  // Core files affect all tests
  if (CORE_FILES.some(f => normalized.includes(f))) {
    return ['all']
  }

  // Special mappings for specific files
  if (normalized.includes('src/quota-utils.ts')) {
    return [
      'test/quota-utils.test.mts',
      'test/quota-utils-error-handling.test.mts',
    ]
  }

  if (normalized.includes('src/promise-queue.ts')) {
    return ['test/promise-queue.test.mts']
  }

  if (normalized.includes('src/user-agent.ts')) {
    return ['test/agent-configuration.test.mts']
  }

  if (normalized.includes('src/file-upload.ts')) {
    return ['test/socket-sdk-upload-simple.test.mts']
  }

  if (normalized.includes('src/testing.ts')) {
    return ['test/testing-utilities.test.mts']
  }

  if (normalized.includes('src/index.ts')) {
    return ['test/index-exports.test.mts']
  }

  // Try to find corresponding test file
  const basename = path.basename(normalized, path.extname(normalized))
  const possibleTests = [
    `test/${basename}.test.mts`,
    `test/${basename}.test.mjs`,
    `test/${basename}.test.ts`,
  ]

  for (const testFile of possibleTests) {
    if (existsSync(path.join(rootPath, testFile))) {
      return [testFile]
    }
  }

  // If no specific mapping found and it's a source file, run all SDK tests
  // since most tests interact with the SDK class
  return ['all']
}

/**
 * Get affected test files to run based on changed files.
 * @param {Object} options
 * @param {boolean} options.staged - Use staged files instead of all changes
 * @param {boolean} options.all - Run all tests
 * @returns {string[] | null} Array of test patterns, 'all', or null if no tests needed
 */
export function getTestsToRun(options = {}) {
  const { staged = false, all = false } = options

  // All mode runs all tests
  if (all || process.env.FORCE_TEST === '1') {
    return 'all'
  }

  // CI always runs all tests
  if (process.env.CI === 'true') {
    return 'all'
  }

  // Get changed files
  const changedFiles = staged ? getStagedFilesSync() : getChangedFilesSync()

  if (changedFiles.length === 0) {
    // No changes, skip tests
    return null
  }

  const testFiles = new Set()
  let runAllTests = false

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
        break
      }
      for (const test of tests) {
        testFiles.add(test)
      }
      continue
    }

    // Config changes run all tests
    if (
      normalized.includes('vitest.config') ||
      normalized.includes('tsconfig') ||
      normalized.includes('package.json')
    ) {
      runAllTests = true
      break
    }

    // Type definition changes
    if (normalized.startsWith('types/')) {
      runAllTests = true
      break
    }

    // Script changes (test utilities, etc.)
    if (normalized.startsWith('scripts/')) {
      runAllTests = true
      break
    }
  }

  if (runAllTests) {
    return 'all'
  }

  if (testFiles.size === 0) {
    return null
  }

  return Array.from(testFiles)
}
