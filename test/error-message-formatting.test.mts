import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

import type { CResult } from '../dist/index'

describe('Error Message Formatting', () => {
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

  it('should format error messages at exactly 100 characters without truncation', async () => {
    const exactBoundary = 'x'.repeat(100)
    nock('https://api.socket.dev')
      .get('/v0/boundary-100')
      .reply(200, exactBoundary)

    const result = (await client.getApi('boundary-100', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
      expect(result.cause).not.toContain('...')
    }
  })

  it('should truncate error messages over 100 characters with ellipsis', async () => {
    const overBoundary = 'y'.repeat(101)
    nock('https://api.socket.dev')
      .get('/v0/boundary-101')
      .reply(200, overBoundary)

    const result = (await client.getApi('boundary-101', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
      expect(result.cause).toContain('...')
    }
  })

  it('should handle very long error messages with proper truncation', async () => {
    const veryLongError = 'Error: ' + 'a'.repeat(1000)
    nock('https://api.socket.dev')
      .post('/v0/very-long-error')
      .reply(400, veryLongError)

    const result = (await client.sendApi('very-long-error', {
      body: {},
      throws: false,
    })) as CResult<unknown>
    expect(result.ok).toBe(false)
  })

  it('should handle regex capture groups for error message extraction', async () => {
    // Create a response that will match the regex but capture an empty string
    nock('https://api.socket.dev')
      .get('/v0/empty-capture-group')
      .reply(200, 'Socket API - Invalid JSON response:\n\n→ SyntaxError')

    const result = (await client.getApi('empty-capture-group', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
      expect(result.cause).toContain('Please report this')
    }
  })

  it('should handle different line ending combinations in error messages', async () => {
    const lineEndings = ['\n', '\r\n', '\r']

    for (const [index, ending] of lineEndings.entries()) {
      const response = `Socket API - Invalid JSON response:${ending}test content${ending}→ Error`
      nock('https://api.socket.dev')
        .get(`/v0/line-ending-${index}`)
        .reply(200, response)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`line-ending-${index}`, {
        responseType: 'json',
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })
})
