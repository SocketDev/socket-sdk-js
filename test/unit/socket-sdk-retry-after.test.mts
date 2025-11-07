/** @fileoverview Tests for Retry-After header parsing. */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index'
import {
  createRouteHandler,
  setupLocalHttpServer,
} from '../utils/local-server-helpers.mts'

import type { IncomingMessage } from 'node:http'
import type { SocketSdkGenericResult } from '../../src/types'

describe('SocketSdk - Retry-After Header Parsing', () => {
  describe('Retry-After with seconds (delay-seconds format)', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/retry-seconds': (_req: IncomingMessage, res) => {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          })
          res.end(JSON.stringify({ error: 'Rate limited' }))
        },
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 1 })

    it('should parse numeric Retry-After header', async () => {
      const result = (await getClient().getApi('/retry-seconds', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(429)
        expect(result.cause).toContain('Retry after 60 seconds')
      }
    })
  })

  describe('Retry-After with HTTP-date format', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/retry-date': (_req: IncomingMessage, res) => {
          // Create a date 30 seconds in the future
          const futureDate = new Date(Date.now() + 30000)
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': futureDate.toUTCString(),
          })
          res.end(JSON.stringify({ error: 'Rate limited' }))
        },
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 1 })

    it('should parse HTTP-date Retry-After header', async () => {
      const result = (await getClient().getApi('/retry-date', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(429)
      }
    })
  })

  describe('Retry-After with zero seconds', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/retry-zero': (_req: IncomingMessage, res) => {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': '0',
          })
          res.end(JSON.stringify({ error: 'Rate limited' }))
        },
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 1 })

    it('should handle zero seconds Retry-After', async () => {
      const result = (await getClient().getApi('/retry-zero', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(429)
      }
    })
  })

  describe('Retry-After with invalid date (past)', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/retry-past': (_req: IncomingMessage, res) => {
          // Date in the past should not be used
          const pastDate = new Date(Date.now() - 30000)
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': pastDate.toUTCString(),
          })
          res.end(JSON.stringify({ error: 'Rate limited' }))
        },
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 1 })

    it('should ignore past date in Retry-After', async () => {
      const result = (await getClient().getApi('/retry-past', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(429)
      }
    })
  })

  describe('Retry-After with invalid format', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/retry-invalid': (_req: IncomingMessage, res) => {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': 'invalid-value',
          })
          res.end(JSON.stringify({ error: 'Rate limited' }))
        },
      }),
    )

    const getClient = () =>
      new SocketSdk('test-token', { baseUrl: getBaseUrl(), retries: 1 })

    it('should handle invalid Retry-After value', async () => {
      const result = (await getClient().getApi('/retry-invalid', {
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(429)
      }
    })
  })
})
