/**
 * @file Property/fuzz tests for src/utils.mts (Tier-1 fast-check).
 *   Targets the pure logic + normalizers: the Jaccard word-set similarity
 *   detector and its consumers, the base-URL trailing-slash normalizer, the
 *   word-set tokenizer, and the camelCase -> snake_case query-param normalizer.
 *   Arbitraries are CONSTRUCTED so the expected outcome is known up front; no
 *   property reimplements the SUT to predict its output.
 */

import fc from 'fast-check'
import { describe, expect, test } from 'vitest'

import {
  calculateWordSetSimilarity,
  filterRedundantCause,
  normalizeBaseUrl,
  normalizeToWordSet,
  queryToSearchParams,
  shouldOmitReason,
} from '../../../src/utils.mts'

// A "word" is a maximal run of \w chars (the regex the SUT tokenizes with).
// Restricting to a fixed lowercase alphabet keeps words disjoint-by-alphabet
// when we want disjoint sets, and stable under lowercasing.
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
