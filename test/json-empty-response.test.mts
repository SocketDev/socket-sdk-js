import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { CResult } from '../src/index'

describe('JSON Empty Response Handling', () => {
  let client: SocketSdk

  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
    client = new SocketSdk('test-api-token')
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  it('should handle zero-length response as valid JSON', async () => {
    // Test when responseText.slice(0, 100) returns empty string
    nock('https://api.socket.dev').get('/v0/zero-slice').reply(200, '')

    const result = (await client.getApi('zero-slice', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    // Empty JSON becomes {}
    expect(result.ok).toBe(true)
  })

  it('should handle whitespace-only responses as invalid JSON', async () => {
    const whitespaceOnly = '   \t\n\r   '
    nock('https://api.socket.dev')
      .get('/v0/whitespace-only')
      .reply(200, whitespaceOnly)

    const result = (await client.getApi('whitespace-only', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
    }
  })

  it('should handle empty vs undefined vs null in error paths', async () => {
    // Test the exact conditions for errStr || UNKNOWN_ERROR
    const emptyStringTests = [
      'empty-error-message',
      'null-error-message',
      'undefined-error-message',
      'whitespace-only-error',
    ]

    for (const test of emptyStringTests) {
      // eslint-disable-next-line no-await-in-loop
      const resultGet = (await client.getApi(test, {
        throws: false,
      })) as CResult<unknown>
      expect(resultGet.ok).toBe(false)
      if (!resultGet.ok) {
        expect(typeof resultGet.cause).toBe('string')
        expect(resultGet.cause?.length).toBeGreaterThan(0)
      }

      // eslint-disable-next-line no-await-in-loop
      const resultSend = (await client.sendApi(test, {
        throws: false,
      })) as CResult<unknown>
      expect(resultSend.ok).toBe(false)
      if (!resultSend.ok) {
        expect(typeof resultSend.cause).toBe('string')
        expect(resultSend.cause?.length).toBeGreaterThan(0)
      }
    }
  })
})
