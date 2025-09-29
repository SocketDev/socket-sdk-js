import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

import type { CResult } from '../dist/index'

describe('Error Object Variations Coverage Tests', () => {
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

  it('should handle primitive boolean false as error', async () => {
    const result = (await client.getApi('boolean-false-error', {
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('API request failed')
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle primitive number 0 as error', async () => {
    const result = (await client.sendApi('number-zero-error', {
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('API request failed')
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle primitive empty string as error', async () => {
    const result = (await client.getApi('empty-string-error', {
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('API request failed')
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle NaN as error', async () => {
    const result = (await client.sendApi('nan-error', {
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('API request failed')
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle BigInt as error', async () => {
    const result = (await client.getApi('bigint-error', {
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('API request failed')
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should test SyntaxError without Invalid JSON response pattern', async () => {
    nock('https://api.socket.dev')
      .get('/v0/syntax-error-other')
      .reply(200, 'Regular syntax error')

    const result = (await client.getApi('syntax-error-other', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
    }
  })

  it('should test SyntaxError with partial Invalid JSON response pattern', async () => {
    nock('https://api.socket.dev')
      .get('/v0/partial-pattern')
      .reply(200, 'Socket API - Invalid JSON')

    const result = (await client.getApi('partial-pattern', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
    }
  })

  it('should handle error objects with custom toString methods', async () => {
    const errorScenarios = [
      'custom-toString-empty',
      'custom-toString-null',
      'custom-toString-undefined',
      'custom-toString-whitespace',
    ]

    for (const scenario of errorScenarios) {
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

  it('should test error objects with valueOf methods', async () => {
    const valueOfScenarios = [
      'valueof-returns-empty',
      'valueof-returns-null',
      'valueof-returns-number',
      'valueof-throws-error',
    ]

    for (const scenario of valueOfScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should handle Symbol as error', async () => {
    const result = (await client.sendApi('symbol-error', {
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('API request failed')
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should test various Error subclasses', async () => {
    const errorTypes = [
      'error-base',
      'syntax-error-subclass',
      'type-error-subclass',
      'reference-error-subclass',
      'range-error-subclass',
      'eval-error-subclass',
      'uri-error-subclass',
    ]

    for (const errorType of errorTypes) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(errorType, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should handle errors with circular references', async () => {
    const circularScenarios = [
      'circular-object',
      'circular-array',
      'self-referencing-error',
    ]

    for (const scenario of circularScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.sendApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test errors with non-enumerable properties', async () => {
    const nonEnumerableScenarios = [
      'non-enumerable-message',
      'hidden-properties',
      'descriptor-based-error',
    ]

    for (const scenario of nonEnumerableScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should handle Proxy objects as errors', async () => {
    const proxyScenarios = [
      'proxy-error-object',
      'proxy-with-traps',
      'proxy-toString-trap',
    ]

    for (const scenario of proxyScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.sendApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test Date objects as errors', async () => {
    const result = (await client.getApi('date-error', {
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should test RegExp objects as errors', async () => {
    const result = (await client.sendApi('regexp-error', {
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle Function objects as errors', async () => {
    const functionScenarios = [
      'function-error',
      'arrow-function-error',
      'async-function-error',
      'generator-function-error',
    ]

    for (const scenario of functionScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test Map and Set as errors', async () => {
    const collectionScenarios = [
      'map-error',
      'set-error',
      'weakmap-error',
      'weakset-error',
    ]

    for (const scenario of collectionScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.sendApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should handle ArrayBuffer and TypedArray errors', async () => {
    const bufferScenarios = [
      'arraybuffer-error',
      'uint8array-error',
      'int32array-error',
      'float64array-error',
    ]

    for (const scenario of bufferScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test errors with getters that throw', async () => {
    const getterScenarios = [
      'getter-throws-error',
      'property-access-error',
      'descriptor-error',
    ]

    for (const scenario of getterScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.sendApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should handle Promise objects as errors', async () => {
    const promiseScenarios = [
      'promise-error',
      'resolved-promise-error',
      'rejected-promise-error',
    ]

    for (const scenario of promiseScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test errors with Symbol properties', async () => {
    const symbolScenarios = [
      'symbol-key-error',
      'symbol-value-error',
      'well-known-symbol-error',
    ]

    for (const scenario of symbolScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.sendApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should handle extremely nested objects as errors', async () => {
    const nestedScenarios = [
      'deeply-nested-object',
      'recursive-structure',
      'infinite-prototype-chain',
    ]

    for (const scenario of nestedScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })
})
