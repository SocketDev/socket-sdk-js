import { parseJson } from '@socketsecurity/lib/json/parse'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getResponseJson } from '../../src/http-client.js'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'

vi.mock('@socketsecurity/lib/json/parse', () => ({
  parseJson: vi.fn(),
}))

const mockJsonParse = vi.mocked(parseJson)

export function mockHttpResponse(bodyText: string, ok = true): HttpResponse {
  const body = Buffer.from(bodyText)
  return {
    arrayBuffer: () =>
      body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength,
      ) as ArrayBuffer,
    body,
    headers: { 'content-type': 'application/json' },
    json: () => JSON.parse(body.toString('utf8')),
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    text: () => body.toString('utf8'),
  }
}

describe('JSON Parsing Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getResponseJson error handling', () => {
    it('should handle non-Error objects thrown during JSON parsing', async () => {
      const responseBody = '{"test": "data"}'
      const response = mockHttpResponse(responseBody)

      mockJsonParse.mockImplementation(() => {
        throw 'This is a string error, not an Error instance'
      })

      await expect(getResponseJson(response)).rejects.toThrow(
        expect.objectContaining({
          name: 'SyntaxError',
          message: 'Unknown JSON parsing error',
          originalResponse: responseBody,
        }),
      )

      expect(mockJsonParse).toHaveBeenCalledWith(responseBody)
    })

    it('should re-throw Error instances without modification', async () => {
      const responseBody = '{"test": "data"}'
      const response = mockHttpResponse(responseBody)

      const customError = new Error('Custom parsing error')
      mockJsonParse.mockImplementation(() => {
        throw customError
      })

      await expect(getResponseJson(response)).rejects.toThrow(customError)
      expect(mockJsonParse).toHaveBeenCalledWith(responseBody)
    })

    it('should handle SyntaxError with enhanced error message', async () => {
      const responseBody = 'invalid json {'
      const response = mockHttpResponse(responseBody)

      const syntaxError = new SyntaxError('Unexpected end of JSON input')
      mockJsonParse.mockImplementation(() => {
        throw syntaxError
      })

      await expect(getResponseJson(response)).rejects.toThrow(
        expect.objectContaining({
          name: 'SyntaxError',
          message: expect.stringContaining(
            'Socket API returned invalid JSON response',
          ),
          originalResponse: responseBody,
        }),
      )

      expect(mockJsonParse).toHaveBeenCalledWith(responseBody)
    })
  })
})
