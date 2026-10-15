/**
 * @file Retired credentials fail before local Socket API transport.
 */
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

import { describe, expect, it } from 'vitest'

import { SdkAuthenticationError } from '../../../src/auth.mts'
import { SOCKET_PUBLIC_API_TOKEN } from '../../../src/constants.mts'
import FormData from '../../../src/external/form-data.js'
import { createUploadRequest } from '../../../src/file-upload.mts'
import {
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
} from '../../../src/http-client.mts'
import { SocketPurlClient } from '../../../src/public-purl-client.mts'
import { SocketSdk } from '../../../src/socket-sdk-class.mts'

import type { ServerResponse } from 'node:http'
import type { RequestOptionsWithHooks } from '../../../src/types/core.mts'

const PURL = 'pkg:npm/example-package@1.0.0'
const ARTIFACT = {
  alerts: [],
  inputPurl: PURL,
  name: 'example-package',
  type: 'npm',
}

type CapturedRequest = {
  authorization: string | undefined
  method: string | undefined
  path: string | undefined
  body: string
}

async function withLocalApi<T>(
  run: (baseUrl: string, requests: CapturedRequest[]) => Promise<T>,
): Promise<T> {
  const requests: CapturedRequest[] = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      requests.push({
        authorization: request.headers.authorization,
        method: request.method,
        path: request.url,
        body: Buffer.concat(chunks).toString(),
      })
      respond(request.url ?? '', response)
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Missing local API server port')
  }
  try {
    return await run(`http://127.0.0.1:${address.port}/`, requests)
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

function respond(path: string, response: ServerResponse): void {
  if (path.startsWith('/purl/') || path.includes('/batch')) {
    response.writeHead(200, { 'content-type': 'application/x-ndjson' })
    response.end(`${JSON.stringify(ARTIFACT)}\n`)
    return
  }
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end('{}')
}

function errorChainText(error: unknown): string {
  const messages: string[] = []
  let current = error
  while (current instanceof Error) {
    messages.push(current.message)
    current = current.cause
  }
  return messages.join('\n')
}

function expectWrappedAuthenticationFailure(error: unknown): void {
  expect(error).toMatchObject({
    message: 'Unexpected Socket API error',
    cause: expect.objectContaining({ name: 'SdkAuthenticationError' }),
  })
  expect(errorChainText(error)).not.toContain(SOCKET_PUBLIC_API_TOKEN)
}

describe('retired public credential transport rejection', () => {
  it('rejects static SDK and public PURL credentials synchronously', async () => {
    await withLocalApi(async (baseUrl, requests) => {
      let providerCalls = 0
      for (const token of [
        SOCKET_PUBLIC_API_TOKEN,
        ` \t${SOCKET_PUBLIC_API_TOKEN}\n`,
      ]) {
        let failure: unknown
        try {
          new SocketSdk(token, {
            authProvider: async () => {
              providerCalls += 1
              return { token: 'synthetic-current-token', authScheme: 'basic' }
            },
            baseUrl,
          })
        } catch (error) {
          failure = error
        }
        expect(failure).toBeInstanceOf(TypeError)
        expect(errorChainText(failure)).not.toContain(SOCKET_PUBLIC_API_TOKEN)
      }
      let purlClientFailure: unknown
      try {
        new SocketPurlClient({ apiToken: SOCKET_PUBLIC_API_TOKEN, baseUrl })
      } catch (error) {
        purlClientFailure = error
      }
      expect(purlClientFailure).toBeInstanceOf(TypeError)
      expect(errorChainText(purlClientFailure)).not.toContain(
        SOCKET_PUBLIC_API_TOKEN,
      )
      expect(providerCalls).toBe(0)
      expect(requests).toHaveLength(0)
    })
  })

  it('rejects provider credentials before hooks or each HTTP transport', async () => {
    await withLocalApi(async (baseUrl, requests) => {
      let providerCalls = 0
      let requestHooks = 0
      const options: RequestOptionsWithHooks = {
        headers: { Authorization: 'Basic synthetic-current-static-token' },
        authProvider: async () => {
          providerCalls += 1
          return { token: SOCKET_PUBLIC_API_TOKEN, authScheme: 'bearer' }
        },
        hooks: { onRequest: () => (requestHooks += 1) },
      }
      const transports = [
        () => createGetRequest(baseUrl, 'resource', options),
        () => createDeleteRequest(baseUrl, 'resource', options),
        () => createRequestWithJson('POST', baseUrl, 'resource', {}, options),
        () => createUploadRequest(baseUrl, 'resource', new FormData(), options),
      ]
      for (const transport of transports) {
        await expect(transport()).rejects.toBeInstanceOf(SdkAuthenticationError)
      }
      expect(providerCalls).toBe(transports.length)
      expect(requestHooks).toBe(0)
      expect(requests).toHaveLength(0)
    })
  })

  it('rejects retired providers for public PURL requests without static fallback', async () => {
    await withLocalApi(async (baseUrl, requests) => {
      let providerCalls = 0
      const client = new SocketPurlClient({
        apiToken: 'synthetic-current-static-token',
        authScheme: 'basic',
        authProvider: async () => {
          providerCalls += 1
          return { token: SOCKET_PUBLIC_API_TOKEN, authScheme: 'bearer' }
        },
        baseUrl,
        retries: 4,
        retryDelay: 0,
      })
      const failures: unknown[] = []
      const operations = [
        () => client.getPurl(PURL),
        () => client.batchPackageFetch({ components: [{ purl: PURL }] }),
        async () => {
          const results = []
          for await (const result of client.batchPackageStream({
            components: [{ purl: PURL }],
          })) {
            results.push(result)
          }
          return results
        },
        () =>
          client.batchOrgPackageFetch('example-org', {
            components: [{ purl: PURL }],
          }),
        async () => {
          const results = []
          for await (const result of client.batchOrgPackageStream(
            'example-org',
            { components: [{ purl: PURL }] },
          )) {
            results.push(result)
          }
          return results
        },
      ]
      for (const operation of operations) {
        try {
          await operation()
        } catch (error) {
          failures.push(error)
        }
      }
      expect(failures).toHaveLength(operations.length)
      for (const failure of failures) {
        expectWrappedAuthenticationFailure(failure)
      }
      expect(providerCalls).toBe(operations.length)
      expect(requests).toHaveLength(0)
    })
  })

  it('rejects a retired SocketSdk provider once without retry or static fallback', async () => {
    await withLocalApi(async (baseUrl, requests) => {
      let providerCalls = 0
      const sdk = new SocketSdk('synthetic-current-static-token', {
        authProvider: async () => {
          providerCalls += 1
          return {
            token:
              providerCalls === 1
                ? 'synthetic-rotated-token'
                : SOCKET_PUBLIC_API_TOKEN,
            authScheme: 'bearer',
          }
        },
        baseUrl,
        retries: 4,
        retryDelay: 0,
      })
      expect((await sdk.getQuota()).success).toBe(true)
      let failure: unknown
      try {
        await sdk.getQuota()
      } catch (error) {
        failure = error
      }
      expectWrappedAuthenticationFailure(failure)
      expect(providerCalls).toBe(2)
      expect(requests).toHaveLength(1)
      expect(requests[0]?.authorization).toBe('Bearer synthetic-rotated-token')
    })
  })

  it('keeps the token-free public PURL client usable', async () => {
    await withLocalApi(async (baseUrl, requests) => {
      const client = new SocketPurlClient({ baseUrl, retries: 0 })
      expect((await client.getPurl(PURL)).data).toEqual([ARTIFACT])
      expect(
        (
          await client.batchPackageFetch({
            components: [{ purl: PURL }],
          })
        ).data,
      ).toEqual([ARTIFACT])
      const results = []
      for await (const result of client.batchPackageStream({
        components: [{ purl: PURL }],
      })) {
        results.push(result)
      }
      expect(results).toHaveLength(1)
      expect(results[0]?.data).toEqual(ARTIFACT)
      expect(requests).toHaveLength(3)
      expect(requests.map(request => request.authorization)).toEqual([
        undefined,
        undefined,
        undefined,
      ])
    })
  })

  it.each(['basic', 'bearer'] as const)(
    'preserves authenticated batch content with explicit %s credentials',
    async authScheme => {
      await withLocalApi(async (baseUrl, requests) => {
        const sdk = new SocketSdk('synthetic-current-token', {
          authScheme,
          baseUrl,
          retries: 0,
        })
        const result = await sdk.batchPackageFetch({
          components: [{ purl: PURL }],
        })
        expect(result).toMatchObject({ success: true, data: [ARTIFACT] })
        expect(requests).toHaveLength(1)
        expect(requests[0]?.authorization).toBe(
          authScheme === 'basic'
            ? `Basic ${Buffer.from('synthetic-current-token:').toString('base64')}`
            : 'Bearer synthetic-current-token',
        )
      })
    },
  )
})
