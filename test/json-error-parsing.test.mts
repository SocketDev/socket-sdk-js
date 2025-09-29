import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

import type { CResult } from '../dist/index'

describe('JSON Parsing Error Handling', () => {
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

  it('should hit match null branch in JSON error parsing', async () => {
    // Create a response that triggers a SyntaxError but with no regex match
    nock('https://api.socket.dev')
      .get('/v0/no-regex-match')
      .reply(200, 'Socket API - Invalid JSON response:\nmalformed\njson')

    const result = (await client.getApi('no-regex-match', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should hit empty preview branch', async () => {
    // Create exactly empty string for preview
    nock('https://api.socket.dev')
      .get('/v0/empty-preview-branch')
      .reply(200, '')

    const result = (await client.getApi('empty-preview-branch', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    // Empty JSON response actually succeeds as {}
    expect(result.ok).toBe(true)
  })

  it('should hit null error branch in getApi', async () => {
    // Test with falsy error value
    const result = (await client.getApi('nonexistent', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.cause).toBeDefined()
    }
  })

  it('should hit null error branch in sendApi', async () => {
    // Test with falsy error value
    const result = (await client.sendApi('nonexistent', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.cause).toBeDefined()
    }
  })

  it('should use regex fallback for SyntaxError without originalResponse', async () => {
    // This response format triggers SyntaxError and tests the regex fallback logic
    nock('https://api.socket.dev')
      .get('/v0/test-regex-fallback')
      .reply(
        200,
        'not json but formatted as: Invalid JSON response:\ntest content\n→ error',
      )

    const result = await client.getApi('test-regex-fallback', {
      throws: false,
      responseType: 'json',
    })

    expect(result).toHaveProperty('ok', false)
    expect(result).toHaveProperty('message', 'Server returned invalid JSON')
    expect((result as any).cause).toContain('test content')
  })
})
