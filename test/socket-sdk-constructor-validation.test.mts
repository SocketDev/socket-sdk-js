/**
 * @fileoverview Tests for SocketSdk constructor validation.
 *
 * Tests various invalid constructor inputs to ensure proper error handling.
 */
import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

describe('SocketSdk - Constructor Validation', () => {
  describe('apiToken validation', () => {
    it('should throw TypeError when apiToken is not a string', () => {
      expect(() => new SocketSdk(123 as unknown as string)).toThrow(
        TypeError,
      )
      expect(() => new SocketSdk(123 as unknown as string)).toThrow(
        '"apiToken" is required and must be a string',
      )
    })

    it('should throw TypeError when apiToken is null', () => {
      expect(() => new SocketSdk(null as unknown as string)).toThrow(
        TypeError,
      )
      expect(() => new SocketSdk(null as unknown as string)).toThrow(
        '"apiToken" is required and must be a string',
      )
    })

    it('should throw TypeError when apiToken is undefined', () => {
      expect(() => new SocketSdk(undefined as unknown as string)).toThrow(
        TypeError,
      )
      expect(() => new SocketSdk(undefined as unknown as string)).toThrow(
        '"apiToken" is required and must be a string',
      )
    })

    it('should throw Error when apiToken is empty string', () => {
      expect(() => new SocketSdk('')).toThrow(
        '"apiToken" cannot be empty or whitespace-only',
      )
    })

    it('should throw Error when apiToken is whitespace only', () => {
      expect(() => new SocketSdk('   ')).toThrow(
        '"apiToken" cannot be empty or whitespace-only',
      )
    })

    it('should throw Error when apiToken exceeds maximum length', () => {
      // MAX_API_TOKEN_LENGTH is 1024
      const longToken = 'a'.repeat(1025)
      expect(() => new SocketSdk(longToken)).toThrow(
        'exceeds maximum length of 1024 characters',
      )
    })
  })

  describe('options validation', () => {
    it('should throw TypeError when timeout is below minimum', () => {
      expect(
        () =>
          new SocketSdk('test-token', {
            timeout: 0,
          }),
      ).toThrow(TypeError)
      expect(
        () =>
          new SocketSdk('test-token', {
            timeout: 0,
          }),
      ).toThrow('"timeout" must be a number between')
    })

    it('should throw TypeError when timeout is above maximum', () => {
      expect(
        () =>
          new SocketSdk('test-token', {
            timeout: 1000000,
          }),
      ).toThrow(TypeError)
      expect(
        () =>
          new SocketSdk('test-token', {
            timeout: 1000000,
          }),
      ).toThrow('"timeout" must be a number between')
    })

  })

  describe('cache creation', () => {
    it('should create cache when cacheTtl is provided', () => {
      // This tests the cache creation path (lines 153-157)
      expect(() => new SocketSdk('test-token', { cacheTtl: 5000 })).not.toThrow()
    })
  })
})
