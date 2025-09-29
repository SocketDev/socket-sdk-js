import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { CResult } from '../src/index'

describe('Response Truncation Logic', () => {
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

  it('should handle exactly 100 characters without truncation', async () => {
    const testCases = [
      'a'.repeat(100),
      'b'.repeat(99) + 'x',
      '1'.repeat(100),
      ' '.repeat(99) + 'x',
      // 100 chars
      'test'.repeat(25),
    ]

    for (const [index, testCase] of testCases.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/hundred-chars-${index}`)
        .reply(200, testCase)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`hundred-chars-${index}`, {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>

      // Some cases might succeed if they're valid JSON (like empty strings)
      if (result.ok) {
        // This is fine, empty string becomes {}
        continue
      }

      if (!result.ok) {
        expect(result.cause).not.toContain('...')
        expect(result.message).toBe('Server returned invalid JSON')
      }
    }
  })

  it('should truncate responses over 100 characters with ellipsis', async () => {
    const testCases = [
      'c'.repeat(101),
      'd'.repeat(150),
      'e'.repeat(200),
      'f'.repeat(500),
      // 104 chars
      'test'.repeat(26),
    ]

    for (const [index, testCase] of testCases.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/over-hundred-${index}`)
        .reply(200, testCase)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`over-hundred-${index}`, {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.cause).toContain('...')
        expect(result.message).toBe('Server returned invalid JSON')
      }
    }
  })
})
