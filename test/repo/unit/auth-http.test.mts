/**
 * @file Per-request authentication against a local Socket API HTTP double.
 */
import { createServer } from 'node:http'

import { describe, expect, it } from 'vitest'

import FormData from '../../../src/external/form-data.js'
import { createUploadRequest } from '../../../src/file-upload.mts'
import {
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
} from '../../../src/http-client.mts'
import { SocketSdk } from '../../../src/socket-sdk-class.mts'

import type { RequestOptionsWithHooks } from '../../../src/types/core.mts'

describe('HTTP authentication', () => {
  it('sends current Bearer credentials through every transport', async () => {
    const authorizationHeaders: Array<string | undefined> = []
    const methods: Array<string | undefined> = []
    const server = createServer((request, response) => {
      authorizationHeaders.push(request.headers.authorization)
      methods.push(request.method)
      request.resume()
      request.on('end', () => {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end('{}')
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Missing server port')
    }
    const baseUrl = `http://127.0.0.1:${address.port}/`
    let tokenNumber = 0
    const options: RequestOptionsWithHooks = {
      headers: { Authorization: 'Basic stale-credential' },
      authProvider: async () => {
        tokenNumber += 1
        return { token: `rotated-${tokenNumber}`, authScheme: 'bearer' }
      },
    }
    try {
      await createGetRequest(baseUrl, 'resource', options)
      await createDeleteRequest(baseUrl, 'resource', options)
      await createRequestWithJson('POST', baseUrl, 'resource', {}, options)
      const form = new FormData()
      form.append('manifest', '{"name":"example-package"}')
      await createUploadRequest(baseUrl, 'resource', form, options)
      expect(authorizationHeaders).toEqual([
        'Bearer rotated-1',
        'Bearer rotated-2',
        'Bearer rotated-3',
        'Bearer rotated-4',
      ])
      expect(methods).toEqual(['GET', 'DELETE', 'POST', 'POST'])
      expect(options.headers?.['Authorization']).toBe('Basic stale-credential')
    } finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

  it('resolves credentials for repeated SDK calls and does not replay a 401', async () => {
    const authorizationHeaders: Array<string | undefined> = []
    let responseStatus = 200
    const server = createServer((request, response) => {
      authorizationHeaders.push(request.headers.authorization)
      request.resume()
      response.writeHead(responseStatus, { 'content-type': 'application/json' })
      response.end(
        responseStatus === 200 ? '{"quota":1}' : '{"error":"unauthorized"}',
      )
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Missing server port')
    }
    let tokenNumber = 0
    const sdk = new SocketSdk('constructor-token', {
      baseUrl: `http://127.0.0.1:${address.port}/`,
      retries: 2,
      retryDelay: 1,
      authProvider: async () => {
        tokenNumber += 1
        return { token: `rotated-${tokenNumber}`, authScheme: 'bearer' }
      },
    })
    try {
      expect((await sdk.getQuota()).success).toBe(true)
      expect((await sdk.getQuota()).success).toBe(true)
      responseStatus = 401
      const rejected = await sdk.getQuota()
      expect(rejected.success).toBe(false)
      expect(rejected.status).toBe(401)
      expect(authorizationHeaders).toEqual([
        'Bearer rotated-1',
        'Bearer rotated-2',
        'Bearer rotated-3',
      ])
      expect(tokenNumber).toBe(3)
    } finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
})
