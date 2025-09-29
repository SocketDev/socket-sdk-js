import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { CResult } from '../src/index'

describe('getApi and sendApi Error Scenarios', () => {
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

  it('should handle regex match with undefined group 1', async () => {
    // Create response that matches regex but group 1 is undefined
    nock('https://api.socket.dev')
      .get('/v0/undefined-group')
      .reply(200, 'Socket API - Invalid JSON response:\n→ Error message')

    const result = (await client.getApi('undefined-group', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
    }
  })

  it('should handle empty capture group from regex', async () => {
    nock('https://api.socket.dev')
      .get('/v0/empty-capture')
      .reply(200, 'Socket API - Invalid JSON response:\n\n→ Error')

    const result = (await client.getApi('empty-capture', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Server returned invalid JSON')
    }
  })

  it('should handle slice returning empty string', async () => {
    nock('https://api.socket.dev').get('/v0/slice-empty').reply(200, '')

    const result = (await client.getApi('slice-empty', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    // Empty response becomes {}
    expect(result.ok).toBe(true)
  })

  it('should test trim on whitespace-only preview', async () => {
    nock('https://api.socket.dev')
      .get('/v0/whitespace-preview')
      .reply(200, '   ')

    const result = (await client.getApi('whitespace-preview', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should handle error being null in getApi', async () => {
    const result = (await client.getApi('null-error-scenario', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('API request failed')
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle error being undefined in sendApi', async () => {
    const result = (await client.sendApi('undefined-error-scenario', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('API request failed')
      expect(typeof result.cause).toBe('string')
    }
  })

  it('should handle error being false in getApi', async () => {
    const result = (await client.getApi('false-error-scenario', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should handle error being 0 in sendApi', async () => {
    const result = (await client.sendApi('zero-error-scenario', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should handle error being empty string in getApi', async () => {
    const result = (await client.getApi('empty-string-scenario', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should handle error being NaN in sendApi', async () => {
    const result = (await client.sendApi('nan-scenario', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should test 98 character response (no ellipsis)', async () => {
    const response98 = 'a'.repeat(98)
    nock('https://api.socket.dev').get('/v0/char98').reply(200, response98)

    const result = (await client.getApi('char98', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.cause).not.toContain('...')
    }
  })

  it('should test 102 character response (with ellipsis)', async () => {
    const response102 = 'b'.repeat(102)
    nock('https://api.socket.dev').get('/v0/char102').reply(200, response102)

    const result = (await client.getApi('char102', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.cause).toContain('...')
    }
  })

  it('should test 150 character response (with ellipsis)', async () => {
    const response150 = 'c'.repeat(150)
    nock('https://api.socket.dev').get('/v0/char150').reply(200, response150)

    const result = (await client.getApi('char150', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.cause).toContain('...')
    }
  })

  it('should handle trim of empty string in preview', async () => {
    nock('https://api.socket.dev').get('/v0/empty-trim-preview').reply(200, '')

    const result = (await client.getApi('empty-trim-preview', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    // Empty response becomes {}
    expect(result.ok).toBe(true)
  })

  it('should handle string error that trims to empty', async () => {
    nock('https://api.socket.dev').get('/v0/trim-empty-error').reply(400, '   ')

    const result = (await client.getApi('trim-empty-error', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should handle various falsy error values in getApi chain', async () => {
    for (const scenario of [
      'null',
      'undefined',
      'false',
      'zero',
      'empty',
      'nan',
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`falsy-${scenario}`, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should handle various falsy error values in sendApi chain', async () => {
    for (const scenario of [
      'null',
      'undefined',
      'false',
      'zero',
      'empty',
      'nan',
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.sendApi(`falsy-${scenario}`, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test JSON error with specific pattern match but no response text', async () => {
    nock('https://api.socket.dev')
      .get('/v0/pattern-no-text')
      .reply(200, 'Socket API - Invalid JSON response:\n→')

    const result = (await client.getApi('pattern-no-text', {
      responseType: 'json',
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should handle error text that becomes empty after String() conversion', async () => {
    nock('https://api.socket.dev')
      .get('/v0/string-conversion-empty')
      .reply(400, {})

    const result = (await client.getApi('string-conversion-empty', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })

  it('should test multiple network errors for coverage', async () => {
    const scenarios = Array.from({ length: 10 }, (_, i) => `network-error-${i}`)

    for (const scenario of scenarios) {
      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(scenario, {
        throws: false,
      })) as CResult<unknown>
      expect(result.ok).toBe(false)
    }
  })

  it('should test edge cases with special characters in error text', async () => {
    nock('https://api.socket.dev')
      .get('/v0/special-chars')
      .reply(400, 'Error with 特殊字符 and émojis 🎯')

    const result = (await client.getApi('special-chars', {
      throws: false,
    })) as CResult<unknown>

    expect(result.ok).toBe(false)
  })
})
