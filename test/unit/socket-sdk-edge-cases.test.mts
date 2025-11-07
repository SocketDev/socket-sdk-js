/** @fileoverview Tests for Socket SDK edge cases and error branches. */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index'

describe('SocketSdk - Edge Cases and Error Branches', () => {
  describe('SDK configuration', () => {
    it('should handle SDK with minimal configuration', () => {
      const sdk = new SocketSdk('test-token')
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should handle SDK with all options', () => {
      const sdk = new SocketSdk('test-token', {
        baseUrl: 'https://custom.api.dev',
        timeout: 60000,
        retries: 5,
        retryDelay: 2000,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should handle SDK with zero retries', () => {
      const sdk = new SocketSdk('test-token', {
        retries: 0,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should handle SDK with custom timeout', () => {
      const sdk = new SocketSdk('test-token', {
        timeout: 5000,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })

    it('should handle SDK with custom retry delay', () => {
      const sdk = new SocketSdk('test-token', {
        retryDelay: 500,
      })
      expect(sdk).toBeInstanceOf(SocketSdk)
    })
  })
})
