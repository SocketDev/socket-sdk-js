/**
 * @file Shared API transport, authentication, and error contracts.
 */
import { createServer } from 'node:http'

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import {
  createSdkApiContext,
  getSdkRequestPath,
  requestSdkBytes,
  requestSdkJson,
} from '../../../src/api-client.mts'
import { parseSdkRetryAfter } from '../../../src/api-retry.mts'
import {
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
} from '../../../src/http-client.mts'
import { SocketSdk } from '../../../src/index.mts'
import { setupTestEnvironment } from '../../utils/environment.mts'

describe('Shared API request contracts', () => {
  setupTestEnvironment()

  it.each([200, 201, 202, 204])('preserves status %i', async status => {
    const body = status === 204 ? undefined : { status: 'accepted' }
    const scope = nock('https://api.socket.dev')
      .post('/v0/jobs', { name: 'example-job' })
      .reply(status, body)
    const context = createSdkApiContext({
      baseUrl: 'https://api.socket.dev/v0/',
      retries: 0,
    })
    const result = await requestSdkJson(context, {
      path: 'jobs',
      method: 'POST',
      body: { name: 'example-job' },
    })
    expect(result.success).toBe(true)
    expect(result.status).toBe(status)
    expect(scope.isDone()).toBe(true)
  })

  it('retains false query values and omits absent values', () => {
    expect(
      getSdkRequestPath({
        path: '/policies',
        query: {
          ...(JSON.parse('{"dry_run":false,"limit":0,"unused":null}') as Record<
            string,
            unknown
          >),
          optional: undefined,
        },
      }),
    ).toBe('policies?dry_run=false&limit=0')
  })

  it('rejects query objects instead of sending object stringification', () => {
    expect(() =>
      getSdkRequestPath({
        path: '/policies',
        query: { policy: { name: 'example' } },
      }),
    ).toThrow(TypeError)
  })

  it('uses Basic tokens by default and explicit Bearer OAuth tokens', async () => {
    for (const authScheme of ['basic', 'bearer'] as const) {
      const expected =
        authScheme === 'basic'
          ? `Basic ${btoa('example-token:')}`
          : 'Bearer example-token'
      const scope = nock('https://api.socket.dev', {
        reqheaders: { authorization: expected },
      })
        .get('/v0/quota')
        .reply(200, { quota: 1 })
      const sdk = new SocketSdk('example-token', { authScheme, retries: 0 })
      expect((await sdk.getQuota()).success).toBe(true)
      expect(scope.isDone()).toBe(true)
    }
  })

  it('uses the explicit v1 base for custom deployments', async () => {
    const scope = nock('https://api.example.test')
      .get('/next/orgs/example-org/purl/versions/pkg%3Anpm%2Fexample-package')
      .reply(200, { purl: 'pkg:npm/example-package', versions: [] })
    const sdk = new SocketSdk('example-token', {
      baseUrl: 'https://api.example.test/current/',
      apiV1BaseUrl: 'https://api.example.test/next/',
      retries: 0,
    })
    expect(
      (await sdk.getOrgPurlVersions('example-org', 'pkg:npm/example-package'))
        .success,
    ).toBe(true)
    expect(scope.isDone()).toBe(true)
  })

  it.each([
    {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid package selector',
    },
    { error: { message: 'Invalid package selector' } },
    { error: 'Invalid package selector' },
  ])('retains actionable API error details', async body => {
    nock('https://api.socket.dev').get('/v0/example').reply(400, body)
    const context = createSdkApiContext({
      baseUrl: 'https://api.socket.dev/v0/',
      retries: 0,
    })
    const result = await requestSdkJson(context, { path: 'example' })
    expect(result.success).toBe(false)
    expect(result.status).toBe(400)
    expect(result.error?.includes('Invalid package selector')).toBe(true)
  })

  it('retains binary response bytes', async () => {
    const body = Buffer.from([0, 255, 31, 139, 8])
    nock('https://api.socket.dev').get('/v0/blob').reply(200, body)
    const context = createSdkApiContext({
      baseUrl: 'https://api.socket.dev/v0/',
      retries: 0,
    })
    const result = await requestSdkBytes(context, { path: 'blob' })
    expect(result).toEqual({
      data: new Uint8Array(body),
      status: 200,
      success: true,
    })
  })

  it('cancels retry waits without opening another request', async () => {
    const controller = new AbortController()
    const scope = nock('https://api.socket.dev')
      .get('/v0/example')
      .reply(429, { error: 'rate limited' }, { 'retry-after': '3600' })
    const context = createSdkApiContext({
      baseUrl: 'https://api.socket.dev/v0/',
      retries: 3,
      signal: controller.signal,
      hooks: {
        onResponse() {
          controller.abort()
        },
      },
    })
    await expect(requestSdkJson(context, { path: 'example' })).rejects.toThrow()
    expect(scope.isDone()).toBe(true)
  })

  it.each(['-1', '2seconds', 'unknown'])(
    'rejects invalid Retry-After %s',
    value => {
      expect(parseSdkRetryAfter(value)).toBeUndefined()
    },
  )
})

describe('HTTP request cancellation', () => {
  it.each(['GET', 'POST', 'DELETE'] as const)(
    'cancels an active %s request',
    async method => {
      const controller = new AbortController()
      const server = createServer((request, response) => {
        response.on('error', () => {})
        request.resume()
        controller.abort()
      })
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Missing server port')
      }
      const baseUrl = `http://127.0.0.1:${address.port}/`
      const options = { signal: controller.signal, timeout: 1000 }
      try {
        let request: Promise<unknown>
        if (method === 'POST') {
          request = createRequestWithJson(
            'POST',
            baseUrl,
            'cancel',
            {},
            options,
          )
        } else if (method === 'DELETE') {
          request = createDeleteRequest(baseUrl, 'cancel', options)
        } else {
          request = createGetRequest(baseUrl, 'cancel', options)
        }
        await expect(request).rejects.toMatchObject({
          cause: { code: 'ABORT_ERR' },
        })
      } finally {
        server.closeAllConnections()
        await new Promise<void>(resolve => server.close(() => resolve()))
      }
    },
  )
})
