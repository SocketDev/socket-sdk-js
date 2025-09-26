/** @fileoverview Tests for HTTP client utility functions and module selection. */
import http from 'node:http'
import https from 'node:https'

import { describe, expect, it } from 'vitest'

import { getHttpModule } from '../src/http-client.js'

describe('HTTP Client - Module Selection', () => {
  describe('getHttpModule', () => {
    it('should return https module for secure HTTPS URLs', () => {
      const httpsModule = getHttpModule('https://api.socket.dev')
      expect(httpsModule).toBe(https)
    })

    it('should return http module for insecure HTTP URLs', () => {
      const httpModule = getHttpModule('http://api.socket.dev')
      expect(httpModule).toBe(http)
    })

    it('should default to http module for non-HTTPS protocol URLs', () => {
      const httpModule = getHttpModule('ftp://example.com')
      expect(httpModule).toBe(http)
    })

    it('should handle edge cases with empty and malformed URLs gracefully', () => {
      expect(getHttpModule('')).toBe(http)
      expect(getHttpModule('not-a-url')).toBe(http)
      expect(getHttpModule('httpss://typo.com')).toBe(http)
    })
  })
})
