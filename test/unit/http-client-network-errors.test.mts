/** @fileoverview Tests for HTTP client network error handling. */

import { EventEmitter } from 'node:events'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createGetRequest, getResponse } from '../../src/http-client'

import type { ClientRequest } from 'node:http'

describe('HTTP Client - Network Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getResponse error codes', () => {
    it('should handle ENOTFOUND error', async () => {
      const mockRequest = new EventEmitter() as ClientRequest

      const responsePromise = getResponse(mockRequest)

      // Simulate DNS lookup failure
      const error = new Error('getaddrinfo ENOTFOUND api.socket.dev')
      Object.assign(error, { code: 'ENOTFOUND' })
      mockRequest.emit('error', error)

      await expect(responsePromise).rejects.toThrow('DNS lookup failed')
      await expect(responsePromise).rejects.toThrow('Cannot resolve hostname')
    })

    it('should handle ETIMEDOUT error', async () => {
      const mockRequest = new EventEmitter() as ClientRequest

      const responsePromise = getResponse(mockRequest)

      // Simulate connection timeout
      const error = new Error('connect ETIMEDOUT')
      Object.assign(error, { code: 'ETIMEDOUT' })
      mockRequest.emit('error', error)

      await expect(responsePromise).rejects.toThrow('Connection timed out')
      await expect(responsePromise).rejects.toThrow('Network or server issue')
    })

    it('should handle ECONNRESET error', async () => {
      const mockRequest = new EventEmitter() as ClientRequest

      const responsePromise = getResponse(mockRequest)

      // Simulate connection reset
      const error = new Error('socket hang up')
      Object.assign(error, { code: 'ECONNRESET' })
      mockRequest.emit('error', error)

      await expect(responsePromise).rejects.toThrow(
        'Connection reset by server',
      )
      await expect(responsePromise).rejects.toThrow(
        'Possible network interruption',
      )
    })

    it('should handle EPIPE error', async () => {
      const mockRequest = new EventEmitter() as ClientRequest

      const responsePromise = getResponse(mockRequest)

      // Simulate broken pipe
      const error = new Error('write EPIPE')
      Object.assign(error, { code: 'EPIPE' })
      mockRequest.emit('error', error)

      await expect(responsePromise).rejects.toThrow('Broken pipe')
      await expect(responsePromise).rejects.toThrow(
        'Server closed connection unexpectedly',
      )
    })

    it('should handle CERT_HAS_EXPIRED error', async () => {
      const mockRequest = new EventEmitter() as ClientRequest

      const responsePromise = getResponse(mockRequest)

      // Simulate certificate expiry
      const error = new Error('certificate has expired')
      Object.assign(error, { code: 'CERT_HAS_EXPIRED' })
      mockRequest.emit('error', error)

      await expect(responsePromise).rejects.toThrow('SSL/TLS certificate error')
      await expect(responsePromise).rejects.toThrow(
        'System time and date are correct',
      )
    })

    it('should handle UNABLE_TO_VERIFY_LEAF_SIGNATURE error', async () => {
      const mockRequest = new EventEmitter() as ClientRequest

      const responsePromise = getResponse(mockRequest)

      // Simulate certificate verification failure
      const error = new Error('unable to verify the first certificate')
      Object.assign(error, { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' })
      mockRequest.emit('error', error)

      await expect(responsePromise).rejects.toThrow('SSL/TLS certificate error')
    })

    it('should handle unknown error codes', async () => {
      const mockRequest = new EventEmitter() as ClientRequest

      const responsePromise = getResponse(mockRequest)

      // Simulate unknown error code
      const error = new Error('some unknown error')
      Object.assign(error, { code: 'UNKNOWN_ERROR' })
      mockRequest.emit('error', error)

      await expect(responsePromise).rejects.toThrow('Error code: UNKNOWN_ERROR')
    })

    it('should handle errors without error codes', async () => {
      const mockRequest = new EventEmitter() as ClientRequest

      const responsePromise = getResponse(mockRequest)

      // Simulate error without code
      const error = new Error('generic error message')
      mockRequest.emit('error', error)

      await expect(responsePromise).rejects.toThrow('request failed')
    })
  })

  describe('createGetRequest integration with error codes', () => {
    it('should propagate ENOTFOUND through createGetRequest', async () => {
      await expect(
        createGetRequest('http://nonexistent.socket.dev.invalid', '/test', {
          timeout: 100,
        }),
      ).rejects.toThrow()
    })

    it('should propagate ECONNREFUSED through createGetRequest', async () => {
      // Use a port that's guaranteed not to have a server running
      await expect(
        createGetRequest('http://localhost:1', '/test', {
          timeout: 100,
        }),
      ).rejects.toThrow()
    })
  })
})
