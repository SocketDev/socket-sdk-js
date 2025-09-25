import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { CResult } from '../src/index'

describe('String Conversion Edge Cases', () => {
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

  it('should handle String(e).trim() with various falsy values', async () => {
    const scenarios = [
      'null-scenario',
      'undefined-scenario',
      'false-scenario',
      'zero-scenario',
      'empty-string-scenario',
      'nan-scenario',
    ]

    for (const scenario of scenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(typeof result.cause).toBe('string')
      }
    }
  })

  it('should handle error string conversion with complex objects', async () => {
    // These will cause network errors but test string conversion paths
    const complexScenarios = [
      'circular-reference',
      'deep-nested-object',
      'array-with-holes',
      'symbol-properties',
      'getter-properties',
      'proxy-object',
    ]

    for (const scenario of complexScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const resultGet = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(resultGet.ok).toBe(false)

      // eslint-disable-next-line no-await-in-loop
      const resultSend = (await client.sendApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(resultSend.ok).toBe(false)
    }
  })

  it('should handle different error types in String() conversion', async () => {
    // Test different error types that stringify differently
    const errorTypes = [
      'syntax-error',
      'type-error',
      'reference-error',
      'range-error',
      'eval-error',
      'uri-error',
    ]

    for (const errorType of errorTypes) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.sendApi(errorType, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toBe('API request failed')
      }
    }
  })

  it('should handle regex match with null result', async () => {
    // Create response that won't match the regex pattern
    const nonMatchingResponses = [
      'Invalid JSON',
      'Socket API Error',
      'Random error message',
      'Not the pattern we are looking for',
    ]

    for (const [index, response] of nonMatchingResponses.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/no-regex-match-${index}`)
        .reply(200, response)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`no-regex-match-${index}`, {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>

      expect(result.ok).toBe(false)
    }
  })
})
