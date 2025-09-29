import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { CResult } from '../src/index'

describe('Unicode Character Handling', () => {
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

  it('should handle special Unicode characters in responses', async () => {
    const specialCharTests = [
      'Error: \u0000 null character',
      'Error: \u001F control character',
      'Error: \uFFFD replacement character',
      'Error: \u200B zero-width space',
      'Error: \uD83D\uDE00 emoji',
      // pile of poo emoji
      'Error: \u{1F4A9}',
      'Error: \n\r\t mixed whitespace',
    ]

    for (const [index, testCase] of specialCharTests.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/special-char-${index}`)
        .reply(200, testCase)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`special-char-${index}`, {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>

      expect(result.ok).toBe(false)
    }
  })

  it('should handle Unicode whitespace characters in trimming', async () => {
    const unicodeWhitespace = [
      // Standard whitespace
      '\u0009\u000A\u000B\u000C\u000D\u0020',
      // Non-breaking spaces
      '\u00A0\u1680\u2000\u2001\u2002\u2003',
      // Em spaces, en spaces, etc.
      '\u2004\u2005\u2006\u2007\u2008\u2009',
      // More Unicode spaces
      '\u200A\u2028\u2029\u202F\u205F\u3000',
      // Byte order mark
      '\uFEFF',
    ]

    for (const [index, whitespace] of unicodeWhitespace.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/unicode-whitespace-${index}`)
        .reply(400, whitespace)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`unicode-whitespace-${index}`, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })
})
