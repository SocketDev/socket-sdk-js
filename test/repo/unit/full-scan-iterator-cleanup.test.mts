/**
 * @file Full-scan iterators close response streams before their first read.
 */
import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { iterateFullScanV1Records } from '../../../src/full-scan-results-v1.mts'
import { promiseWithResolvers } from '../../../src/utils.mts'
import { createCloseableGenerator } from '../../../src/utils/closeable-generator.mts'
import { releasePollAfterRecords } from '../../../src/utils/poll-deadline.mts'
import { createPublicApiServer } from '../../utils/public-api-server.mts'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'

describe('unstarted full-scan iterator cleanup', () => {
  it.each(['return', 'throw'] as const)(
    'closes a direct unread response on %s',
    async operation => {
      const raw = new PassThrough()
      const response = { rawResponse: raw } as unknown as HttpResponse
      const iterator = iterateFullScanV1Records(response)
      if (operation === 'return') {
        expect(await iterator.return(undefined)).toMatchObject({ done: true })
      } else {
        await expect(
          iterator.throw(new Error('Consumer stopped')),
        ).rejects.toBeInstanceOf(Error)
      }
      expect(raw.destroyed).toBe(true)
    },
  )

  it.each(['return', 'throw'] as const)(
    'releases polling resources and response on %s',
    async operation => {
      const raw = new PassThrough()
      const response = { rawResponse: raw } as unknown as HttpResponse
      let released = 0
      const iterator = releasePollAfterRecords(
        iterateFullScanV1Records(response),
        () => {
          released += 1
        },
      )
      if (operation === 'return') {
        await iterator.return(undefined)
      } else {
        await expect(
          iterator.throw(new Error('Consumer stopped')),
        ).rejects.toBeInstanceOf(Error)
      }
      expect(raw.destroyed).toBe(true)
      expect(released).toBe(1)
      await iterator.return(undefined)
      expect(released).toBe(1)
    },
  )

  it.each(['getOrgFullScanV1', 'pollOrgFullScanV1'] as const)(
    '%s closes its unread HTTP response',
    async method => {
      const closed = promiseWithResolvers<void>()
      const server = await createPublicApiServer((request, response) => {
        request.resume()
        response.on('close', () => closed.resolve())
        response.writeHead(200, { 'X-Socket-Scan-Status': 'complete' })
        response.write('{"id":"example-artifact","name":"example-package"}\n')
      })
      try {
        const client = new SocketSdk('test-token', {
          retries: 0,
          apiV1BaseUrl: server.baseUrl,
        })
        const result = await client[method]('example-org', 'example-scan')
        if (!result.success || result.data.status !== 'complete') {
          throw new Error('Expected complete scan')
        }
        await result.data.records.return(undefined)
        await expect(closed.promise).resolves.toBeUndefined()
      } finally {
        await server.close()
      }
    },
  )
})

describe('closeable generator completion', () => {
  it('disposes an unread response', async () => {
    const raw = new PassThrough()
    const iterator = iterateFullScanV1Records({
      rawResponse: raw,
    } as unknown as HttpResponse)
    await iterator[Symbol.asyncDispose]()
    expect(raw.destroyed).toBe(true)
  })

  it('releases once after normal exhaustion', async () => {
    let released = 0
    async function* records() {
      yield 'example-record'
    }
    const iterator = createCloseableGenerator(records(), () => {
      released += 1
    })
    expect(await iterator.next()).toMatchObject({
      value: 'example-record',
      done: false,
    })
    expect(released).toBe(0)
    expect(await iterator.next()).toMatchObject({ done: true })
    await iterator.return(undefined)
    expect(released).toBe(1)
  })

  it('closes the response before waiting for a pending read to return', async () => {
    const raw = new PassThrough()
    const iterator = iterateFullScanV1Records({
      rawResponse: raw,
    } as unknown as HttpResponse)
    const pending = iterator.next()
    const rejected = expect(pending).rejects.toBeInstanceOf(Error)
    await iterator.return(undefined)
    await rejected
    expect(raw.destroyed).toBe(true)
  })

  it('releases when parsing fails', async () => {
    const raw = new PassThrough()
    const iterator = iterateFullScanV1Records({
      rawResponse: raw,
    } as unknown as HttpResponse)
    raw.end('{"incomplete":')
    await expect(iterator.next()).rejects.toBeInstanceOf(Error)
    expect(raw.destroyed).toBe(true)
  })
})
