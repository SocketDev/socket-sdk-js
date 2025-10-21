/** @fileoverview Tests for HTTP client ResponseError edge cases. */

import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { ResponseError } from '../src/http-client'

describe('HTTP Client - Edge Cases', () => {
  describe('ResponseError constructor', () => {
    it('should handle empty message parameter', () => {
      const mockResponse = {
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('Request failed')
      expect(error.message).toContain('500')
      expect(error.message).toContain('Internal Server Error')
      expect(error.name).toBe('ResponseError')
    })

    it('should handle custom message', () => {
      const mockResponse = {
        statusCode: 404,
        statusMessage: 'Not Found',
      } as IncomingMessage

      const error = new ResponseError(mockResponse, 'Custom message')

      expect(error.message).toContain('Custom message')
      expect(error.message).toContain('404')
    })

    it('should handle missing statusCode', () => {
      const mockResponse = {
        statusMessage: 'Error',
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('unknown')
    })

    it('should handle missing statusMessage', () => {
      const mockResponse = {
        statusCode: 500,
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('No status message')
    })

    it('should have response property', () => {
      const mockResponse = {
        statusCode: 500,
        statusMessage: 'Error',
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.response).toBe(mockResponse)
    })

    it('should handle both missing statusCode and statusMessage', () => {
      const mockResponse = {} as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('unknown')
      expect(error.message).toContain('No status message')
    })

    it('should have proper error stack trace', () => {
      const mockResponse = {
        statusCode: 500,
        statusMessage: 'Error',
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ResponseError')
    })
  })
})
