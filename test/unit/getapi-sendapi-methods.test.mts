/**
 * @file Tests for the generic getApi method functionality.
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index.mts'
import { setupTestClient } from '../utils/environment.mts'

import type {
  CustomResponseType,
  SocketSdkGenericResult,
} from '../../src/index.mts'
import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'
import type { IncomingHttpHeaders } from 'node:http'

describe('getApi and sendApi Methods', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  describe('getApi', () => {
    it('should return HttpResponse when throws=true (default)', async () => {
      nock('https://api.socket.dev')
        .get('/v0/test-endpoint')
        .reply(200, 'success')

      const result = await getClient().getApi('test-endpoint')

      expect(result).toBeDefined()
      expect((result as HttpResponse).status).toBe(200)
    })

    it('should return SocketSdkGenericResult<HttpResponse> when throws=false', async () => {
      nock('https://api.socket.dev')
        .get('/v0/test-endpoint')
        .reply(200, 'success')

      const result = (await getClient().getApi('test-endpoint', {
        throws: false,
      })) as SocketSdkGenericResult<HttpResponse>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.status).toBe(200)
      }
    })

    it('should throw error when throws=true and request fails', async () => {
      await expect(getClient().getApi('nonexistent-endpoint')).rejects.toThrow()
    })

    it('should return error CResult when throws=false and request fails', async () => {
      const result = (await getClient().getApi('nonexistent-endpoint', {
        throws: false,
      })) as SocketSdkGenericResult<HttpResponse>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API request failed')
        expect(result.cause).toBeDefined()
      }
    })

    it('should handle baseUrl with trailing slash correctly', async () => {
      const clientWithSlash = new SocketSdk('test-token', {
        baseUrl: 'https://api.socket.dev/v0/',
      })
      nock('https://api.socket.dev')
        .get('/v0/test-endpoint')
        .reply(200, 'success')

      const result = await clientWithSlash.getApi('test-endpoint')
      expect((result as HttpResponse).status).toBe(200)
    })

    it('should handle baseUrl without trailing slash correctly', async () => {
      const clientWithoutSlash = new SocketSdk('test-token', {
        baseUrl: 'https://api.socket.dev/v0',
      })
      nock('https://api.socket.dev')
        .get('/v0/test-endpoint')
        .reply(200, 'success')

      const result = await clientWithoutSlash.getApi('test-endpoint')
      expect((result as HttpResponse).status).toBe(200)
    })
  })

  describe('getApi with responseType: text', () => {
    it('should return text when throws=true (default) and request succeeds', async () => {
      nock('https://api.socket.dev')
        .get('/v0/test-text')
        .reply(200, 'Hello, world!')

      const result = await getClient().getApi<string>('test-text', {
        responseType: 'text',
      })

      expect(result).toBe('Hello, world!')
    })

    it('should return SocketSdkGenericResult<string> when throws=false and request succeeds', async () => {
      nock('https://api.socket.dev')
        .get('/v0/test-text')
        .reply(200, 'Hello, world!')

      const result = (await getClient().getApi<string>('test-text', {
        responseType: 'text',
        throws: false,
      })) as SocketSdkGenericResult<string>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('Hello, world!')
      }
    })

    it('should throw error when throws=true and API returns error status', async () => {
      nock('https://api.socket.dev')
        .get('/v0/test-error')
        .reply(404, 'Not found')

      await expect(
        getClient().getApi<string>('test-error', { responseType: 'text' }),
      ).rejects.toThrow(/Socket API Request failed \(404\)/)
    })

    it('should return error CResult when throws=false and API returns error status', async () => {
      nock('https://api.socket.dev')
        .get('/v0/test-error')
        .reply(404, 'Not found')

      const result = (await getClient().getApi<string>('test-error', {
        responseType: 'text',
        throws: false,
      })) as SocketSdkGenericResult<string>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.error).toContain('Socket API')
        expect(result.cause).toContain('Not found')
      }
    })

    it('should handle empty response body', async () => {
      nock('https://api.socket.dev').get('/v0/empty').reply(200, '')

      const result = (await getClient().getApi<string>('empty', {
        responseType: 'text',
        throws: false,
      })) as SocketSdkGenericResult<string>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('')
      }
    })

    it('should handle network errors gracefully with throws=false', async () => {
      const result = (await getClient().getApi<string>('network-error', {
        responseType: 'text',
        throws: false,
      })) as SocketSdkGenericResult<string>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API request failed')
        expect(result.cause).toBeDefined()
      }
    })
  })

  describe('getApi with responseType: json', () => {
    it('should return parsed JSON when throws=true (default)', async () => {
      const testData = { message: 'Hello, JSON!' }
      nock('https://api.socket.dev').get('/v0/test-json').reply(200, testData)

      const result = await getClient().getApi<typeof testData>('test-json', {
        responseType: 'json',
      })

      expect(result).toEqual(testData)
    })

    it('should return SocketSdkGenericResult<T> when throws=false', async () => {
      const testData = { message: 'Hello, JSON!' }
      nock('https://api.socket.dev').get('/v0/test-json').reply(200, testData)

      const result = (await getClient().getApi<typeof testData>('test-json', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<typeof testData>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(testData)
      }
    })

    it('should handle complex JSON objects', async () => {
      const complexData = {
        users: [
          { id: 1, name: 'Alice', active: true },
          { id: 2, name: 'Bob', active: false },
        ],
        meta: { total: 2, page: 1 },
      }
      nock('https://api.socket.dev')
        .get('/v0/complex-json')
        .reply(200, complexData)

      const result = (await getClient().getApi<typeof complexData>(
        'complex-json',
        {
          responseType: 'json',
          throws: false,
        },
      )) as SocketSdkGenericResult<typeof complexData>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(complexData)
      }
    })

    it('should throw error when throws=true and JSON is invalid', async () => {
      nock('https://api.socket.dev')
        .get('/v0/invalid-json')
        .reply(200, 'invalid json content')

      await expect(
        getClient().getApi('invalid-json', { responseType: 'json' }),
      ).rejects.toThrow()
    })

    it('should return error CResult when throws=false and JSON is invalid', async () => {
      nock('https://api.socket.dev')
        .get('/v0/invalid-json')
        .reply(200, 'invalid json content')

      const result = (await getClient().getApi('invalid-json', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Server returned invalid JSON')
        expect(result.cause).toContain('invalid json content')
      }
    })

    it('should handle API error responses', async () => {
      nock('https://api.socket.dev')
        .get('/v0/api-error')
        .reply(400, { error: 'Bad Request' })

      const result = (await getClient().getApi('api-error', {
        responseType: 'json',
        throws: false,
      })) as SocketSdkGenericResult<unknown>

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.error).toContain('Socket API')
      }
    })
  })

  describe('Integration with existing patterns', () => {
    it('should handle fallback responseType for default response handling', async () => {
      nock('https://api.socket.dev')
        .get('/v0/fallback-test')
        .reply(200, 'fallback response')

      const result = (await getClient().getApi('fallback-test', {
        responseType: 'invalid' as CustomResponseType,
        throws: false,
      })) as SocketSdkGenericResult<HttpResponse>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.status).toBe(200)
      }
    })

    it('should use custom User-Agent from SDK options', async () => {
      const customClient = new SocketSdk('test-token', {
        userAgent: 'CustomApp/1.0.0',
      })
      let capturedHeaders: IncomingHttpHeaders = {}

      nock('https://api.socket.dev')
        .get('/v0/user-agent-test')
        .reply(function () {
          capturedHeaders = this.req.headers
          return [200, 'ok']
        })

      await customClient.getApi<string>('user-agent-test', {
        responseType: 'text',
        throws: false,
      })

      expect(capturedHeaders['user-agent']).toBe('CustomApp/1.0.0')
    })

    it('should work with custom base URLs', async () => {
      const customClient = new SocketSdk('test-token', {
        baseUrl: 'https://custom.socket.dev/api/',
      })

      nock('https://custom.socket.dev')
        .get('/api/custom-endpoint')
        .reply(200, { custom: true })

      const result = (await customClient.getApi<{ custom: boolean }>(
        'custom-endpoint',
        { responseType: 'json', throws: false },
      )) as SocketSdkGenericResult<{ custom: boolean }>

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.custom).toBe(true)
      }
    })
  })
})
