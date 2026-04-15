/**
 * @fileoverview Maps changed source files to test files for affected test running.
 * Uses git utilities from socket-registry to detect changes.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  getChangedFilesSync,
  getStagedFilesSync,
} from '@socketsecurity/lib/git'
import { normalizePath } from '@socketsecurity/lib/paths/normalize'

const rootPath = path.resolve(process.cwd())

/**
 * Core files that require running all tests when changed.
 */
const CORE_FILES: string[] = [
  'src/helpers.ts',
  'src/strings.ts',
  'src/constants.ts',
  'src/lang.ts',
  'src/error.ts',
  'src/validate.ts',
  'src/normalize.ts',
  'src/encode.ts',
  'src/decode.ts',
  'src/objects.ts',
]

interface TestRunResult {
  tests: string[] | 'all' | undefined
  reason?: string
  mode?: string
}

interface TestRunOptions {
  staged?: boolean
  all?: boolean
}

/**
 * Map source files to their corresponding test files.
 */
function mapSourceToTests(filepath: string): string[] {
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

  // Special mappings
  if (normalized.includes('src/package-url.ts')) {
    return ['test/package-url.test.mts', 'test/integration.test.mts']
  }
  if (normalized.includes('src/package-url-builder.ts')) {
    return ['test/package-url-builder.test.mts', 'test/integration.test.mts']
  }
  if (normalized.includes('src/url-converter.ts')) {
    return ['test/url-converter.test.mts']
  }
  if (normalized.includes('src/result.ts')) {
    return ['test/result.test.mts']
  }

  // If no specific mapping, run all tests to be safe
  return ['all']
}

/**
 * Get affected test files to run based on changed files.
 */
export function getTestsToRun(options: TestRunOptions = {}): TestRunResult {
  const { all = false, staged = false } = options

  // All mode runs all tests
  if (all || process.env.FORCE_TEST === '1') {
    return { tests: 'all', reason: 'explicit --all flag', mode: 'all' }
  }

  // CI always runs all tests
  if (process.env.CI === 'true') {
    return { tests: 'all', reason: 'CI environment', mode: 'all' }
  }

  // Get changed files
  const changedFiles = staged ? getStagedFilesSync() : getChangedFilesSync()
  const mode = staged ? 'staged' : 'changed'

  if (changedFiles.length === 0) {
    // No changes, skip tests
    return { tests: undefined, mode }
  }

  const testFiles = new Set()
  let runAllTests = false
  let runAllReason = ''

  for (const file of changedFiles) {
    const normalized = normalizePath(file)

    // Test files always run themselves
    if (normalized.startsWith('test/') && normalized.includes('.test.')) {
      // Skip deleted files.
      if (existsSync(path.join(rootPath, file))) {
        testFiles.add(file)
      }
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
        // Skip deleted files.
        if (existsSync(path.join(rootPath, test))) {
          testFiles.add(test)
        }
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

    // Data changes run integration tests
    if (normalized.startsWith('data/')) {
      // Skip deleted files.
      if (existsSync(path.join(rootPath, 'test/integration.test.mts'))) {
        testFiles.add('test/integration.test.mts')
      }
      if (existsSync(path.join(rootPath, 'test/purl-types.test.mts'))) {
        testFiles.add('test/purl-types.test.mts')
      }
    }
  }

  if (runAllTests) {
    return { tests: 'all', reason: runAllReason, mode: 'all' }
  }

  if (testFiles.size === 0) {
    return { tests: undefined, mode }
  }

  return { tests: Array.from(testFiles), mode }
}
