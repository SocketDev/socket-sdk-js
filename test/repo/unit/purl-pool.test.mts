/**
 * @file Concurrent PURL cancellation and bounded request scheduling contracts.
 */

import { describe, expect, it } from 'vitest'

import { SocketPurlClient } from '../../../src/public-purl-client.mts'
import { SocketSdk } from '../../../src/socket-sdk-class.mts'
import { promiseWithResolvers } from '../../../src/utils.mts'
import { mergeAsyncGenerators } from '../../../src/utils/async-generators.mts'
import { createPublicApiServer } from '../../utils/public-api-server.mts'

describe('PURL batch pool', () => {
  it.each(['public', 'v0', 'organization'] as const)(
    'closes %s requests before awaiting a pending iterator read',
    async target => {
      const opened = promiseWithResolvers<void>()
      const closed = promiseWithResolvers<void>()
      const server = await createPublicApiServer((request, response) => {
        request.resume()
        response.flushHeaders()
        response.on('close', () => closed.resolve())
        opened.resolve()
      })
      try {
        const payload = { components: [{ purl: 'pkg:npm/example-package' }] }
        const sdk = new SocketSdk('test-api-token', {
          baseUrl: server.baseUrl,
          retries: 0,
        })
        const publicClient = new SocketPurlClient({
          baseUrl: server.baseUrl,
          retries: 0,
        })
        const iterators = {
          public: () => publicClient.batchPackageStream(payload),
          v0: () => sdk.batchPackageStream(payload),
          organization: () => sdk.batchOrgPackageStream('example-org', payload),
        }
        const iterator = iterators[target]()
        const pending = iterator.next()
        const rejected = expect(pending).rejects.toThrow()
        await opened.promise
        await iterator.return(undefined)
        await rejected
        await closed.promise
      } finally {
        await server.close()
      }
    },
  )

  it('rejects an already aborted caller signal before starting a request', async () => {
    const controller = new AbortController()
    controller.abort()
    const client = new SocketPurlClient({
      baseUrl: 'http://127.0.0.1:1/',
      retries: 0,
    })
    await expect(
      client
        .batchPackageStream(
          { components: [{ purl: 'pkg:npm/example-package' }] },
          { signal: controller.signal },
        )
        .next(),
    ).rejects.toThrow()
  })

  it('cancels pending requests and leaves queued batches unopened on consumer return', async () => {
    const secondOpened = promiseWithResolvers<void>()
    const closed = promiseWithResolvers<void>()
    let requests = 0
    let closes = 0
    const server = await createPublicApiServer((request, response) => {
      request.resume()
      requests += 1
      response.on('close', () => {
        closes += 1
        if (closes === 2) {
          closed.resolve()
        }
      })
      if (requests === 1) {
        response.write(
          `${JSON.stringify({ type: 'npm', name: 'example-first' })}\n`,
        )
      } else {
        secondOpened.resolve()
      }
    })
    try {
      const client = new SocketPurlClient({
        baseUrl: server.baseUrl,
        retries: 0,
      })
      const iterator = client.batchPackageStream(
        {
          components: [
            { purl: 'pkg:npm/example-first' },
            { purl: 'pkg:npm/example-second' },
            { purl: 'pkg:npm/example-queued' },
          ],
        },
        { chunkSize: 1, concurrencyLimit: 2 },
      )
      expect((await iterator.next()).value).toMatchObject({ success: true })
      await secondOpened.promise
      await iterator.return(undefined)
      await closed.promise
      expect(requests).toBe(2)
    } finally {
      await server.close()
    }
  })

  it('honors a caller abort and does not start more queued requests', async () => {
    const opened = promiseWithResolvers<void>()
    let requests = 0
    const server = await createPublicApiServer((request, response) => {
      requests += 1
      request.resume()
      response.flushHeaders()
      opened.resolve()
    })
    try {
      const controller = new AbortController()
      const client = new SocketPurlClient({
        baseUrl: server.baseUrl,
        retries: 0,
      })
      const iterator = client.batchPackageStream(
        {
          components: [
            { purl: 'pkg:npm/example-first' },
            { purl: 'pkg:npm/example-queued' },
          ],
        },
        { signal: controller.signal, chunkSize: 1, concurrencyLimit: 1 },
      )
      const first = iterator.next()
      await opened.promise
      controller.abort()
      await expect(first).rejects.toThrow()
      expect((await iterator.next()).done).toBe(true)
      expect(requests).toBe(1)
    } finally {
      await server.close()
    }
  })

  it('propagates a generator failure and closes another suspended generator', async () => {
    const failure = new Error('example failure')
    const suspended = promiseWithResolvers<void>()
    let cleaned = false
    async function* waiting(): AsyncGenerator<string> {
      try {
        await suspended.promise
        yield 'example item'
      } finally {
        cleaned = true
      }
    }
    async function* failing(): AsyncGenerator<string> {
      yield await Promise.reject(failure)
    }
    const iterator = mergeAsyncGenerators([waiting, failing], 2, () =>
      suspended.resolve(),
    )
    await expect(iterator.next()).rejects.toBe(failure)
    expect(cleaned).toBe(true)
  })
})
