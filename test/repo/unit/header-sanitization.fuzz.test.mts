/**
 * @file Property/fuzz tests for src/utils/header-sanitization.mts (Tier-1
 *   fast-check). `sanitizeHeaders` is an untrusted-input redactor used for
 *   logging: the load-bearing contract is that a sensitive header value can
 *   NEVER leak (always '[REDACTED]', case-insensitively) and that the function
 *   never throws on arbitrary header-shaped input. Arbitraries are constructed
 *   so the expected classification of each key is known up front.
 */

import fc from 'fast-check'
import { describe, expect, test } from 'vitest'

import {
  SENSITIVE_HEADERS,
  sanitizeHeaders,
} from '../../../src/utils/header-sanitization.mts'

// Non-sensitive header names: alnum + dashes, never one of the sensitive names
// (in any case). Kept distinct from the sensitive set so classification is
// knowable without consulting the SUT.
const sensitiveLower = new Set(SENSITIVE_HEADERS)
const safeName = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'), {
    minLength: 1,
    maxLength: 12,
  })
  .map(chars => chars.join(''))
  .filter(name => !sensitiveLower.has(name.toLowerCase()))

// Randomly re-case a sensitive header name so we exercise case-insensitivity.
const casedSensitive = fc
  .constantFrom(...SENSITIVE_HEADERS)
  .chain(name =>
    fc
      .array(fc.boolean(), { minLength: name.length, maxLength: name.length })
      .map(flags =>
        [...name].map((ch, i) => (flags[i] ? ch.toUpperCase() : ch)).join(''),
      ),
  )

describe('header-sanitization/sanitizeHeaders (fuzz)', () => {
  // INVARIANT: undefined input maps to undefined output.
  test('returns undefined for undefined input', () => {
    expect(sanitizeHeaders(undefined)).toBeUndefined()
  })

  // SECURITY INVARIANT: a sensitive header in ANY casing is always redacted,
  // regardless of the surrounding non-sensitive headers.
  test('always redacts sensitive headers case-insensitively', () => {
    fc.assert(
      fc.property(
        casedSensitive,
        fc.string(),
        fc.dictionary(safeName, fc.string(), { maxKeys: 5 }),
        (sensitiveKey, sensitiveValue, safeHeaders) => {
          const headers = { ...safeHeaders, [sensitiveKey]: sensitiveValue }
          const result = sanitizeHeaders(headers)
          expect(result).toBeDefined()
          expect(result![sensitiveKey]).toBe('[REDACTED]')
        },
      ),
    )
  })

  // DERIVED-FROM-INPUT: non-sensitive string values pass through as-is (the SUT
  // String()-coerces, and a string coerces to itself).
  test('passes through non-sensitive string values unchanged', () => {
    fc.assert(
      fc.property(
        fc.dictionary(safeName, fc.string(), { maxKeys: 8 }),
        safeHeaders => {
          const result = sanitizeHeaders(safeHeaders)
          expect(result).toBeDefined()
          const keys = Object.keys(safeHeaders)
          for (let i = 0, { length } = keys; i < length; i += 1) {
            const key = keys[i]!
            expect(result![key]).toBe(safeHeaders[key])
          }
        },
      ),
    )
  })

  // INVARIANT: output key set === input key set (never drops or adds a header),
  // and every emitted value is a string.
  test('preserves the key set and every value is a string', () => {
    fc.assert(
      fc.property(
        fc.dictionary(safeName, fc.string(), { maxKeys: 8 }),
        safeHeaders => {
          const result = sanitizeHeaders(safeHeaders)!
          expect(Object.keys(result).toSorted()).toEqual(
            Object.keys(safeHeaders).toSorted(),
          )
          for (const value of Object.values(result)) {
            expect(typeof value).toBe('string')
          }
        },
      ),
    )
  })

  // NEVER-THROWS: arbitrary object values (numbers, arrays, null, nested) are
  // tolerated and coerced to strings without throwing.
  test('never throws on arbitrary object-valued headers', () => {
    fc.assert(
      fc.property(
        fc.dictionary(safeName, fc.anything(), { maxKeys: 8 }),
        headers => {
          const result = sanitizeHeaders(headers)
          expect(result).toBeDefined()
          for (const value of Object.values(result!)) {
            expect(typeof value).toBe('string')
          }
        },
      ),
    )
  })

  // ARRAY BRANCH: a bare array collapses into a single joined `headers` entry.
  test('collapses an array input into a single joined headers entry', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 6 }), arr => {
        const result = sanitizeHeaders(arr)
        expect(result).toEqual({ headers: arr.join(', ') })
      }),
    )
  })
})
