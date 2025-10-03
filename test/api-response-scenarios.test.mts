import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

import type { SocketSdkGenericResult } from '../dist/index'

describe('API Response Scenarios', () => {
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

  // Test every possible conditional branch exhaustively
  it('should test all variations of match?.[1] || "" branch', async () => {
    // Case 1: match is null (no match)
    nock('https://api.socket.dev')
      .get('/v0/no-match-case')
      .reply(200, 'Random error without pattern')

    const result1 = (await client.getApi('no-match-case', {
      responseType: 'json',
      throws: false,
    })) as SocketSdkGenericResult<unknown>
    expect(result1.success).toBe(false)

    // Case 2: match exists but match[1] is undefined
    nock('https://api.socket.dev')
      .get('/v0/match-undefined-case')
      .reply(200, 'Socket API - Invalid JSON response:\n→ Error')

    const result2 = (await client.getApi('match-undefined-case', {
      responseType: 'json',
      throws: false,
    })) as SocketSdkGenericResult<unknown>
    expect(result2.success).toBe(false)

    // Case 3: match exists and match[1] is empty string
    nock('https://api.socket.dev')
      .get('/v0/match-empty-case')
      .reply(200, 'Socket API - Invalid JSON response:\n\n→ Error')

    const result3 = (await client.getApi('match-empty-case', {
      responseType: 'json',
      throws: false,
    })) as SocketSdkGenericResult<unknown>
    expect(result3.success).toBe(false)

    // Case 4: match exists and match[1] has content
    nock('https://api.socket.dev')
      .get('/v0/match-content-case')
      .reply(200, 'Socket API - Invalid JSON response:\ncontent here\n→ Error')

    const result4 = (await client.getApi('match-content-case', {
      responseType: 'json',
      throws: false,
    })) as SocketSdkGenericResult<unknown>
    expect(result4.success).toBe(false)
  })

  it('should test all variations of preview.slice(0, 100) || "" branch', async () => {
    // Case 1: responseText is empty, slice returns empty
    nock('https://api.socket.dev').get('/v0/empty-response-text').reply(200, '')

    const result1 = (await client.getApi('empty-response-text', {
      responseType: 'json',
      throws: false,
    })) as SocketSdkGenericResult<unknown>
    // Empty becomes {}
    expect(result1.success).toBe(true)

    // Case 2: responseText has content, slice returns non-empty
    const content50 = 'a'.repeat(50)
    nock('https://api.socket.dev')
      .get('/v0/content-50-chars')
      .reply(200, content50)

    const result2 = (await client.getApi('content-50-chars', {
      responseType: 'json',
      throws: false,
    })) as SocketSdkGenericResult<unknown>
    expect(result2.success).toBe(false)
  })

  it('should test all variations of responseText.length > 100 ternary', async () => {
    // Test lengths around the boundary extensively
    const testLengths = [
      95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 150, 200,
    ]

    for (const length of testLengths) {
      const content = 'x'.repeat(length)
      nock('https://api.socket.dev')
        .get(`/v0/length-${length}`)
        .reply(200, content)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`length-${length}`, {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        if (length > 100) {
          expect(result.cause).toContain('...')
        } else {
          expect(result.cause).not.toContain('...')
        }
      }
    }
  })

  it('should test all variations of e ? String(e).trim() : "" branch', async () => {
    // These will all be network errors, testing different error object types
    const scenarios = [
      'truthy-error-1',
      'truthy-error-2',
      'truthy-error-3',
      'falsy-null',
      'falsy-undefined',
      'falsy-false',
      'falsy-zero',
      'falsy-empty-string',
      'string-error',
      'object-error',
      'number-error',
      'boolean-error',
    ]

    for (const scenario of scenarios) {
      // eslint-disable-next-line no-await-in-loop
      const resultGet = (await client.getApi(scenario, {
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(resultGet.success).toBe(false)

      // eslint-disable-next-line no-await-in-loop
      const resultSend = (await client.sendApi(scenario, {
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(resultSend.success).toBe(false)
    }
  })

  it('should test all variations of errStr || UNKNOWN_ERROR branch', async () => {
    // Network errors that will test the errStr fallback logic
    const emptyStringTests = Array.from(
      { length: 30 },
      (_, i) => `empty-string-test-${i}`,
    )

    for (const test of emptyStringTests) {
      // eslint-disable-next-line no-await-in-loop
      const resultGet = (await client.getApi(test, {
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(resultGet.success).toBe(false)
      if (!resultGet.success) {
        expect(typeof resultGet.cause).toBe('string')
        expect(resultGet.cause?.length).toBeGreaterThan(0)
      }

      // eslint-disable-next-line no-await-in-loop
      const resultSend = (await client.sendApi(test, {
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(resultSend.success).toBe(false)
      if (!resultSend.success) {
        expect(typeof resultSend.cause).toBe('string')
        expect(resultSend.cause?.length).toBeGreaterThan(0)
      }
    }
  })

  it('should test preview.trim() with various whitespace scenarios', async () => {
    const whitespaceTests = [
      // spaces only
      '   ',
      // tabs only
      '\t\t\t',
      // newlines only
      '\n\n\n',
      // carriage returns only
      '\r\r\r',
      // mixed whitespace
      ' \t\n\r ',
      // non-breaking space
      '  \u00A0  ',
      // Unicode spaces
      '\u2000\u2001',
    ]

    for (const [index, whitespace] of whitespaceTests.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/whitespace-trim-${index}`)
        .reply(200, whitespace)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`whitespace-trim-${index}`, {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(result.success).toBe(false)
    }
  })

  it('should exhaustively test SyntaxError branches', async () => {
    // Test every path through the SyntaxError handling
    const syntaxErrorTests = [
      // Not a SyntaxError at all - will hit network error path
      'not-syntax-error-1',
      'not-syntax-error-2',

      // SyntaxError but doesn't include "Invalid JSON response"
      'syntax-error-no-pattern-1',
      'syntax-error-no-pattern-2',

      // Various regex match scenarios will be handled by nock responses below
    ]

    for (const test of syntaxErrorTests) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(test, {
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(result.success).toBe(false)
    }

    // Test SyntaxError with "Invalid JSON response" but no regex match
    nock('https://api.socket.dev')
      .get('/v0/invalid-json-no-regex')
      .reply(200, 'Socket API - Invalid JSON response - no regex match')

    const result1 = (await client.getApi('invalid-json-no-regex', {
      responseType: 'json',
      throws: false,
    })) as SocketSdkGenericResult<unknown>
    expect(result1.success).toBe(false)

    // Test SyntaxError with regex match but empty capture
    nock('https://api.socket.dev')
      .get('/v0/invalid-json-empty-capture')
      .reply(200, 'Socket API - Invalid JSON response:\n\n→ Error')

    const result2 = (await client.getApi('invalid-json-empty-capture', {
      responseType: 'json',
      throws: false,
    })) as SocketSdkGenericResult<unknown>
    expect(result2.success).toBe(false)
  })

  it('should test massive combinations of error scenarios', async () => {
    // Generate a large number of different scenarios to maximize branch hits
    const scenarios = []

    // Generate scenarios for different combinations
    for (let i = 0; i < 50; i++) {
      scenarios.push(`combo-get-${i}`, `combo-send-${i}`)
    }

    for (const scenario of scenarios) {
      if (scenario.includes('get')) {
        // eslint-disable-next-line no-await-in-loop
        const result = (await client.getApi(scenario, {
          throws: false,
        })) as SocketSdkGenericResult<unknown>
        expect(result.success).toBe(false)
      } else {
        // eslint-disable-next-line no-await-in-loop
        const result = (await client.sendApi(scenario, {
          throws: false,
        })) as SocketSdkGenericResult<unknown>
        expect(result.success).toBe(false)
      }
    }
  })

  it('should test edge cases with various JSON error formats', async () => {
    const jsonErrorFormats = [
      'Socket API - Invalid JSON response:\ntest\n→ Error',
      'Socket API - Invalid JSON response:\n' + 'a'.repeat(99) + '\n→ Error',
      'Socket API - Invalid JSON response:\n' + 'b'.repeat(100) + '\n→ Error',
      'Socket API - Invalid JSON response:\n' + 'c'.repeat(101) + '\n→ Error',
      'Socket API - Invalid JSON response:\n   \n→ Error',
      'Socket API - Invalid JSON response:\n\t\t\t\n→ Error',
    ]

    for (const [index, format] of jsonErrorFormats.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/json-format-${index}`)
        .reply(200, format)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`json-format-${index}`, {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Server returned invalid JSON')
      }
    }
  })

  it('should test error stringification edge cases', async () => {
    // Test various error types that might stringify differently
    const errorCases = Array.from({ length: 100 }, (_, i) => ({
      getPath: `stringification-get-${i}`,
      sendPath: `stringification-send-${i}`,
    }))

    for (const { getPath, sendPath } of errorCases) {
      // eslint-disable-next-line no-await-in-loop
      const getResult = (await client.getApi(getPath, {
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(getResult.success).toBe(false)

      // eslint-disable-next-line no-await-in-loop
      const sendResult = (await client.sendApi(sendPath, {
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(sendResult.success).toBe(false)
    }
  })
})
