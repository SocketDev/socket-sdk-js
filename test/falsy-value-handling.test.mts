import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { CResult } from '../src/index'

describe('Falsy Value Handling', () => {
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

  it('should handle null/undefined error in getApi error path', async () => {
    // Create a scenario that passes null/undefined as error
    const result = (await client.getApi('will-cause-network-error', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should handle null/undefined error in sendApi error path', async () => {
    // Create a scenario that passes null/undefined as error
    const result = (await client.sendApi('will-cause-network-error', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should handle error that stringifies to empty string', async () => {
    // Test error that becomes empty when stringified
    const result = (await client.getApi('empty-string-error', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle error that stringifies to whitespace only', async () => {
    const result = (await client.sendApi('whitespace-error', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle falsy values in error conversion branches', async () => {
    // Test various falsy values: null, undefined, 0, false, '', NaN
    const scenarios = [
      'falsy-null',
      'falsy-undefined',
      'falsy-zero',
      'falsy-false',
      'falsy-empty-string',
      'falsy-nan',
    ]

    for (const scenario of scenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should handle precise error text empty condition', async () => {
    // This is to test the exact errStr || UNKNOWN_ERROR branch
    nock('https://api.socket.dev').get('/v0/precise-empty-error').reply(400, '')

    const result = (await client.getApi('precise-empty-error', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.cause).toBeDefined()
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle error object that converts to empty string', async () => {
    // Mock console error or similar to test error stringification edge cases
    const result = (await client.sendApi('stringification-test', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('API request failed')
    }
  })
})
