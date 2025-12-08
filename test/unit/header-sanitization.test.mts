/**
 * @fileoverview Tests for header sanitization utilities.
 */

import { describe, expect, it } from 'vitest'

import {
  SENSITIVE_HEADERS,
  sanitizeHeaders,
} from '../../src/utils/header-sanitization'

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
