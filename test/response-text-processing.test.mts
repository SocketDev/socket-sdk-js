import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

import type { SocketSdkGenericResult } from '../dist/index'

describe('Response Text Processing', () => {
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

  it('should handle empty and whitespace-only responses', async () => {
    const emptyScenarios = ['', ' ', '  ', '\t', '\n', '\r', '\r\n', '\t\n\r']

    for (const [index, scenario] of emptyScenarios.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/empty-scenario-${index}`)
        .reply(200, scenario)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`empty-scenario-${index}`, {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      if (scenario === '') {
        // Empty string becomes {}
        expect(result.success).toBe(true)
      } else {
        expect(result.success).toBe(false)
      }
    }
  })

  it('should handle whitespace trimming in error responses', async () => {
    const whitespaceVariations = [
      '   ',
      '\t\t\t',
      '\n\n\n',
      '\r\r\r',
      ' \t\n\r',
      '  \t  ',
      '\n\t\r\n',
    ]

    for (const [index, whitespace] of whitespaceVariations.entries()) {
      nock('https://api.socket.dev')
        .post(`/v0/whitespace-${index}`)
        .reply(400, whitespace)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.sendApi(`whitespace-${index}`, {
        body: {},
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(result.success).toBe(false)
    }
  })

  it('should handle Unicode and special characters in responses', async () => {
    const unicodeError = 'Error: 🚨 Unicode test with 中文 and émojis 🎯'
    nock('https://api.socket.dev')
      .get('/v0/unicode-error')
      .reply(400, unicodeError)

    const result = (await client.getApi('unicode-error', {
      throws: false,
    })) as SocketSdkGenericResult<unknown>
    expect(result.success).toBe(false)
  })

  it('should handle whitespace errors that stringify to whitespace', async () => {
    nock('https://api.socket.dev')
      .post('/v0/whitespace-error')
      .reply(400, '  \t\n  ')

    const result = (await client.sendApi('whitespace-error', {
      body: {},
      throws: false,
    })) as SocketSdkGenericResult<unknown>

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Socket API')
    }
  })

  it('should handle preview trimming boundary conditions', async () => {
    // Test exactly when preview.trim() would return empty vs non-empty
    const boundaryTests = [
      // Should not be empty after trim
      ' a',
      // Should not be empty after trim
      'a ',
      // Should not be empty after trim
      ' a ',
      // Should be empty after trim
      '   ',
    ]

    for (const [index, content] of boundaryTests.entries()) {
      nock('https://api.socket.dev')
        .get(`/v0/trim-boundary-${index}`)
        .reply(200, content)

      // eslint-disable-next-line no-await-in-loop
      const result = (await client.getApi(`trim-boundary-${index}`, {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>
      expect(result.success).toBe(false)
    }
  })
})
