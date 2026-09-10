/**
 * @file Full-scan record iterators release unread and interrupted responses.
 */

import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'

import { iterateFullScanV1Records } from '../../../src/full-scan-results-v1.mts'

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
