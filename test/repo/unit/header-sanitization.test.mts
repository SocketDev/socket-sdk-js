/**
 * @file Tests for header sanitization utilities.
 */

import fc from 'fast-check'
import { describe, expect, it, test } from 'vitest'

import {
  sanitizeHeaders,
  SENSITIVE_HEADERS,
} from '../../../src/utils/header-sanitization.mts'

describe('header-sanitization', () => {
  describe('SENSITIVE_HEADERS', () => {
    it('exports a list of sensitive header names', () => {
      expect(SENSITIVE_HEADERS).toBeInstanceOf(Array)
      expect(SENSITIVE_HEADERS.length).toBeGreaterThan(0)
      expect(SENSITIVE_HEADERS).toContain('authorization')
      expect(SENSITIVE_HEADERS).toContain('cookie')
      expect(SENSITIVE_HEADERS).toContain('set-cookie')
      expect(SENSITIVE_HEADERS).toContain('proxy-authorization')
      expect(SENSITIVE_HEADERS).toContain('www-authenticate')
      expect(SENSITIVE_HEADERS).toContain('proxy-authenticate')
    })
  })

  describe('sanitizeHeaders', () => {
    it('returns undefined when headers is undefined', () => {
      expect(sanitizeHeaders(undefined)).toBeUndefined()
    })

    it('handles array of strings by joining them', () => {
      const headers = ['header1', 'header2', 'header3']
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({ headers: 'header1, header2, header3' })
    })

    it('redacts authorization header', () => {
      const headers = { authorization: 'Bearer secret-token' }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({ authorization: '[REDACTED]' })
    })

    it('redacts Authorization header (case insensitive)', () => {
      const headers = { Authorization: 'Bearer secret-token' }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({ Authorization: '[REDACTED]' })
    })

    it('redacts cookie header', () => {
      const headers = { cookie: 'sessionId=abc123' }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({ cookie: '[REDACTED]' })
    })

    it('redacts set-cookie header', () => {
      const headers = { 'set-cookie': 'sessionId=abc123; Path=/' }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({ 'set-cookie': '[REDACTED]' })
    })

    it('redacts proxy-authorization header', () => {
      const headers = { 'proxy-authorization': 'Basic dXNlcjpwYXNz' }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({ 'proxy-authorization': '[REDACTED]' })
    })

    it('redacts www-authenticate header', () => {
      const headers = { 'www-authenticate': 'Basic realm="test"' }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({ 'www-authenticate': '[REDACTED]' })
    })

    it('redacts proxy-authenticate header', () => {
      const headers = { 'proxy-authenticate': 'Basic realm="test"' }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({ 'proxy-authenticate': '[REDACTED]' })
    })

    it('preserves non-sensitive headers', () => {
      const headers = {
        'content-type': 'application/json',
        'user-agent': 'test-agent',
        accept: 'application/json',
      }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({
        'content-type': 'application/json',
        'user-agent': 'test-agent',
        accept: 'application/json',
      })
    })

    it('handles mixed sensitive and non-sensitive headers', () => {
      const headers = {
        'content-type': 'application/json',
        authorization: 'Bearer secret-token',
        'user-agent': 'test-agent',
        cookie: 'sessionId=abc123',
      }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: '[REDACTED]',
        'user-agent': 'test-agent',
        cookie: '[REDACTED]',
      })
    })

    it('handles array values by joining them', () => {
      const headers = {
        'x-custom-header': ['value1', 'value2', 'value3'],
      }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({
        'x-custom-header': 'value1, value2, value3',
      })
    })

    it('handles mixed single and array values', () => {
      const headers = {
        'content-type': 'application/json',
        'x-custom': ['val1', 'val2'],
      }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({
        'content-type': 'application/json',
        'x-custom': 'val1, val2',
      })
    })

    it('converts non-string values to strings', () => {
      const headers = {
        'content-length': 1234,
        'x-numeric': 42,
      }
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({
        'content-length': '1234',
        'x-numeric': '42',
      })
    })

    it('handles empty headers object', () => {
      const headers = {}
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({})
    })

    it('handles empty array', () => {
      const headers: string[] = []
      const result = sanitizeHeaders(headers)
      expect(result).toEqual({ headers: '' })
    })
  })
})

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
          // oxlint-disable-next-line unicorn/no-array-sort -- fresh copy
          expect(Object.keys(result).slice().sort()).toEqual(
            // oxlint-disable-next-line unicorn/no-array-sort -- fresh copy
            Object.keys(safeHeaders).slice().sort(),
          )
          const resultValues = Object.values(result)
          for (let i = 0, { length } = resultValues; i < length; i += 1) {
            expect(typeof resultValues[i]).toBe('string')
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
          const values = Object.values(result!)
          for (let i = 0, { length } = values; i < length; i += 1) {
            expect(typeof values[i]).toBe('string')
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
