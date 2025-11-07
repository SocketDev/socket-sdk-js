/** @fileoverview Tests for HTTP client JSON parsing error branches. */

import { describe, expect, it } from 'vitest'

import { getResponseJson } from '../../src/http-client'
import {
  createRouteHandler,
  setupLocalHttpServer,
} from '../utils/local-server-helpers.mts'

import type { IncomingMessage } from 'node:http'

describe('HTTP Client - JSON Parsing Error Branches', () => {
  describe('getResponseJson Content-Type validation', () => {
    const getBaseUrl = setupLocalHttpServer(
      createRouteHandler({
        '/wrong-content-type': (_req: IncomingMessage, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<!DOCTYPE html><html></html>')
        },
        '/html-response': (_req: IncomingMessage, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('<html><body>Error Page</body></html>')
        },
        '/empty-json-response': (_req: IncomingMessage, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('')
        },
        '/502-gateway-error': (_req: IncomingMessage, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('502 Bad Gateway - Upstream server error')
        },
        '/503-service-unavailable': (_req: IncomingMessage, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('503 Service Unavailable - Please try again later')
        },
      }),
    )

    it('should detect wrong Content-Type header', async () => {
      const http = await import('node:http')
      const req = http.request(`${getBaseUrl()}/wrong-content-type`, {
        method: 'GET',
      })

      const responsePromise = new Promise<IncomingMessage>(
        (resolve, reject) => {
          req.on('response', resolve)
          req.on('error', reject)
        },
      )

      req.end()

      const response = await responsePromise
      response.setEncoding('utf8')

      await expect(getResponseJson(response)).rejects.toThrow(
        'Unexpected Content-Type: text/html',
      )
    })

    it('should detect HTML response', async () => {
      const http = await import('node:http')
      const req = http.request(`${getBaseUrl()}/html-response`, {
        method: 'GET',
      })

      const responsePromise = new Promise<IncomingMessage>(
        (resolve, reject) => {
          req.on('response', resolve)
          req.on('error', reject)
        },
      )

      req.end()

      const response = await responsePromise
      response.setEncoding('utf8')

      await expect(getResponseJson(response)).rejects.toThrow(
        'Response appears to be HTML',
      )
    })

    it('should detect empty response body', async () => {
      const http = await import('node:http')
      const req = http.request(`${getBaseUrl()}/empty-json-response`, {
        method: 'GET',
      })

      const responsePromise = new Promise<IncomingMessage>(
        (resolve, reject) => {
          req.on('response', resolve)
          req.on('error', reject)
        },
      )

      req.end()

      const response = await responsePromise
      response.setEncoding('utf8')

      // Empty response should parse as {} successfully
      const result = await getResponseJson(response)
      expect(result).toEqual({})
    })

    it('should detect 502 Bad Gateway in response', async () => {
      const http = await import('node:http')
      const req = http.request(`${getBaseUrl()}/502-gateway-error`, {
        method: 'GET',
      })

      const responsePromise = new Promise<IncomingMessage>(
        (resolve, reject) => {
          req.on('response', resolve)
          req.on('error', reject)
        },
      )

      req.end()

      const response = await responsePromise
      response.setEncoding('utf8')

      await expect(getResponseJson(response)).rejects.toThrow(
        'Response indicates a server error',
      )
    })

    it('should detect 503 Service in response', async () => {
      const http = await import('node:http')
      const req = http.request(`${getBaseUrl()}/503-service-unavailable`, {
        method: 'GET',
      })

      const responsePromise = new Promise<IncomingMessage>(
        (resolve, reject) => {
          req.on('response', resolve)
          req.on('error', reject)
        },
      )

      req.end()

      const response = await responsePromise
      response.setEncoding('utf8')

      await expect(getResponseJson(response)).rejects.toThrow(
        'Response indicates a server error',
      )
    })
  })
})
