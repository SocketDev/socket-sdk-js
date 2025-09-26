import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { CResult } from '../src/index'

describe('Comprehensive Network Error Scenarios', () => {
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

  it('should test massive amount of different error scenarios', async () => {
    // Generate 100 different network error scenarios
    const scenarios = Array.from(
      { length: 100 },
      (_, i) => `network-scenario-${i}`,
    )

    for (const scenario of scenarios) {
      // eslint-disable-next-line no-await-in-loop
      const resultGet = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(resultGet.ok).toBe(false)
      if (!resultGet.ok) {
        expect(resultGet.message).toBe('API request failed')
        expect(typeof resultGet.cause).toBe('string')
        expect(resultGet.cause?.length).toBeGreaterThan(0)
      }

      // eslint-disable-next-line no-await-in-loop
      const resultSend = (await client.sendApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(resultSend.ok).toBe(false)
      if (!resultSend.ok) {
        expect(resultSend.message).toBe('API request failed')
        expect(typeof resultSend.cause).toBe('string')
        expect(resultSend.cause?.length).toBeGreaterThan(0)
      }
    }
  })

  it('should test various HTTP error codes for error handling paths', async () => {
    const errorCodes = [
      400, 401, 403, 404, 405, 408, 409, 410, 422, 429, 431, 451,
    ]

    for (const code of errorCodes) {
      nock('https://api.socket.dev')
        .get(`/v0/http-error-${code}`)
        .reply(code, `Error ${code}`)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`http-error-${code}`, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe(code)
        expect(result.message).toBe('Socket API error')
      }
    }
  })

  it('should test POST/PUT error scenarios', async () => {
    const methods = ['POST', 'PUT'] as const

    for (const method of methods) {
      for (let i = 0; i < 20; i++) {
        if (method === 'POST') {
          nock('https://api.socket.dev')
            .post(`/v0/error-${method.toLowerCase()}-${i}`)
            .reply(400, `${method} Error ${i}`)
        } else {
          nock('https://api.socket.dev')
            .put(`/v0/error-${method.toLowerCase()}-${i}`)
            .reply(400, `${method} Error ${i}`)
        }

        // eslint-disable-next-line no-await-in-loop
        const result = (await client.sendApi(
          `error-${method.toLowerCase()}-${i}`,
          {
            method,
            body: {},
            throws: false,
          },
        )) as CResult<unknown>

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.message).toBe('Socket API error')
        }
      }
    }
  })

  it('should test error handling with various response body types', async () => {
    const responseTypes = [
      { data: null, name: 'null' },
      { data: undefined, name: 'undefined' },
      { data: '', name: 'empty-string' },
      { data: '   ', name: 'whitespace' },
      { data: 'plain text', name: 'text' },
      { data: '123', name: 'number-string' },
      { data: 'true', name: 'boolean-string' },
      { data: '{}', name: 'empty-json' },
      { data: '[]', name: 'empty-array' },
    ]

    for (const responseType of responseTypes) {
      nock('https://api.socket.dev')
        .get(`/v0/response-type-${responseType.name}`)
        .reply(400, responseType.data || '')

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(
        `response-type-${responseType.name}`,
        { throws: false },
      )) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test error scenarios with custom headers', async () => {
    const customClient = new SocketSdk('test-token', {
      userAgent: 'CustomAgent/1.0.0',
    })

    for (let i = 0; i < 15; i++) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await customClient.getApi(`custom-header-error-${i}`, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test timeout error scenarios', async () => {
    const timeoutClient = new SocketSdk('test-token', {
      timeout: 1000,
    })

    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await timeoutClient.getApi(`timeout-scenario-${i}`, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test different base URL error scenarios', async () => {
    const customBaseClient = new SocketSdk('test-token', {
      baseUrl: 'https://custom.example.com/api/v1/',
    })

    for (let i = 0; i < 12; i++) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await customBaseClient.getApi(`base-url-error-${i}`, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test agent configuration error scenarios', async () => {
    const agentClient = new SocketSdk('test-token', {
      agent: {
        https: undefined,
        http: undefined,
      },
    })

    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await agentClient.sendApi(`agent-error-${i}`, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test error scenarios with different response types', async () => {
    const responseTypes = ['response', 'text', 'json'] as const

    for (const responseType of responseTypes) {
      for (let i = 0; i < 10; i++) {
        // eslint-disable-next-line no-await-in-loop
        const result = (await client.getApi(
          `response-type-error-${responseType}-${i}`,
          {
            responseType,
            throws: false,
          },
        )) as CResult<unknown>
        expect(result.ok).toBe(false)
      }
    }
  })

  it('should test malformed JSON responses thoroughly', async () => {
    const malformedJsonTests = [
      '{ invalid json',
      '{ "key": invalid }',
      '{ "key": }',
      '{ "key": "value" extra }',
      '{ "unclosed": "string',
      '{ "trailing": "comma", }',
      '{ duplicate: "key", duplicate: "key2" }',
      '[1,2,3,}',
      '{"number": 123.456.789}',
      '{"string": "test\u0000null"}',
    ]

    for (const [index, json] of malformedJsonTests.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/malformed-json-${index}`)
        .reply(200, json)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`malformed-json-${index}`, {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toBe('Server returned invalid JSON')
      }
    }
  })

  it('should test extremely long URLs and error paths', async () => {
    const longPaths = Array.from(
      { length: 5 },
      (_, i) => 'very-long-path-' + 'segment-'.repeat(50) + i,
    )

    for (const longPath of longPaths) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(longPath, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test special character handling in error messages', async () => {
    const specialChars = [
      'ñáéíóú-español',
      '中文-chinese',
      '日本語-japanese',
      'العربية-arabic',
      'русский-russian',
      'ελληνικά-greek',
      '🚀🎯🔥-emojis',
      'test\u0000null\u001Fcontrol',
    ]

    for (const [index, chars] of specialChars.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/special-chars-${index}`)
        .reply(400, `Error with ${chars}`)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`special-chars-${index}`, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test error scenarios with request body variations', async () => {
    const requestBodies = [
      null,
      undefined,
      '',
      '{}',
      '[]',
      { test: 'value' },
      [1, 2, 3],
      { nested: { deep: { object: 'value' } } },
      { array: [{ nested: 'object' }] },
      new Date().toISOString(),
    ]

    for (const [index, body] of requestBodies.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.sendApi(`request-body-${index}`, {
        body,
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test concurrent error scenarios', async () => {
    // Test multiple concurrent requests that all fail
    const concurrentRequests = Array.from({ length: 20 }, (_, i) =>
      client.getApi(`concurrent-error-${i}`, { throws: false }),
    )

    const results = await Promise.all(concurrentRequests)

    for (const result of results) {
      const cResult = result as CResult<unknown>
      expect(cResult.ok).toBe(false)
      if (!cResult.ok) {
        expect(cResult.message).toBe('API request failed')
      }
    }
  })
})
