import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

import type { CResult } from '../dist/index'

describe('Regex Pattern Matching', () => {
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

  it('should handle specific SyntaxError pattern matching', async () => {
    nock('https://api.socket.dev')
      .get('/v0/specific-error-pattern')
      .reply(200, function () {
        // Return invalid JSON that will trigger our specific error handling path
        return 'Invalid JSON response:\n\n→ Parsing error'
      })

    const result = (await client.getApi('specific-error-pattern', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
    }
  })

  it('should handle regex pattern with empty match group', async () => {
    // Create a response that matches the regex but has an empty captured group
    nock('https://api.socket.dev')
      .get('/v0/empty-match-group')
      .reply(200, 'Invalid JSON response:\n\n→')

    const result = (await client.getApi('empty-match-group', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })
})
