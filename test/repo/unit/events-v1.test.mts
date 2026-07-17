/**
 * @file Tests for the v1 events SocketSdk method (postEvents).
 */
import nock from 'nock'
import { describe, expect, it } from 'vitest'

import {
  createTestClient,
  setupNockEnvironment,
} from '../../utils/environment.mts'

import type { SocketEvent } from '../../../src/events-v1.mts'

describe('events-v1', () => {
  setupNockEnvironment()

  describe('SocketSdk#postEvents', () => {
    it('returns a 201 success result for a non-empty batch', async () => {
      let capturedBody: unknown
      nock('https://api.socket.dev')
        .post('/v1/orgs/test-org/events', body => {
          capturedBody = body
          return true
        })
        .reply(201, {})

      const events: SocketEvent[] = [
        {
          artifact_purl: 'pkg:npm/lodash@4.17.21',
          event_kind: 'socket-action',
          input_purl: 'lodash@^4.17.0',
        },
      ]
      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.postEvents('test-org', events)

      expect(result.success).toBe(true)
      expect(result.status).toBe(201)
      if (result.success) {
        expect(result.data).toEqual({})
      }
      expect(capturedBody).toEqual(events)
    })

    it('accepts arbitrary extra keys beyond the known fields', async () => {
      nock('https://api.socket.dev')
        .post('/v1/orgs/test-org/events')
        .reply(201, {})

      const events: SocketEvent[] = [
        {
          custom_field: 'custom_value',
          event_type: 'package_install',
        },
      ]
      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.postEvents('test-org', events)

      expect(result.success).toBe(true)
    })

    it('returns a 200 success result for an empty batch', async () => {
      nock('https://api.socket.dev')
        .post('/v1/orgs/test-org/events', [])
        .reply(200, {})

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.postEvents('test-org', [])

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
    })

    it('returns a 413 error result when an event exceeds the size limit', async () => {
      nock('https://api.socket.dev')
        .post('/v1/orgs/test-org/events')
        .reply(413, {
          error: 'Payload Too Large',
          message: 'Individual event exceeds size limit of 100000 bytes',
          statusCode: 413,
        })

      const client = createTestClient('test-api-token', { retries: 0 })
      const result = await client.postEvents('test-org', [
        { event_kind: 'informative' },
      ])

      expect(result.success).toBe(false)
      expect(result.status).toBe(413)
    })

    it('fails closed with no network call when the v1 base URL is underivable', async () => {
      const client = createTestClient('test-api-token', {
        baseUrl: 'https://example.com/api/',
        retries: 0,
      })

      const result = await client.postEvents('test-org', [
        { event_kind: 'informative' },
      ])

      expect(result.success).toBe(false)
      expect(result.status).toBe(400)
      expect(result.error).toContain('v1')
    })
  })
})
