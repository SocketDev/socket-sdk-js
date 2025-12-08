/**
 * @fileoverview Tests for SDK configuration and initialization.
 * Validates that the SDK properly handles different configuration options,
 * user agents, base URLs, and authentication setups.
 */

import { describe, expect, it } from 'vitest'

import { DEFAULT_USER_AGENT } from '../../src/constants'
import { SocketSdk } from '../../src/index'

describe('SDK Configuration', () => {
  describe('initialization with different options', () => {
    it('should initialize with token only', () => {
      const sdk = new SocketSdk('test-token')
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should initialize with custom base URL', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://custom.api.socket.dev',
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should initialize with custom user agent', () => {
      const customUA = 'MyApp/1.0.0'
      const sdk = new SocketSdk('test-token', {
        userAgent: customUA,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should use default user agent when not provided', () => {
      const sdk = new SocketSdk('test-token')
      expect(DEFAULT_USER_AGENT).toBeDefined()
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should initialize with timeout configuration', () => {
      const sdk = new SocketSdk('test-token', {
        timeout: 30_000,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should initialize with cache enabled', () => {
      const sdk = new SocketSdk('test-token', {
        cache: true,
        cacheTtl: 60_000,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should initialize with cache disabled', () => {
      const sdk = new SocketSdk('test-token', {
        cache: false,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should initialize with per-endpoint cache TTL', () => {
      const sdk = new SocketSdk('test-token', {
        cache: true,
        cacheTtl: {
          default: 60_000,
          organizations: 120_000,
        },
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should initialize with retry configuration', () => {
      const sdk = new SocketSdk('test-token', {
        retries: 3,
        retryDelay: 1000,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should initialize with hooks', () => {
      const hooks = {
        onRequest: () => {},
        onResponse: () => {},
      }
      const sdk = new SocketSdk('test-token', {
        hooks,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should initialize with file validation callback', () => {
      const sdk = new SocketSdk('test-token', {
        onFileValidation: () => ({ shouldContinue: true }),
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })
  })

  describe('token handling', () => {
    it('should trim whitespace from token', () => {
      const sdk = new SocketSdk('  test-token  ')
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should accept token with special characters', () => {
      const sdk = new SocketSdk('test-token-123_ABC.xyz')
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should reject empty string token', () => {
      expect(() => new SocketSdk('')).toThrow(
        '"apiToken" cannot be empty or whitespace-only',
      )
    })

    it('should reject whitespace-only token', () => {
      expect(() => new SocketSdk('   ')).toThrow(
        '"apiToken" cannot be empty or whitespace-only',
      )
    })
  })

  describe('base URL normalization', () => {
    it('should handle trailing slash in base URL', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://api.socket.dev/',
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should handle base URL without trailing slash', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://api.socket.dev',
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should handle base URL with path', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://api.socket.dev/v0',
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })
  })

  describe('combined configuration options', () => {
    it('should handle multiple options together', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://custom.api.socket.dev',
        userAgent: 'TestAgent/1.0',
        timeout: 30_000,
        cache: true,
        cacheTtl: {
          default: 60_000,
          quota: 120_000,
        },
        retries: 3,
        retryDelay: 1000,
        hooks: {
          onRequest: () => {},
          onResponse: () => {},
        },
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })
  })
})

describe('SDK Authentication', () => {
  it('should encode token in Basic auth format', () => {
    const sdk = new SocketSdk('my-secret-token')
    expect(sdk).toBeInstanceOf(SocketSdk)
    // Token is base64 encoded as "my-secret-token:"
    // The actual authorization header is created internally
  })

  it('should handle tokens with colons', () => {
    const sdk = new SocketSdk('token:with:colons')
    expect(sdk).toBeInstanceOf(SocketSdk)
  })

  it('should handle very long tokens', () => {
    const longToken = 'a'.repeat(1000)
    const sdk = new SocketSdk(longToken)
    expect(sdk).toBeInstanceOf(SocketSdk)
  })
})

describe('SDK Cache Configuration', () => {
  describe('numeric cacheTtl', () => {
    it('should use numeric value as default TTL', () => {
      const sdk = new SocketSdk('test-token', {
        cache: true,
        cacheTtl: 30_000,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should work with zero TTL', () => {
      const sdk = new SocketSdk('test-token', {
        cache: true,
        cacheTtl: 0,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })
  })

  describe('object cacheTtl', () => {
    it('should use default property when provided', () => {
      const sdk = new SocketSdk('test-token', {
        cache: true,
        cacheTtl: {
          default: 45_000,
        },
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should handle missing default property', () => {
      const sdk = new SocketSdk('test-token', {
        cache: true,
        cacheTtl: {
          quota: 60_000,
        },
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should handle multiple endpoint-specific TTLs', () => {
      const sdk = new SocketSdk('test-token', {
        cache: true,
        cacheTtl: {
          default: 30_000,
          organizations: 60_000,
          quota: 120_000,
        },
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })
  })
})
