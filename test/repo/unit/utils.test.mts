/**
 * @file Consolidated utility function tests mirroring src/utils.ts. Tests for
 *   URL normalization, path resolution, promise utilities, query parameter
 *   normalization, and user-agent generation. Word-set similarity tests live in
 *   utils-word-set-similarity.test.mts.
 */

import path from 'node:path'

import fc from 'fast-check'
import { describe, expect, it, test } from 'vitest'

import { normalizePath } from '@socketsecurity/lib/paths/normalize'

import { createUserAgentFromPkgJson } from '../../../src/user-agent.mts'
import {
  calculateWordSetSimilarity,
  filterRedundantCause,
  normalizeBaseUrl,
  normalizeToWordSet,
  promiseWithResolvers,
  queryToSearchParams,
  resolveAbsPaths,
  resolveBasePath,
  shouldOmitReason,
} from '../../../src/utils.mts'

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
      /* Suffix-based assertions — matching a specific repo dir
       * name breaks when the test runs from a git worktree whose
       * path segment differs from the primary checkout. */
      expect(result[0]).toMatch(/\/package\.json$/)
      expect(result[1]).toMatch(/\/src\/index\.ts$/)
      for (let i = 0, { length } = result; i < length; i += 1) {
        expect(path.isAbsolute(result[i]!)).toBe(true)
      }
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
        defaultBranch: 'master', // inclusive-language: external-api -- GitHub default-branch query param; legacy branch.
        regularParam: 'value',
      }
      const result = queryToSearchParams(params)
      const resultString = result.toString()

      expect(resultString).toContain('regularParam=value')
      expect(resultString).toContain('anotherParam=123')
      expect(resultString).toContain('default_branch=master') // inclusive-language: external-api -- mirrors fixture above.
      expect(resultString).not.toContain('defaultBranch=')
    })

    it('should return early when no normalization or empty values', () => {
      const params = { key1: 'value1', key2: 'value2' }
      const result = queryToSearchParams(params)

      expect(result.get('key1')).toBe('value1')
      expect(result.get('key2')).toBe('value2')
      expect(result.toString()).toBe('key1=value1&key2=value2')
    })

    it('should handle undefined/null/empty input', () => {
      expect(queryToSearchParams(undefined).toString()).toBe('')
      expect(queryToSearchParams(undefined).toString()).toBe('')
      expect(queryToSearchParams('').toString()).toBe('')
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

const wordFromPool = (pool: string) =>
  fc
    .array(fc.constantFrom(...pool), { minLength: 1, maxLength: 8 })
    .map(chars => chars.join(''))

// Lowercase words so normalizeToWordSet's toLowerCase is a no-op and the
// constructed set equals the SUT's set exactly.
const lowerWord = wordFromPool('abcdefghijklmnopqrstuvwxyz')

const sentence = fc
  .array(lowerWord, { minLength: 1, maxLength: 8 })
  .map(words => words.join(' '))

describe('utils/calculateWordSetSimilarity (fuzz)', () => {
  // INVARIANT (range) + NEVER-THROWS: for ANY two strings the result is a
  // number in [0, 1] and the call never throws.
  test('result is always a number in [0, 1] and never throws', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const result = calculateWordSetSimilarity(a, b)
        expect(typeof result).toBe('number')
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(1)
      }),
    )
  })

  // SYMMETRY: Jaccard(A, B) === Jaccard(B, A). Both sides come from the SUT, so
  // compute each in a var (never build the expected inside expect()).
  test('is symmetric in its arguments', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const forward = calculateWordSetSimilarity(a, b)
        const backward = calculateWordSetSimilarity(b, a)
        expect(forward).toBe(backward)
      }),
    )
  })

  // REFLEXIVITY / self-similarity: a string with at least one word is fully
  // similar to itself (identical word sets).
  test('a word-bearing string is fully similar to itself', () => {
    fc.assert(
      fc.property(sentence, s => {
        expect(calculateWordSetSimilarity(s, s)).toBe(1)
      }),
    )
  })

  // DERIVED-FROM-INPUT: reordering + duplicating the same words yields the same
  // word SET, so similarity stays 1. Constructed, not predicted from the SUT.
  test('similarity is 1 for a reordered/duplicated permutation of the same words', () => {
    fc.assert(
      fc.property(
        fc.array(lowerWord, { minLength: 1, maxLength: 6 }),
        words => {
          const original = words.join(' ')
          const shuffledDuped = [...words, ...words].toReversed().join(' ')
          expect(calculateWordSetSimilarity(original, shuffledDuped)).toBe(1)
        },
      ),
    )
  })

  // ORACLE (disjoint alphabets): two sentences drawn from non-overlapping
  // character pools share no words, so similarity is exactly 0.
  test('similarity is 0 for word sets over disjoint alphabets', () => {
    const leftWord = wordFromPool('abcdef')
    const rightWord = wordFromPool('ghijkl')
    fc.assert(
      fc.property(
        fc.array(leftWord, { minLength: 1, maxLength: 5 }),
        fc.array(rightWord, { minLength: 1, maxLength: 5 }),
        (left, right) => {
          expect(
            calculateWordSetSimilarity(left.join(' '), right.join(' ')),
          ).toBe(0)
        },
      ),
    )
  })
})

describe('utils/normalizeToWordSet (fuzz)', () => {
  // INVARIANT: every element is a lowercase \w+ run; the result is a Set (deduped).
  test('every element is a lowercase word run and the set is deduped', () => {
    fc.assert(
      fc.property(fc.string(), s => {
        const set = normalizeToWordSet(s)
        for (const word of set) {
          expect(/^\w+$/.test(word)).toBe(true)
          expect(word).toBe(word.toLowerCase())
        }
      }),
    )
  })

  // DERIVED-FROM-INPUT: for a sentence of lowercase words joined by spaces, the
  // set is exactly the deduped input words.
  test('recovers the deduped word set from a space-joined lowercase sentence', () => {
    fc.assert(
      fc.property(fc.array(lowerWord, { maxLength: 8 }), words => {
        const set = normalizeToWordSet(words.join(' '))
        const expected = new Set(words)
        expect([...set].toSorted()).toEqual([...expected].toSorted())
      }),
    )
  })
})

describe('utils/normalizeBaseUrl (fuzz)', () => {
  // INVARIANT: the result always ends with a single trailing slash.
  test('result always ends with a trailing slash', () => {
    fc.assert(
      fc.property(fc.webUrl(), url => {
        expect(normalizeBaseUrl(url).endsWith('/')).toBe(true)
      }),
    )
  })

  // IDEMPOTENCE: normalizing an already-normalized URL is a fixed point.
  test('is idempotent', () => {
    fc.assert(
      fc.property(fc.webUrl(), url => {
        const once = normalizeBaseUrl(url)
        const twice = normalizeBaseUrl(once)
        expect(twice).toBe(once)
      }),
    )
  })
})

describe('utils/shouldOmitReason + filterRedundantCause (fuzz)', () => {
  // INVARIANT: an empty / whitespace-only reason is always omitted.
  test('empty or whitespace-only reason is always omitted', () => {
    const blank = fc
      .array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 8 })
      .map(chars => chars.join(''))
    fc.assert(
      fc.property(fc.string(), blank, (message, reason) => {
        expect(shouldOmitReason(message, reason)).toBe(true)
      }),
    )
  })

  // ORACLE: identical word sets score 1.0 >= the default threshold, so a reason
  // equal to the message is always omitted.
  test('a reason identical to the message is omitted', () => {
    fc.assert(
      fc.property(sentence, message => {
        expect(shouldOmitReason(message, message)).toBe(true)
      }),
    )
  })

  // INVARIANT: filterRedundantCause never fabricates a string — it returns
  // either undefined or the exact errorCause it was given.
  test('filterRedundantCause returns undefined or the exact input cause', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.option(fc.string(), { nil: undefined }),
        (message, cause) => {
          const result = filterRedundantCause(message, cause)
          expect(result === undefined || result === cause).toBe(true)
        },
      ),
    )
  })
})

describe('utils/queryToSearchParams (fuzz)', () => {
  // Safe query keys: alnum, never the special-cased camelCase keys, so they
  // pass through verbatim.
  const safeKey = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), {
      minLength: 1,
      maxLength: 8,
    })
    .map(chars => chars.join(''))
    .filter(k => k !== 'defaultBranch' && k !== 'perPage')
  const safeValue = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), {
      minLength: 1,
      maxLength: 8,
    })
    .map(chars => chars.join(''))

  // INVARIANT + NEVER-THROWS: returns a URLSearchParams for a plain string-keyed
  // record.
  test('returns URLSearchParams and never throws for a string record', () => {
    fc.assert(
      fc.property(fc.dictionary(safeKey, safeValue, { maxKeys: 6 }), record => {
        const params = queryToSearchParams(record)
        expect(params).toBeInstanceOf(URLSearchParams)
      }),
    )
  })

  // DERIVED-FROM-INPUT: non-special, non-empty keys/values round-trip verbatim.
  test('passes through non-special keys and values verbatim', () => {
    fc.assert(
      fc.property(fc.dictionary(safeKey, safeValue, { maxKeys: 6 }), record => {
        const params = queryToSearchParams(record)
        const keys = Object.keys(record)
        for (let i = 0, { length } = keys; i < length; i += 1) {
          const key = keys[i]!
          expect(params.get(key)).toBe(record[key])
        }
      }),
    )
  })

  // NORMALIZER: the camelCase keys the API cares about become snake_case.
  test('renames defaultBranch -> default_branch and perPage -> per_page', () => {
    fc.assert(
      fc.property(safeValue, safeValue, (branch, page) => {
        const params = queryToSearchParams({
          defaultBranch: branch,
          perPage: page,
        })
        expect(params.get('default_branch')).toBe(branch)
        expect(params.get('per_page')).toBe(page)
        expect(params.has('defaultBranch')).toBe(false)
        expect(params.has('perPage')).toBe(false)
      }),
    )
  })
})
