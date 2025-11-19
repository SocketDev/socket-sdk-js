/**
 * @fileoverview Consolidated utility function tests.
 * Tests for promise utilities, query parameters, user-agent generation,
 * and JSON request body creation.
 *
 * Consolidates:
 * - promise-with-resolvers.test.mts
 * - query-params-normalization.test.mts
 * - user-agent.test.mts
 * - create-request-body-json.test.mts
 */

import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { normalizePath } from '@socketsecurity/lib/paths/normalize'

import {
  calculateWordSetSimilarity,
  createRequestBodyForJson,
  filterRedundantCause,
  normalizeBaseUrl,
  promiseWithResolvers,
  queryToSearchParams,
  resolveAbsPaths,
  resolveBasePath,
  shouldOmitReason,
} from '../../src/index'
import { createUserAgentFromPkgJson } from '../../src/user-agent'

// =============================================================================
// URL Normalization
// =============================================================================

describe('URL Normalization', () => {
  describe('normalizeBaseUrl', () => {
    it('should add trailing slash if missing', () => {
      const result = normalizeBaseUrl('https://api.socket.dev')
      expect(result).toBe('https://api.socket.dev/')
    })

    it('should not modify URL that already has trailing slash', () => {
      const result = normalizeBaseUrl('https://api.socket.dev/')
      expect(result).toBe('https://api.socket.dev/')
    })

    it('should handle local URLs', () => {
      const result = normalizeBaseUrl('http://localhost:3000')
      expect(result).toBe('http://localhost:3000/')
    })

    it('should memoize results for performance', () => {
      const url = 'https://test.example.com'
      const result1 = normalizeBaseUrl(url)
      const result2 = normalizeBaseUrl(url)
      // Both calls should return the same reference (memoized)
      expect(result1).toBe(result2)
      expect(result1).toBe('https://test.example.com/')
    })
  })
})

// =============================================================================
// Path Resolution
// =============================================================================

describe('Path Resolution', () => {
  describe('resolveBasePath', () => {
    it('should resolve relative path to absolute', () => {
      const result = resolveBasePath('.')
      expect(result).toContain('socket-sdk-js')
      expect(path.isAbsolute(result)).toBe(true)
    })

    it('should resolve nested relative path', () => {
      const result = resolveBasePath('./test')
      expect(result).toContain('socket-sdk-js')
      expect(result.endsWith('/test')).toBe(true)
    })

    it('should return absolute path unchanged', () => {
      // Use a truly absolute path for cross-platform testing
      const absolutePath = normalizePath(path.resolve('/tmp/test'))
      const result = resolveBasePath(absolutePath)
      expect(result).toBe(absolutePath)
    })

    it('should default to cwd when no argument provided', () => {
      const result = resolveBasePath()
      expect(result).toContain('socket-sdk-js')
    })
  })

  describe('resolveAbsPaths', () => {
    it('should resolve array of relative paths to absolute', () => {
      const paths = ['./package.json', './src/index.ts']
      const result = resolveAbsPaths(paths)

      expect(result).toHaveLength(2)
      expect(result[0]).toContain('socket-sdk-js/package.json')
      expect(result[1]).toContain('socket-sdk-js/src/index.ts')
      result.forEach(p => expect(path.isAbsolute(p)).toBe(true))
    })

    it('should handle absolute paths in array', () => {
      // Use truly absolute paths for cross-platform testing
      const path1 = normalizePath(path.resolve('/tmp/test.txt'))
      const path2 = normalizePath(path.resolve('/var/log/app.log'))
      const paths = [path1, path2]
      const result = resolveAbsPaths(paths)

      expect(result).toEqual([path1, path2])
    })

    it('should resolve relative to specified base path', () => {
      const paths = ['file1.txt', 'file2.txt']
      const basePath = normalizePath(path.resolve('/custom/base'))
      const result = resolveAbsPaths(paths, basePath)

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(normalizePath(path.join(basePath, 'file1.txt')))
      expect(result[1]).toBe(normalizePath(path.join(basePath, 'file2.txt')))
    })

    it('should handle empty array', () => {
      const result = resolveAbsPaths([])
      expect(result).toEqual([])
    })

    it('should handle mixed absolute and relative paths', () => {
      const basePath = normalizePath(path.resolve('/base'))
      const absolutePath = normalizePath(path.resolve('/absolute.txt'))
      const paths = ['./relative.txt', absolutePath]
      const result = resolveAbsPaths(paths, basePath)

      expect(result[0]).toBe(normalizePath(path.join(basePath, 'relative.txt')))
      expect(result[1]).toBe(absolutePath)
    })
  })
})

// =============================================================================
// Promise Utilities
// =============================================================================

describe('Utility Functions - Promise Resolvers', () => {
  describe('promiseWithResolvers', () => {
    it('should return promise, resolve, and reject functions', () => {
      const { promise, reject, resolve } = promiseWithResolvers<string>()

      expect(promise).toBeInstanceOf(Promise)
      expect(typeof resolve).toBe('function')
      expect(typeof reject).toBe('function')
    })

    it('should resolve promise with provided value', async () => {
      const { promise, resolve } = promiseWithResolvers<number>()

      resolve(42)

      await expect(promise).resolves.toBe(42)
    })

    it('should reject promise with provided error', async () => {
      const { promise, reject } = promiseWithResolvers<string>()
      const error = new Error('Test error')

      reject(error)

      await expect(promise).rejects.toBe(error)
    })

    it('should work with complex types', async () => {
      const { promise, resolve } = promiseWithResolvers<{ data: string[] }>()
      const testData = { data: ['test', 'data'] }

      resolve(testData)

      const result = await promise
      expect(result).toEqual(testData)
      expect(result.data).toHaveLength(2)
    })
  })
})

// =============================================================================
// Query Parameter Normalization
// =============================================================================

describe('Query Parameter Normalization', () => {
  describe('queryToSearchParams', () => {
    it('should convert defaultBranch parameter to default_branch', () => {
      const params = { defaultBranch: 'main', other: 'value' }
      const result = queryToSearchParams(params)

      expect(result.toString()).toBe('default_branch=main&other=value')
    })

    it('should convert perPage parameter to per_page', () => {
      const params = { perPage: '50', other: 'value' }
      const result = queryToSearchParams(params)

      expect(result.toString()).toBe('per_page=50&other=value')
    })

    it('should filter out empty string values', () => {
      const params = { key1: '', key2: 'value', key3: '' }
      const result = queryToSearchParams(params)

      expect(result.toString()).toBe('key2=value')
    })

    it('should handle multiple parameters including defaultBranch', () => {
      const params = {
        active: 'true',
        count: '10',
        defaultBranch: 'develop',
        name: 'test-repo',
      }
      const result = queryToSearchParams(params)
      const resultString = result.toString()

      expect(resultString).toContain('default_branch=develop')
      expect(resultString).toContain('name=test-repo')
      expect(resultString).toContain('active=true')
      expect(resultString).toContain('count=10')
    })

    it('should handle empty defaultBranch parameter', () => {
      const params = { defaultBranch: '' }
      const result = queryToSearchParams(params)

      // Empty strings are filtered out by the function
      expect(result.toString()).toBe('')
    })

    it('should handle defaultBranch with special characters', () => {
      const params = { defaultBranch: 'feature/test-branch' }
      const result = queryToSearchParams(params)

      expect(result.toString()).toContain(
        'default_branch=feature%2Ftest-branch',
      )
    })

    it('should not affect other parameters', () => {
      const params = {
        anotherParam: '123',
        defaultBranch: 'master',
        regularParam: 'value',
      }
      const result = queryToSearchParams(params)
      const resultString = result.toString()

      expect(resultString).toContain('regularParam=value')
      expect(resultString).toContain('anotherParam=123')
      expect(resultString).toContain('default_branch=master')
      expect(resultString).not.toContain('defaultBranch=')
    })
  })
})

// =============================================================================
// User-Agent Generation
// =============================================================================

describe('User-Agent Generation', () => {
  describe('createUserAgentFromPkgJson', () => {
    it('should generate User-Agent without homepage', () => {
      const result = createUserAgentFromPkgJson({
        name: '@socketsecurity/sdk',
        version: '1.0.0',
      })
      expect(result).toBe('socketsecurity-sdk/1.0.0')
    })

    it('should generate User-Agent with homepage', () => {
      const result = createUserAgentFromPkgJson({
        homepage: 'https://socket.dev',
        name: '@socketsecurity/sdk',
        version: '1.0.0',
      })
      expect(result).toBe('socketsecurity-sdk/1.0.0 (https://socket.dev)')
    })

    it('should handle package names without scope', () => {
      const result = createUserAgentFromPkgJson({
        homepage: 'https://example.com',
        name: 'my-package',
        version: '2.5.3',
      })
      expect(result).toBe('my-package/2.5.3 (https://example.com)')
    })

    it('should replace @ and / in scoped package names', () => {
      const result = createUserAgentFromPkgJson({
        name: '@org/my-package',
        version: '1.2.3',
      })
      expect(result).toBe('org-my-package/1.2.3')
    })
  })
})

// =============================================================================
// JSON Request Body Creation
// =============================================================================

describe('JSON Request Body Creation', () => {
  describe('createRequestBodyForJson', () => {
    it('should create request body for JSON data with default basename', () => {
      const jsonData = { number: 42, test: 'data' }
      const result = createRequestBodyForJson(jsonData)

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="data"')
      expect(result[0]).toContain('filename="data.json"')
      expect(result[0]).toContain('Content-Type: application/json')
      expect(result[2]).toBe('\r\n')
    })

    it('should create request body for JSON data with custom basename', () => {
      const jsonData = { custom: true }
      const result = createRequestBodyForJson(jsonData, 'custom-file.json')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="custom-file"')
      expect(result[0]).toContain('filename="custom-file.json"')
      expect(result[0]).toContain('Content-Type: application/json')
    })

    it('should handle basename without extension', () => {
      const jsonData = { test: 'no-ext' }
      const result = createRequestBodyForJson(jsonData, 'noextension')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="noextension"')
      expect(result[0]).toContain('filename="noextension"')
      expect(result[0]).toContain('Content-Type: application/json')
    })

    it('should handle complex JSON data', () => {
      const jsonData = {
        array: [1, 2, 3],
        boolean: false,
        nested: { object: true },
        null: null,
        number: 123.45,
        string: 'test',
      }
      const result = createRequestBodyForJson(jsonData, 'complex.json')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="complex"')
      expect(result[0]).toContain('filename="complex.json"')
      expect(result[0]).toContain('Content-Type: application/json')
    })

    it('should handle empty object', () => {
      const jsonData = {}
      const result = createRequestBodyForJson(jsonData, 'empty.json')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="empty"')
      expect(result[0]).toContain('filename="empty.json"')
    })

    it('should handle null data', () => {
      const jsonData = null
      const result = createRequestBodyForJson(jsonData, 'null.json')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="null"')
      expect(result[0]).toContain('filename="null.json"')
    })

    it('should handle different file extensions', () => {
      const jsonData = { test: true }
      const result = createRequestBodyForJson(jsonData, 'data.manifest')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="data"')
      expect(result[0]).toContain('filename="data.manifest"')
    })
  })
})

// =============================================================================
// Word Set Similarity (Jaccard Overlap Detection)
// =============================================================================

describe('Word Set Similarity', () => {
  describe('calculateWordSetSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const result = calculateWordSetSimilarity('hello world', 'hello world')
      expect(result).toBe(1)
    })

    it('should return 1.0 for same words in different order', () => {
      const result = calculateWordSetSimilarity('hello world', 'world hello')
      expect(result).toBe(1)
    })

    it('should return 0 for completely different strings', () => {
      const result = calculateWordSetSimilarity('hello world', 'goodbye moon')
      expect(result).toBe(0)
    })

    it('should calculate partial overlap correctly', () => {
      // 'world' is shared, {'hello', 'world', 'goodbye'} = 3 total
      // Intersection = 1, union = 3, similarity = 1/3 ≈ 0.33
      const result = calculateWordSetSimilarity('hello world', 'goodbye world')
      expect(result).toBeCloseTo(0.33, 2)
    })

    it('should be case insensitive', () => {
      const result = calculateWordSetSimilarity('Hello World', 'HELLO WORLD')
      expect(result).toBe(1)
    })

    it('should ignore punctuation and special characters', () => {
      const result = calculateWordSetSimilarity('hello, world!', 'hello world')
      expect(result).toBe(1)
    })

    it('should handle duplicate words in same string', () => {
      // Sets eliminate duplicates, so 'hello hello world' becomes {hello, world}
      const result = calculateWordSetSimilarity(
        'hello hello world',
        'hello world',
      )
      expect(result).toBe(1)
    })

    it('should return 1.0 for both empty strings', () => {
      const result = calculateWordSetSimilarity('', '')
      expect(result).toBe(1)
    })

    it('should return 0 for one empty string', () => {
      expect(calculateWordSetSimilarity('hello', '')).toBe(0)
      expect(calculateWordSetSimilarity('', 'world')).toBe(0)
    })

    it('should handle strings with only special characters', () => {
      // Both normalize to empty sets
      const result = calculateWordSetSimilarity('!!!', '???')
      expect(result).toBe(1)
    })

    it('should calculate overlap for error messages', () => {
      // Real-world example: error vs reason
      // Words: {invalid, token} vs {the, token, is, invalid}
      // Intersection: {invalid, token} = 2
      // Union: {invalid, token, the, is} = 4
      // Similarity: 2/4 = 0.5
      const error = 'Invalid token'
      const reason = 'The token is invalid'
      const result = calculateWordSetSimilarity(error, reason)
      expect(result).toBe(0.5)
    })

    it('should detect high similarity in redundant messages', () => {
      // Words: {request, failed} vs {request, failed, due, to, timeout}
      // Intersection: {request, failed} = 2
      // Union: 5
      // Similarity: 2/5 = 0.4
      const error = 'Request failed'
      const reason = 'Request failed due to timeout'
      const result = calculateWordSetSimilarity(error, reason)
      expect(result).toBe(0.4)
    })

    it('should detect low similarity in distinct messages', () => {
      // Words: {request, failed} vs {rate, limit, exceeded}
      // Intersection: {} = 0
      // Union: 5
      // Similarity: 0/5 = 0
      const error = 'Request failed'
      const reason = 'Rate limit exceeded'
      const result = calculateWordSetSimilarity(error, reason)
      expect(result).toBe(0)
    })

    it('should handle numbers in strings', () => {
      const result = calculateWordSetSimilarity(
        'error 404 not found',
        'not found error 404',
      )
      expect(result).toBe(1)
    })

    it('should handle hyphenated words', () => {
      // Regex \w+ treats hyphens as separators
      // Both become {rate, limit, exceeded}
      const result = calculateWordSetSimilarity(
        'rate-limit exceeded',
        'rate limit exceeded',
      )
      expect(result).toBe(1)
    })

    it('should handle multi-line strings', () => {
      const str1 = 'hello\nworld'
      const str2 = 'world\nhello'
      const result = calculateWordSetSimilarity(str1, str2)
      expect(result).toBe(1)
    })
  })

  describe('shouldOmitReason', () => {
    it('should return true for undefined reason', () => {
      const result = shouldOmitReason('Error message', undefined)
      expect(result).toBe(true)
    })

    it('should return true for empty string reason', () => {
      const result = shouldOmitReason('Error message', '')
      expect(result).toBe(true)
    })

    it('should return true for whitespace-only reason', () => {
      const result = shouldOmitReason('Error message', '   \n  ')
      expect(result).toBe(true)
    })

    it('should return true for high similarity (above threshold)', () => {
      // Similarity = 0.5, default threshold = 0.6 is NOT met, so return false
      // Let's use a case that DOES meet threshold
      // Same words, similarity = 1.0
      const error = 'Invalid API token'
      const reason = 'API token invalid'
      const result = shouldOmitReason(error, reason)
      // 1.0 >= 0.6
      expect(result).toBe(true)
    })

    it('should return false for low similarity (below threshold)', () => {
      // Similarity is low
      const error = 'Request failed'
      const reason = 'Rate limit exceeded. Try again later.'
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(false)
    })

    it('should respect custom threshold', () => {
      // Similarity: {token, expired} vs {the, token, has, expired}
      // Intersection: 2, Union: 4, Similarity: 0.5
      const error = 'Token expired'
      const reason = 'The token has expired'
      // 0.5 >= 0.4
      expect(shouldOmitReason(error, reason, 0.4)).toBe(true)
      // 0.5 < 0.6
      expect(shouldOmitReason(error, reason, 0.6)).toBe(false)
    })

    it('should omit highly redundant reasons', () => {
      // Identical = 1.0 similarity
      const error = 'Authentication failed'
      const reason = 'Authentication failed'
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(true)
    })

    it('should keep distinct reasons with actionable guidance', () => {
      // Should keep because guidance adds value despite some word overlap
      const error = 'Socket API Request failed (401): Unauthorized'
      const reason = [
        '→ Authentication failed. API token is invalid or expired.',
        '→ Check: Your API token is correct and active.',
        '→ Generate a new token at: https://socket.dev/api-tokens',
      ].join('\n')
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(false)
    })

    it('should handle threshold edge cases', () => {
      // Similarity: {error, a, b} vs {error, a, b, c}
      // Intersection: 3, Union: 4, Similarity: 0.75
      const error = 'Error A B'
      const reason = 'Error A B C'
      // Exactly at threshold
      expect(shouldOmitReason(error, reason, 0.75)).toBe(true)
      // Above threshold
      expect(shouldOmitReason(error, reason, 0.76)).toBe(false)
    })

    it('should work with real SDK error scenarios', () => {
      // Scenario 1: Body message is subset of error message
      // Similarity is 0.33 (2/6), which is < 0.6 threshold, so should keep
      const error1 = 'Socket API Request failed (400): Bad Request'
      const reason1 = 'Bad Request'
      expect(shouldOmitReason(error1, reason1)).toBe(false)

      // Scenario 2: Identical redundant messages (should omit)
      // Similarity is 1.0, which is >= 0.6 threshold
      const error2 = 'Bad Request'
      const reason2 = 'Bad Request'
      expect(shouldOmitReason(error2, reason2)).toBe(true)

      // Scenario 3: Body message adds new information (should keep)
      // Low overlap
      const error3 = 'Socket API Request failed (400): Bad Request'
      const reason3 =
        'Invalid package URL format. Must be pkg:npm/package@1.0.0'
      expect(shouldOmitReason(error3, reason3)).toBe(false)
    })

    it('should handle actionable guidance with low word overlap', () => {
      // Low word overlap with actionable guidance = keep it
      const error = 'Request failed'
      const reason = [
        '→ Rate limit exceeded.',
        '→ Retry after 60 seconds.',
        '→ Try: Enable SDK retry option.',
      ].join('\n')
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(false)
    })

    it('should use default threshold of 0.6', () => {
      // Similarity: {token, invalid} vs {invalid, token, provided}
      // Intersection: 2, Union: 3, Similarity: 0.667
      // 0.667 >= 0.6 (default threshold)
      const error = 'Token invalid'
      const reason = 'Invalid token provided'
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(true)
    })
  })

  describe('filterRedundantCause', () => {
    it('should return undefined for redundant cause', () => {
      const error = 'Invalid API token'
      const cause = 'API token invalid'
      const result = filterRedundantCause(error, cause)
      expect(result).toBeUndefined()
    })

    it('should return cause for distinct information', () => {
      const error = 'Request failed'
      const cause = 'Rate limit exceeded. Try again later.'
      const result = filterRedundantCause(error, cause)
      expect(result).toBe(cause)
    })

    it('should return undefined for empty cause', () => {
      const error = 'Some error'
      expect(filterRedundantCause(error, undefined)).toBeUndefined()
      expect(filterRedundantCause(error, '')).toBeUndefined()
      expect(filterRedundantCause(error, '   ')).toBeUndefined()
    })

    it('should respect custom threshold', () => {
      const error = 'Token expired'
      const cause = 'The token has expired'
      // Similarity: 0.5
      // With threshold 0.4, should omit (0.5 >= 0.4)
      expect(filterRedundantCause(error, cause, 0.4)).toBeUndefined()
      // With threshold 0.6, should keep (0.5 < 0.6)
      expect(filterRedundantCause(error, cause, 0.6)).toBe(cause)
    })

    it('should work with real error handling patterns', () => {
      // Simulating the pattern from socket-sdk-class.ts
      const errorMsg = 'File validation failed'
      const errorCause = 'File validation failed'
      const finalCause = filterRedundantCause(errorMsg, errorCause)
      expect(finalCause).toBeUndefined()
    })

    it('should keep actionable guidance', () => {
      const errorMsg = 'Socket API Request failed (401): Unauthorized'
      const errorCause = [
        '→ Authentication failed. API token is invalid or expired.',
        '→ Check: Your API token is correct and active.',
        '→ Generate a new token at: https://socket.dev/api-tokens',
      ].join('\n')
      const finalCause = filterRedundantCause(errorMsg, errorCause)
      expect(finalCause).toBe(errorCause)
    })

    it('should simplify error result creation', () => {
      // Example usage pattern
      const errorMessage = 'Operation failed'
      const reason = 'Operation failed due to network error'

      // Old pattern (verbose)
      const oldPattern = shouldOmitReason(errorMessage, reason)
        ? undefined
        : reason

      // New pattern (concise)
      const newPattern = filterRedundantCause(errorMessage, reason)

      expect(oldPattern).toBe(newPattern)
    })

    it('should intelligently handle colon-separated error messages', () => {
      // Common pattern: "Context: Main Error Message"
      // Should compare "Bad Request" with "Bad Request"
      const error = 'Socket API Request failed (400): Bad Request'
      const cause = 'Bad Request'
      const result = filterRedundantCause(error, cause)
      // Should omit because the cause matches the part after the colon
      expect(result).toBeUndefined()
    })

    it('should keep cause if different from colon-extracted message', () => {
      const error = 'Socket API Request failed (400): Bad Request'
      const cause = 'Invalid package URL format'
      const result = filterRedundantCause(error, cause)
      // Should keep because cause is different from "Bad Request"
      expect(result).toBe(cause)
    })

    it('should handle multiple colons correctly', () => {
      // Should check all parts split by colons
      const error = 'HTTP Error: Socket API: Bad Request'
      const cause = 'Bad Request'
      const result = filterRedundantCause(error, cause)
      // Should omit because cause matches one of the parts ("Bad Request")
      expect(result).toBeUndefined()
    })

    it('should match against any part in colon-separated message', () => {
      const error = 'Error: Authentication: Token expired'
      const cause = 'Token expired'
      const result = filterRedundantCause(error, cause)
      // Should omit because "Token expired" is one of the parts
      expect(result).toBeUndefined()
    })

    it('should still work for messages without colons', () => {
      const error = 'Authentication failed'
      const cause = 'Authentication failed'
      const result = filterRedundantCause(error, cause)
      // Should omit based on full message comparison
      expect(result).toBeUndefined()
    })

    it('should handle edge case with empty string after colon', () => {
      const error = 'Error message:'
      const cause = 'Some detailed cause'
      const result = filterRedundantCause(error, cause)
      // Empty main message should be ignored, keep the cause
      expect(result).toBe(cause)
    })
  })
})
