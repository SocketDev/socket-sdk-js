/**
 * @file Polling wrappers release their iterator and deadline once.
 */

import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'

import { iterateFullScanV1Records } from '../../../../src/full-scan-results-v1.mts'
import { releasePollAfterRecords } from '../../../../src/utils/poll-deadline.mts'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'

describe('unstarted full-scan iterator cleanup', () => {
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
})
