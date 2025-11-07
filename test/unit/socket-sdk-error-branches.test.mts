/** @fileoverview Tests for uncovered error branches in Socket SDK. */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index'
import {
  createRouteHandler,
  jsonResponse,
  setupLocalHttpServer,
} from '../utils/local-server-helpers.mts'

import type { SocketSdkGenericResult } from '../../src/types'
import type { IncomingMessage } from 'node:http'

describe('SocketSdk - Error Branch Coverage', () => {
  describe('401/403 errors (no retry)', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/401-test': jsonResponse(401, { error: 'Unauthorized' }),
        '/403-test': jsonResponse(403, { error: 'Forbidden' }),
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 3 })

    it('should not retry 401 errors', async () => {
      const result = (await getClient().getApi('/401-test', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(401)
        expect(result.cause).toContain('Authentication failed')
      }
    })

    it('should not retry 403 errors', async () => {
      const result = (await getClient().getApi('/403-test', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(403)
        expect(result.cause).toContain('Authorization failed')
      }
    })
  })

  describe('404 errors', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/404-test': jsonResponse(404, { error: 'Not Found' }),
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 0 })

    it('should handle 404 errors', async () => {
      const result = (await getClient().getApi('/404-test', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.cause).toContain('Resource not found')
      }
    })
  })

  describe('sendApi with different methods', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/test-endpoint': (_req: IncomingMessage, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, data: { id: 123 } }))
        },
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 0 })

    it('should handle sendApi with POST method', async () => {
      const result = await getClient().sendApi('/test-endpoint', {
        body: { test: 'data' },
        method: 'POST',
      })

      expect(result.success).toBe(true)
    })

    it('should handle sendApi with PUT method', async () => {
      const result = await getClient().sendApi('/test-endpoint', {
        body: { test: 'data' },
        method: 'PUT',
      })

      expect(result.success).toBe(true)
    })

    it('should handle sendApi with empty body', async () => {
      const result = await getClient().sendApi('/test-endpoint', {
        body: {},
        method: 'POST',
      })

      expect(result.success).toBe(true)
    })

    it('should handle sendApi with null in body', async () => {
      const result = (await getClient().sendApi('/test-endpoint', {
        body: { value: null },
        method: 'POST',
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(true)
    })
  })
})
