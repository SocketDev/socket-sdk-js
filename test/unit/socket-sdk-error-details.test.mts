/** @fileoverview Tests for error details parsing and specific HTTP error codes. */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index'
import {
  createRouteHandler,
  setupLocalHttpServer,
} from '../utils/local-server-helpers.mts'

import type { SocketSdkGenericResult } from '../../src/types'
import type { IncomingMessage } from 'node:http'

describe('SocketSdk - Error Details and HTTP Codes', () => {
  describe('Error details parsing', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/error-with-string-details': (_req: IncomingMessage, res) => {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: {
                message: 'Validation failed',
                details: 'Package name is required',
              },
            }),
          )
        },
        '/error-with-object-details': (_req: IncomingMessage, res) => {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: {
                message: 'Validation failed',
                details: { field: 'packageName', reason: 'required' },
              },
            }),
          )
        },
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 0 })

    it('should parse string error details', async () => {
      const result = (await getClient().getApi('/error-with-string-details', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.cause).toContain('Details: Package name is required')
      }
    })

    it('should parse object error details', async () => {
      const result = (await getClient().getApi('/error-with-object-details', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.cause).toContain('Details:')
        expect(result.cause).toContain('packageName')
      }
    })
  })

  describe('413 Payload Too Large', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/too-large': (_req: IncomingMessage, res) => {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'Payload too large' } }))
        },
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 0 })

    it('should handle 413 Payload Too Large error', async () => {
      const result = (await getClient().getApi('/too-large', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(413)
        expect(result.cause).toContain('Payload too large')
        expect(result.cause).toContain('Reduce the number')
      }
    })
  })
})
