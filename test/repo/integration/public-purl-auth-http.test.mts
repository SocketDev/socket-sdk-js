/**
 * @file Public PURL authentication against a local Socket API HTTP double.
 */
import { createServer } from 'node:http'

import { describe, expect, it } from 'vitest'

import { SocketPurlClient } from '../../../src/public-purl-client.mts'

import type { ServerResponse } from 'node:http'
import type { PublicApiClientOptions } from '../../../src/types/purl.mts'

const PURL = 'pkg:npm/example-package@1.0.0'
const ARTIFACT = { type: 'npm', name: 'example-package', inputPurl: PURL }
const PURL_ERROR = {
  _type: 'purlError',
  value: { inputPurl: 'pkg:npm/missing', error: 'not found' },
}

type CapturedRequest = {
  authorization: string | undefined
  method: string | undefined
  path: string | undefined
  body: string
}

async function withPurlServer<T>(
  handler: (response: ServerResponse) => void,
  run: (baseUrl: string, requests: CapturedRequest[]) => Promise<T>,
): Promise<T> {
  const requests: CapturedRequest[] = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString()
      requests.push({
        authorization: request.headers.authorization,
        method: request.method,
        path: request.url,
        body,
      })
      handler(response)
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Missing server port')
  }
  try {
    return await run(`http://127.0.0.1:${address.port}/`, requests)
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

function respondWithPurlRecords(
  response: ServerResponse,
  records: Array<unknown> = [ARTIFACT],
): void {
  response.writeHead(200, { 'content-type': 'application/x-ndjson' })
  response.end(records.map(record => JSON.stringify(record)).join('\n'))
}

describe('SocketPurlClient authentication provider', () => {
  it('uses changing provider credentials for all PURL methods', async () => {
    await withPurlServer(
      response => respondWithPurlRecords(response),
      async (baseUrl, requests) => {
        let call = 0
        const options: PublicApiClientOptions = {
          baseUrl,
          retries: 0,
          authProvider: async () => {
            call += 1
            return {
              token: `provider-token-${call}`,
              authScheme: call === 2 ? 'basic' : 'bearer',
            }
          },
        }
        const client = new SocketPurlClient(options)
        expect((await client.getPurl(PURL)).success).toBe(true)
        expect(
          (await client.batchPackageFetch({ components: [{ purl: PURL }] }))
            .success,
        ).toBe(true)
        const publicStream = client.batchPackageStream(
          { components: [{ purl: PURL }, { purl: PURL }] },
          { chunkSize: 1, concurrencyLimit: 1 },
        )
        const publicResults = []
        for await (const result of publicStream) {
          publicResults.push(result)
        }
        expect(publicResults).toHaveLength(2)
        expect(
          (
            await client.batchOrgPackageFetch(
              'example-org',
              { components: [{ purl: PURL }] },
              { labels: 'production' },
            )
          ).success,
        ).toBe(true)
        const orgStream = client.batchOrgPackageStream(
          'example-org',
          { components: [{ purl: PURL }, { purl: PURL }] },
          { chunkSize: 1, concurrencyLimit: 1 },
        )
        const orgResults = []
        for await (const result of orgStream) {
          orgResults.push(result)
        }
        expect(orgResults).toHaveLength(2)
        expect(requests.map(request => request.authorization)).toEqual(
          Array.from({ length: 7 }, (_, index) =>
            index === 1
              ? `Basic ${Buffer.from(`provider-token-${index + 1}:`).toString('base64')}`
              : `Bearer provider-token-${index + 1}`,
          ),
        )
        expect(requests[4]?.path).toBe(
          '/orgs/example-org/batch?labels=production',
        )
        expect(requests[4]?.method).toBe('POST')
        expect(requests[4]?.body).toBe(
          JSON.stringify({ components: [{ purl: PURL }] }),
        )
      },
    )
  })

  it('keeps rich records and fails closed when the provider rejects', async () => {
    await withPurlServer(
      response => respondWithPurlRecords(response, [ARTIFACT, PURL_ERROR]),
      async (baseUrl, requests) => {
        const result = await new SocketPurlClient({
          baseUrl,
          retries: 3,
          retryDelay: 1,
          authProvider: async () => ({
            token: 'rotated-token',
            authScheme: 'basic',
          }),
        }).batchPackageFetch({ components: [{ purl: PURL }] })
        expect(result).toMatchObject({
          success: true,
          data: [ARTIFACT, PURL_ERROR],
        })
        expect(requests).toHaveLength(1)
        expect(requests[0]?.authorization).toBe(
          `Basic ${Buffer.from('rotated-token:').toString('base64')}`,
        )
      },
    )

    let providerCalls = 0
    await withPurlServer(
      response => respondWithPurlRecords(response),
      async (baseUrl, requests) => {
        await expect(
          new SocketPurlClient({
            baseUrl,
            retries: 3,
            retryDelay: 1,
            authProvider: async () => {
              providerCalls += 1
              throw new Error('synthetic provider rejection')
            },
          }).batchOrgPackageFetch('example-org', {
            components: [{ purl: PURL }],
          }),
        ).rejects.toThrow('Unexpected Socket API error')
        expect(requests).toHaveLength(0)
      },
    )
    expect(providerCalls).toBe(1)

    providerCalls = 0
    await withPurlServer(
      response => respondWithPurlRecords(response),
      async (baseUrl, requests) => {
        await expect(
          new SocketPurlClient({
            apiToken: 'stale-static-token',
            baseUrl,
            retries: 3,
            retryDelay: 1,
            authProvider: async () => {
              providerCalls += 1
              throw new Error('synthetic provider rejection')
            },
          }).batchOrgPackageFetch('example-org', {
            components: [{ purl: PURL }],
          }),
        ).rejects.toThrow('Unexpected Socket API error')
        expect(requests).toHaveLength(0)
      },
    )
    expect(providerCalls).toBe(1)

    for (const orgSlug of [undefined, 'example-org']) {
      let streamProviderCalls = 0
      await withPurlServer(
        response => respondWithPurlRecords(response),
        async (baseUrl, requests) => {
          const client = new SocketPurlClient({
            baseUrl,
            retries: 2,
            retryDelay: 1,
            authProvider: async () => {
              streamProviderCalls += 1
              throw new Error('synthetic stream provider rejection')
            },
          })
          const stream = orgSlug
            ? client.batchOrgPackageStream(orgSlug, {
                components: [{ purl: PURL }],
              })
            : client.batchPackageStream({
                components: [{ purl: PURL }],
              })
          const consume = async (): Promise<void> => {
            for await (const result of stream) {
              expect(result.success).toBe(false)
            }
          }
          await expect(consume()).rejects.toThrow('Unexpected Socket API error')
          expect(requests).toHaveLength(0)
          expect(streamProviderCalls).toBe(1)
        },
      )
    }
  })

  it('uses provider credentials over a valid static token', async () => {
    await withPurlServer(
      response => respondWithPurlRecords(response),
      async (baseUrl, requests) => {
        const client = new SocketPurlClient({
          apiToken: 'static-token',
          authScheme: 'basic',
          baseUrl,
          retries: 0,
          authProvider: async () => ({
            token: 'provider-token',
            authScheme: 'bearer',
          }),
        })
        expect(
          (
            await client.batchPackageFetch({
              components: [{ purl: PURL }],
            })
          ).success,
        ).toBe(true)
        expect(requests[0]?.authorization).toBe('Bearer provider-token')
        expect(requests[0]?.authorization).not.toContain('static-token')
      },
    )

    expect(
      () =>
        new SocketPurlClient({
          apiToken: '   ',
          authProvider: async () => ({
            token: 'provider-token',
            authScheme: 'bearer',
          }),
        }),
    ).toThrow(/apiToken/)

    for (const token of ['   ', 'line\nbreak']) {
      await withPurlServer(
        response => respondWithPurlRecords(response),
        async (baseUrl, requests) => {
          await expect(
            new SocketPurlClient({
              baseUrl,
              retries: 2,
              authProvider: async () => ({ token, authScheme: 'bearer' }),
            }).getPurl(PURL),
          ).rejects.toThrow('Unexpected Socket API error')
          expect(requests).toHaveLength(0)
        },
      )
    }
  })

  it('ignores inherited providers and honors request cancellation', async () => {
    let inheritedCalls = 0
    const options: PublicApiClientOptions = { retries: 0 }
    Object.setPrototypeOf(options, {
      authProvider: async () => {
        inheritedCalls += 1
        return { token: 'inherited-token', authScheme: 'bearer' }
      },
    })
    await withPurlServer(
      response => respondWithPurlRecords(response),
      async (baseUrl, requests) => {
        options.baseUrl = baseUrl
        const client = new SocketPurlClient(options)
        expect((await client.getPurl(PURL)).success).toBe(true)
        expect(requests[0]?.authorization).toBeUndefined()
        expect(() =>
          client.batchOrgPackageFetch('example-org', {
            components: [{ purl: PURL }],
          }),
        ).toThrow(/apiToken or authProvider/)
        expect(inheritedCalls).toBe(0)
        expect(requests).toHaveLength(1)
      },
    )

    const controller = new AbortController()
    await withPurlServer(
      response => respondWithPurlRecords(response),
      async (baseUrl, requests) => {
        await expect(
          new SocketPurlClient({
            baseUrl,
            retries: 2,
            signal: controller.signal,
            authProvider: async () => {
              controller.abort()
              return { token: 'cancelled-token', authScheme: 'bearer' }
            },
          }).getPurl(PURL),
        ).rejects.toThrow('Unexpected Socket API error')
        expect(requests).toHaveLength(0)
      },
    )
  })

  it('rejects malformed providers and requires credentials only for org calls', async () => {
    for (const authProvider of [null, false, 'token']) {
      const options = { authProvider }
      expect(() => Reflect.construct(SocketPurlClient, [options])).toThrow(
        'Invalid "authProvider": use a function',
      )
    }
    for (const providerResult of [
      null,
      undefined,
      { token: 'x', authScheme: 'other' },
    ]) {
      await withPurlServer(
        response => respondWithPurlRecords(response),
        async (baseUrl, requests) => {
          const client: unknown = Reflect.construct(SocketPurlClient, [
            {
              baseUrl,
              retries: 0,
              authProvider: async () => providerResult,
            },
          ])
          if (!(client instanceof SocketPurlClient)) {
            throw new TypeError('Failed to construct SocketPurlClient')
          }
          await expect(client.getPurl(PURL)).rejects.toThrow(
            'Unexpected Socket API error',
          )
          expect(requests).toHaveLength(0)
        },
      )
    }
    await withPurlServer(
      response => respondWithPurlRecords(response),
      async (baseUrl, requests) => {
        const client = new SocketPurlClient({ baseUrl, retries: 0 })
        expect((await client.getPurl(PURL)).success).toBe(true)
        expect(requests[0]?.authorization).toBeUndefined()
        expect(() =>
          client.batchOrgPackageFetch('example-org', {
            components: [{ purl: PURL }],
          }),
        ).toThrow(/apiToken or authProvider/)
        expect(() =>
          client.batchOrgPackageStream('example-org', {
            components: [{ purl: PURL }],
          }),
        ).toThrow(/apiToken or authProvider/)
        expect(requests).toHaveLength(1)
      },
    )
  })

  it('does not retry authenticated requests after HTTP authorization failures', async () => {
    for (const status of [401, 403]) {
      await withPurlServer(
        response => {
          response.writeHead(status, { 'content-type': 'application/json' })
          response.end('{"error":"denied"}')
        },
        async (baseUrl, requests) => {
          let providerCalls = 0
          const result = await new SocketPurlClient({
            baseUrl,
            retries: 2,
            retryDelay: 1,
            authProvider: async () => {
              providerCalls += 1
              return { token: 'request-token', authScheme: 'bearer' }
            },
          }).batchOrgPackageFetch('example-org', {
            components: [{ purl: PURL }],
          })
          expect(result).toMatchObject({ success: false, status })
          expect(requests).toHaveLength(1)
          expect(requests[0]?.authorization).toBe('Bearer request-token')
          expect(providerCalls).toBe(1)
        },
      )

      await withPurlServer(
        response => {
          response.writeHead(status, { 'content-type': 'application/json' })
          response.end('{"error":"denied"}')
        },
        async (baseUrl, requests) => {
          let providerCalls = 0
          const stream = new SocketPurlClient({
            baseUrl,
            retries: 2,
            retryDelay: 1,
            authProvider: async () => {
              providerCalls += 1
              return { token: 'stream-token', authScheme: 'bearer' }
            },
          }).batchOrgPackageStream('example-org', {
            components: [{ purl: PURL }],
          })
          const results = []
          for await (const result of stream) {
            results.push(result)
          }
          expect(results).toHaveLength(1)
          expect(results[0]).toMatchObject({ success: false, status })
          expect(requests).toHaveLength(1)
          expect(requests[0]?.authorization).toBe('Bearer stream-token')
          expect(providerCalls).toBe(1)
        },
      )
    }
  })
})
