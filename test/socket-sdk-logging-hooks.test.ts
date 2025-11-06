/** @fileoverview Tests for SDK logging hooks functionality. */

import nock from 'nock'
import { describe, expect, it, vi } from 'vitest'

import { SocketSdk } from '../src/index'

import type { RequestInfo, ResponseInfo } from '../src/index'

describe('SocketSdk - Logging Hooks', () => {
  it('should call request and response hooks for successful API call', async () => {
    const onRequest = vi.fn()
    const onResponse = vi.fn()

    const client = new SocketSdk('test-token', {
      hooks: { onRequest, onResponse },
    })

    // Mock successful quota API call
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(200, { quota: { remaining: 100 } })

    await client.getQuota()

    // Verify onRequest hook was called
    expect(onRequest).toHaveBeenCalledTimes(1)
    const requestInfo: RequestInfo = onRequest.mock.calls[0]?.[0]!
    expect(requestInfo).toMatchObject({
      method: 'GET',
      url: 'https://api.socket.dev/v0/quota',
    })
    expect(requestInfo.headers).toBeDefined()

    // Verify onResponse hook was called
    expect(onResponse).toHaveBeenCalledTimes(1)
    const responseInfo: ResponseInfo = onResponse.mock.calls[0]?.[0]!
    expect(responseInfo).toMatchObject({
      method: 'GET',
      url: 'https://api.socket.dev/v0/quota',
      status: 200,
    })
    expect(responseInfo.duration).toBeGreaterThanOrEqual(0)
    expect(responseInfo.headers).toBeDefined()
  })

  it('should call response hook with error for network failure', async () => {
    const onRequest = vi.fn()
    const onResponse = vi.fn()

    const client = new SocketSdk('test-token', {
      hooks: { onRequest, onResponse },
    })

    // Mock network error
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .replyWithError('Network error')

    await expect(client.getQuota()).rejects.toThrow()

    // Verify hooks were called
    expect(onRequest).toHaveBeenCalledTimes(1)
    expect(onResponse).toHaveBeenCalledTimes(1)

    // Verify response hook logged the error
    const responseInfo: ResponseInfo = onResponse.mock.calls[0]?.[0]!
    expect(responseInfo).toMatchObject({
      method: 'GET',
      url: 'https://api.socket.dev/v0/quota',
    })
    expect(responseInfo.error).toBeInstanceOf(Error)
    expect(responseInfo.duration).toBeGreaterThanOrEqual(0)
  })

  it('should sanitize sensitive headers', async () => {
    const onRequest = vi.fn()
    const onResponse = vi.fn()

    const client = new SocketSdk('test-token', {
      hooks: { onRequest, onResponse },
    })

    // Mock successful API call
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(200, { quota: { remaining: 100 } }, {
        'set-cookie': 'session=secret123',
        'content-type': 'application/json',
      })

    await client.getQuota()

    // Verify request headers are sanitized
    const requestInfo: RequestInfo = onRequest.mock.calls[0]?.[0]!
    expect(requestInfo.headers?.Authorization).toBe('[REDACTED]')

    // Verify response headers are sanitized
    const responseInfo: ResponseInfo = onResponse.mock.calls[0]?.[0]!
    expect(responseInfo.headers?.['set-cookie']).toBe('[REDACTED]')
    expect(responseInfo.headers?.['content-type']).toBe('application/json')
  })
})