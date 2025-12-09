/** @fileoverview Tests for SocketSdk configuration validation and edge cases. */
import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index'

describe('SocketSdk - Configuration Validation', () => {
  describe('API token validation', () => {
    it('should throw TypeError for non-string API token', () => {
      // Test validation of non-string token
      expect(() => new SocketSdk(null as any)).toThrow(TypeError)
      expect(() => new SocketSdk(null as any)).toThrow(
        '"apiToken" is required and must be a string',
      )
    })

    it('should throw TypeError for undefined API token', () => {
      expect(() => new SocketSdk(undefined as any)).toThrow(TypeError)
      expect(() => new SocketSdk(undefined as any)).toThrow(
        '"apiToken" is required and must be a string',
      )
    })

    it('should throw TypeError for number as API token', () => {
      expect(() => new SocketSdk(12_345 as any)).toThrow(TypeError)
      expect(() => new SocketSdk(12_345 as any)).toThrow(
        '"apiToken" is required and must be a string',
      )
    })

    it('should throw TypeError for object as API token', () => {
      expect(() => new SocketSdk({ token: 'test' } as any)).toThrow(TypeError)
      expect(() => new SocketSdk({ token: 'test' } as any)).toThrow(
        '"apiToken" is required and must be a string',
      )
    })

    it('should throw error for empty API token', () => {
      // Test validation of empty token
      expect(() => new SocketSdk('')).toThrow(
        '"apiToken" cannot be empty or whitespace-only',
      )
    })

    it('should throw error for whitespace-only API token', () => {
      // Test validation of whitespace token
      expect(() => new SocketSdk('   ')).toThrow(
        '"apiToken" cannot be empty or whitespace-only',
      )
    })

    it('should handle custom timeout in options', () => {
      const sdk = new SocketSdk('test-token', {
        timeout: 5000,
      })
      expect(sdk).toBeDefined()
    })

    it('should handle custom retries in options', () => {
      const sdk = new SocketSdk('test-token', {
        retries: 3,
      })
      expect(sdk).toBeDefined()
    })

    it('should handle custom baseUrl in options', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://custom.api.socket.dev/',
      })
      expect(sdk).toBeDefined()
    })

    it('should handle all custom options together', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://custom.api.socket.dev/',
        timeout: 10_000,
        retries: 5,
      })
      expect(sdk).toBeDefined()
    })
  })

  describe('SDK API token validation', () => {
    it('should throw error for API token exceeding maximum length', () => {
      // Create a token longer than 1024 characters (actual max)
      const longToken = 'a'.repeat(1025)
      expect(() => new SocketSdk(longToken)).toThrow(
        '"apiToken" exceeds maximum length of 1024 characters',
      )
    })

    it('should accept API token at maximum length boundary', () => {
      // Create a token exactly 1024 characters (max length)
      const maxToken = 'a'.repeat(1024)
      const sdk = new SocketSdk(maxToken)
      expect(sdk).toBeDefined()
    })

    it('should trim whitespace from API token', () => {
      // Token with leading/trailing whitespace
      const sdk = new SocketSdk('  valid-token  ')
      expect(sdk).toBeDefined()
    })
  })

  describe('SDK baseUrl normalization', () => {
    it('should handle baseUrl without trailing slash', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://custom.api.socket.dev',
      })
      expect(sdk).toBeDefined()
    })

    it('should handle baseUrl with trailing slash', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://custom.api.socket.dev/',
      })
      expect(sdk).toBeDefined()
    })

    it('should handle baseUrl with multiple trailing slashes', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://custom.api.socket.dev///',
      })
      expect(sdk).toBeDefined()
    })
  })

  describe('SDK configuration validation', () => {
    it('should throw error for timeout below minimum (5000)', () => {
      expect(
        () =>
          new SocketSdk('test-token', {
            timeout: 4999,
          }),
      ).toThrow(
        '"timeout" must be a number between 5000 and 300000 milliseconds',
      )
    })

    it('should throw error for timeout above maximum (300000)', () => {
      expect(
        () =>
          new SocketSdk('test-token', {
            timeout: 300_001,
          }),
      ).toThrow(
        '"timeout" must be a number between 5000 and 300000 milliseconds',
      )
    })

    it('should accept timeout at minimum boundary', () => {
      const sdk = new SocketSdk('test-token', {
        timeout: 5000,
      })
      expect(sdk).toBeDefined()
    })

    it('should accept timeout at maximum boundary', () => {
      const sdk = new SocketSdk('test-token', {
        timeout: 300_000,
      })
      expect(sdk).toBeDefined()
    })

    it('should accept zero retries', () => {
      const sdk = new SocketSdk('test-token', {
        retries: 0,
      })
      expect(sdk).toBeDefined()
    })

    it('should accept high retries', () => {
      const sdk = new SocketSdk('test-token', {
        retries: 10,
      })
      expect(sdk).toBeDefined()
    })
  })
})
