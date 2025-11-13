/**
 * @fileoverview Tests for HTTP client error detection and helpful error messages
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../utils/environment.mts'

describe('HTTP Client - Error Detection', () => {
  const getClient = setupTestClient('test-token', { retries: 0 })

  describe('JSON Parsing Error Messages', () => {
    it('should detect HTML response with wrong content-type', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, '<html><body>Not Found</body></html>', {
          'Content-Type': 'text/html',
        })

      const result = await getClient().getQuota()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Unexpected Content-Type: text/html')
      }
    })

    it('should detect HTML in response body', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, '<html><body>Error</body></html>', {
          'Content-Type': 'application/json',
        })

      const result = await getClient().getQuota()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Response appears to be HTML')
      }
    })

    it('should detect 502 Bad Gateway text in HTTP 200 response', async () => {
      // Edge case: proxy returns 200 but body contains gateway error
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, '502 Bad Gateway\nService temporarily unavailable', {
          'Content-Type': 'application/json',
        })

      const result = await getClient().getQuota()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('server error')
      }
    })

    it('should detect 503 Service text in HTTP 200 response', async () => {
      // Edge case: proxy returns 200 but body contains service unavailable
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, '503 Service Unavailable\nPlease try again later', {
          'Content-Type': 'application/json',
        })

      const result = await getClient().getQuota()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('server error')
      }
    })

    it('should detect long response preview truncation', async () => {
      // Response body longer than 200 chars should be truncated in error message
      const longHtmlResponse = `<html><body>${'x'.repeat(300)}</body></html>`

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, longHtmlResponse, {
          'Content-Type': 'application/json',
        })

      const result = await getClient().getQuota()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Response preview:')
        expect(result.error).toContain('...')
      }
    })

    it('should detect mixed content-type and HTML body', async () => {
      // Wrong content-type AND HTML body should show both hints
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, '<html><body>Error page</body></html>', {
          'Content-Type': 'text/plain',
        })

      const result = await getClient().getQuota()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Unexpected Content-Type: text/plain')
      }
    })
  })
})
