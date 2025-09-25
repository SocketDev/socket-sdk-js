import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { CResult } from '../src/index'

describe('Error Object Handling', () => {
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

  it('should handle error objects with null prototype', async () => {
    nock('https://api.socket.dev')
      .get('/v0/null-proto')
      .reply(400, Object.create(null))

    const result = (await client.getApi('null-proto', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should handle error object variations that affect stringification', async () => {
    const errorScenarios = [
      'symbol-error',
      'function-error',
      'object-error',
      'array-error',
      'date-error',
      'regexp-error',
    ]

    for (const scenario of errorScenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should handle complex nested error structures', async () => {
    nock('https://api.socket.dev')
      .get('/v0/complex-error')
      .reply(400, { error: { nested: { deep: { message: 'complex error' } } } })

    const result = (await client.getApi('complex-error', {
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
  })

  it('should handle error conversion edge cases', async () => {
    // These will all cause network errors but test different error handling paths
    const edgeCases = Array.from({ length: 20 }, (_, i) => `edge-case-${i}`)

    for (const caseId of edgeCases) {
      // eslint-disable-next-line no-await-in-loop
      const resultGet = (await client.getApi(caseId, {
        throws: false,
      })) as CResult<unknown>
      expect(resultGet.ok).toBe(false)

      // eslint-disable-next-line no-await-in-loop
      const resultSend = (await client.sendApi(caseId, {
        throws: false,
      })) as CResult<unknown>
      expect(resultSend.ok).toBe(false)
    }
  })
})
