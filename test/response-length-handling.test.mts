import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

import type { CResult } from '../dist/index'

describe('Response Length Handling', () => {
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

  it('should handle 99 character response without truncation', async () => {
    const response99 = 'x'.repeat(99)
    nock('https://api.socket.dev').get('/v0/char-99').reply(200, response99)

    const result = (await client.getApi('char-99', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
      expect(result.cause).not.toContain('...')
    }
  })

  it('should handle exactly 100 character response without truncation', async () => {
    const response100 = 'y'.repeat(100)
    nock('https://api.socket.dev').get('/v0/char-100').reply(200, response100)

    const result = (await client.getApi('char-100', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
      expect(result.cause).not.toContain('...')
    }
  })

  it('should handle 101 character response with truncation', async () => {
    const response101 = 'z'.repeat(101)
    nock('https://api.socket.dev').get('/v0/char-101').reply(200, response101)

    const result = (await client.getApi('char-101', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
      expect(result.cause).toContain('...')
    }
  })

  it('should handle zero-length response correctly', async () => {
    nock('https://api.socket.dev').get('/v0/zero-length').reply(200, '')

    const result = (await client.getApi('zero-length', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    // Empty JSON response should succeed as {}
    expect(result.ok).toBe(true)
  })

  it('should handle preview trimming with only whitespace', async () => {
    // Test preview.trim() when preview is only whitespace
    const whitespaceResponse = '   \n\t   '
    nock('https://api.socket.dev')
      .get('/v0/whitespace-preview')
      .reply(200, whitespaceResponse)

    const result = (await client.getApi('whitespace-preview', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })
})
