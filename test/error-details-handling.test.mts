/** @fileoverview Tests for API error response details handling. */
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

describe('Error Details Handling', () => {
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

  it('should include error.details in error response when present as object', async () => {
    const errorDetails = {
      field: 'username',
      code: 'VALIDATION_ERROR',
      constraints: ['must be at least 3 characters'],
    }

    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(400, {
        error: {
          message: 'Validation failed',
          details: errorDetails,
        },
      })

    const result = await client.getQuota()
    expect(result.success).toBe(false)

    if (!result.success) {
      expect(result.cause).toBe(
        `Validation failed - Details: ${JSON.stringify(errorDetails)}`,
      )
    }
  })

  it('should include error.details in error response when present as string', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(400, {
        error: {
          message: 'Invalid request',
          details: 'Token has expired and needs renewal',
        },
      })

    const result = await client.getQuota()
    expect(result.success).toBe(false)

    if (!result.success) {
      expect(result.cause).toBe(
        'Invalid request - Details: Token has expired and needs renewal',
      )
    }
  })

  it('should work normally when error.details is not present', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(400, {
        error: {
          message: 'Bad request',
        },
      })

    const result = await client.getQuota()
    expect(result.success).toBe(false)

    if (!result.success) {
      expect(result.cause).toBe('Bad request')
    }
  })

  it('should handle null error.details gracefully', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(400, {
        error: {
          message: 'Server error',
          details: null,
        },
      })

    const result = await client.getQuota()
    expect(result.success).toBe(false)

    if (!result.success) {
      expect(result.cause).toBe('Server error')
    }
  })

  it('should handle complex nested error.details objects', async () => {
    const complexDetails = {
      validation: {
        fields: {
          email: ['Invalid format', 'Already exists'],
          password: ['Too weak', 'Must contain special characters'],
        },
      },
      request_id: '12345-67890',
      timestamp: '2024-01-01T00:00:00Z',
    }

    nock('https://api.socket.dev')
      .post('/v0/settings')
      .reply(422, {
        error: {
          message: 'Validation errors occurred',
          details: complexDetails,
        },
      })

    const result = await client.postSettings([{ organization: 'test' }])
    expect(result.success).toBe(false)

    if (!result.success) {
      expect(result.cause).toBe(
        `Validation errors occurred - Details: ${JSON.stringify(complexDetails)}`,
      )
    }
  })
})
