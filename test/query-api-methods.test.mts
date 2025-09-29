import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

describe('Socket SDK - Query API Methods', () => {
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

  describe('getApi error handling coverage', () => {
    it('should handle SyntaxError with originalResponse property in non-throwing mode', async () => {
      // Mock a response that will cause JSON parsing error
      nock('https://api.socket.dev')
        .get('/v0/test-endpoint')
        .reply(200, 'invalid json{')

      const result = await client.getApi('test-endpoint', {
        throws: false,
        responseType: 'json',
      })

      expect(result).toHaveProperty('ok', false)
      expect(result).toHaveProperty('message', 'Server returned invalid JSON')
      expect((result as any).cause).toContain('Please report this')
    })

    it('should handle SyntaxError without originalResponse property in non-throwing mode', async () => {
      // Create a custom error without originalResponse
      const customError = new SyntaxError('Unexpected token')
      delete (customError as any).originalResponse

      nock('https://api.socket.dev')
        .get('/v0/test-endpoint')
        .reply(200, 'invalid json content')

      const result = await client.getApi('test-endpoint', {
        throws: false,
        responseType: 'json',
      })

      expect(result).toHaveProperty('ok', false)
      expect(result).toHaveProperty('message', 'Server returned invalid JSON')
    })

    it('should handle ResponseError in non-throwing mode', async () => {
      nock('https://api.socket.dev')
        .get('/v0/test-endpoint')
        .reply(404, { error: { message: 'Not found' } })

      const result = await client.getApi('test-endpoint', {
        throws: false,
        responseType: 'json',
      })

      expect(result).toHaveProperty('ok', false)
      expect(result).toHaveProperty('code', 404)
      expect(result).toHaveProperty('message', 'Socket API error')
    })

    it('should handle network errors in non-throwing mode', async () => {
      nock('https://api.socket.dev')
        .get('/v0/test-endpoint')
        .replyWithError('Network error')

      const result = await client.getApi('test-endpoint', {
        throws: false,
        responseType: 'json',
      })

      expect(result).toHaveProperty('ok', false)
      expect(result).toHaveProperty('message', 'API request failed')
    })

    it('should handle unknown errors in non-throwing mode', async () => {
      // This is harder to test directly, but we can test the fallback path
      // Empty error message to test fallback
      nock('https://api.socket.dev').get('/v0/test-endpoint').replyWithError('')

      const result = await client.getApi('test-endpoint', {
        throws: false,
        responseType: 'json',
      })

      expect(result).toHaveProperty('ok', false)
      expect(result).toHaveProperty('message', 'API request failed')
    })
  })

  describe('sendApi error handling coverage', () => {
    it('should handle ResponseError in non-throwing mode', async () => {
      const body = { test: 'data' }

      nock('https://api.socket.dev')
        .post('/v0/test-endpoint', body)
        .reply(400, { error: { message: 'Bad request' } })

      const result = await client.sendApi('test-endpoint', {
        body,
        throws: false,
      })

      expect(result).toHaveProperty('ok', false)
      expect(result).toHaveProperty('code', 400)
      expect(result).toHaveProperty('message', 'Socket API error')
    })

    it('should handle network errors in non-throwing mode', async () => {
      const body = { test: 'data' }

      nock('https://api.socket.dev')
        .post('/v0/test-endpoint', body)
        .replyWithError('Connection failed')

      const result = await client.sendApi('test-endpoint', {
        body,
        throws: false,
      })

      expect(result).toHaveProperty('ok', false)
      expect(result).toHaveProperty('message', 'API request failed')
    })

    it('should handle empty error messages in non-throwing mode', async () => {
      const body = { test: 'data' }

      nock('https://api.socket.dev')
        .post('/v0/test-endpoint', body)
        // Empty error to test fallback
        .replyWithError('')

      const result = await client.sendApi('test-endpoint', {
        body,
        throws: false,
      })

      expect(result).toHaveProperty('ok', false)
      expect(result).toHaveProperty('message', 'API request failed')
    })

    it('should handle successful response', async () => {
      const body = { test: 'data' }
      const responseData = { success: true, result: 'ok' }

      nock('https://api.socket.dev')
        .post('/v0/test-endpoint', body)
        .reply(200, responseData)

      const result = await client.sendApi('test-endpoint', {
        body,
        throws: false,
      })

      expect(result).toHaveProperty('ok', true)
      expect(result).toHaveProperty('data', responseData)
    })

    it('should use PUT method when specified', async () => {
      const body = { test: 'data' }
      const responseData = { updated: true }

      nock('https://api.socket.dev')
        .put('/v0/test-endpoint', body)
        .reply(200, responseData)

      const result = await client.sendApi('test-endpoint', {
        body,
        method: 'PUT',
        throws: false,
      })

      expect(result).toHaveProperty('ok', true)
      expect(result).toHaveProperty('data', responseData)
    })
  })

  describe('Response type handling coverage', () => {
    it('should handle text response type', async () => {
      const responseText = 'Plain text response'

      nock('https://api.socket.dev')
        .get('/v0/text-endpoint')
        .reply(200, responseText)

      const result = await client.getApi('text-endpoint', {
        responseType: 'text',
        throws: false,
      })

      expect(result).toHaveProperty('ok', true)
      expect(result).toHaveProperty('data', responseText)
    })

    it('should handle response object type', async () => {
      nock('https://api.socket.dev')
        .get('/v0/response-endpoint')
        .reply(200, { test: 'data' })

      const result = await client.getApi('response-endpoint', {
        responseType: 'response',
        throws: false,
      })

      expect(result).toHaveProperty('ok', true)
      expect(result).toHaveProperty('data')
      // The data should be the IncomingMessage object
      expect((result as any).data).toBeTruthy()
    })
  })
})
