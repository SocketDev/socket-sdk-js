/** @fileoverview Tests for Socket SDK HTTP status code error handling. */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index'
import {
  createRouteHandler,
  jsonResponse,
  setupLocalHttpServer,
} from '../utils/local-server-helpers.mts'

import type { SocketSdkGenericResult } from '../../src/types'

describe('SocketSdk - HTTP Status Code Handling', () => {
  const getBaseUrl = setupLocalHttpServer(
    createRouteHandler({
      '/400-bad-request': jsonResponse(400, {
        error: 'Bad Request',
        message: 'Invalid parameters provided',
      }),
      '/413-payload-too-large': jsonResponse(413, {
        error: 'Payload Too Large',
        message: 'Request body exceeds maximum size',
      }),
      '/429-with-retry-after': (_req, res) => {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        })
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }))
      },
    }),
  )

  const getClient = () =>
    new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 0 })

  describe('400 Bad Request', () => {
    it('should provide actionable guidance for 400 errors', async () => {
      const result = (await getClient().getApi('/400-bad-request', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.cause).toContain('Bad request')
        expect(result.cause).toContain('Invalid parameters')
        expect(result.cause).toContain('required parameters are provided')
      }
    })
  })

  describe('413 Payload Too Large', () => {
    it('should provide actionable guidance for 413 errors', async () => {
      const result = (await getClient().getApi('/413-payload-too-large', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(413)
        expect(result.cause).toContain('Payload too large')
        expect(result.cause).toContain('Request exceeds size limits')
        expect(result.cause).toContain('Reduce the number of files')
      }
    })
  })

  describe('429 Rate Limit with Retry-After', () => {
    it('should parse Retry-After header and include in guidance', async () => {
      const result = (await getClient().getApi('/429-with-retry-after', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(429)
        expect(result.cause).toContain('Rate limit exceeded')
        expect(result.cause).toContain('Retry after 60 seconds')
      }
    })
  })
})
