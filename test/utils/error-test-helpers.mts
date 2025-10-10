/** @fileoverview Shared test helpers for common error scenarios. */

import nock from 'nock'
import { expect, it } from 'vitest'

import type { SocketSdk } from '../../src/index'

interface ErrorTestConfig {
  method: string
  endpoint: string
  args: any[]
  httpMethod?: 'get' | 'post' | 'put' | 'patch' | 'delete'
}

/**
 * Creates a test for 500 server errors.
 * Reduces duplication across ~20 similar tests.
 */
export async function testServerError(
  client: SocketSdk,
  config: ErrorTestConfig,
): Promise<void> {
  const { args, endpoint, httpMethod = 'get', method } = config

  nock('https://api.socket.dev')[httpMethod](endpoint)
    .reply(500, { error: { message: 'Internal server error' } })

  await expect((client as any)[method](...args)).rejects.toThrow(
    'Socket API server error (500)',
  )
}

/**
 * Creates a test for network errors.
 * Reduces duplication across ~30 similar tests.
 */
export async function testNetworkError(
  client: SocketSdk,
  config: ErrorTestConfig,
): Promise<void> {
  const { args, endpoint, httpMethod = 'get', method } = config

  nock('https://api.socket.dev')[httpMethod](endpoint)
    .replyWithError('Network error')

  await expect((client as any)[method](...args)).rejects.toThrow(
    'Unexpected Socket API error',
  )
}

/**
 * Creates a test for 404 not found errors.
 * Reduces duplication across ~8 similar tests.
 */
export async function test404Error(
  client: SocketSdk,
  config: ErrorTestConfig,
  customMessage?: string,
): Promise<void> {
  const { args, endpoint, httpMethod = 'get', method } = config
  const message = customMessage || 'Not found'

  nock('https://api.socket.dev')[httpMethod](endpoint)
    .reply(404, { error: { message } })

  await expect((client as any)[method](...args)).rejects.toThrow(
    'Socket API client error (404)',
  )
}

/**
 * Creates a test for 403 forbidden errors.
 * Reduces duplication across ~5 similar tests.
 */
export async function test403Error(
  client: SocketSdk,
  config: ErrorTestConfig,
): Promise<void> {
  const { args, endpoint, httpMethod = 'get', method } = config

  nock('https://api.socket.dev')[httpMethod](endpoint)
    .reply(403, { error: { message: 'Forbidden' } })

  await expect((client as any)[method](...args)).rejects.toThrow(
    'Socket API client error (403)',
  )
}

/**
 * Creates a test for 401 unauthorized errors.
 */
export async function test401Error(
  client: SocketSdk,
  config: ErrorTestConfig,
): Promise<void> {
  const { args, endpoint, httpMethod = 'get', method } = config

  nock('https://api.socket.dev')[httpMethod](endpoint)
    .reply(401, { error: { message: 'Unauthorized' } })

  await expect((client as any)[method](...args)).rejects.toThrow(
    'Socket API client error (401)',
  )
}

/**
 * Creates a test for URL encoding scenarios.
 * Reduces duplication across ~12 similar tests.
 */
export async function testUrlEncoding(
  client: SocketSdk,
  config: ErrorTestConfig & { encodedEndpoint: string },
  expectedResponse: any,
): Promise<void> {
  const { args, encodedEndpoint, httpMethod = 'get', method } = config

  nock('https://api.socket.dev')[httpMethod](encodedEndpoint)
    .reply(200, expectedResponse)

  await expect((client as any)[method](...args)).resolves.toMatchObject({
    success: true,
    data: expectedResponse,
  })
}

/**
 * Creates a test for malformed JSON responses.
 */
export async function testMalformedJson(
  client: SocketSdk,
  config: ErrorTestConfig,
): Promise<void> {
  const { args, endpoint, httpMethod = 'get', method } = config

  nock('https://api.socket.dev')[httpMethod](endpoint)
    .reply(200, 'invalid json {')

  await expect((client as any)[method](...args)).rejects.toThrow()
}

/**
 * Creates a test for timeout errors.
 */
export async function testTimeout(
  client: SocketSdk,
  config: ErrorTestConfig,
  delay: number = 10000,
): Promise<void> {
  const { args, endpoint, httpMethod = 'get', method } = config

  nock('https://api.socket.dev')[httpMethod](endpoint)
    .delay(delay)
    .reply(200, { data: 'too late' })

  await expect((client as any)[method](...args)).rejects.toThrow()
}

/**
 * Test suite for common error scenarios.
 * Use this to ensure consistent error handling across all API methods.
 */
export function testCommonErrors(
  description: string,
  client: SocketSdk,
  config: ErrorTestConfig & { encodedEndpoint?: string },
): void {
  it(`${description} - handles server errors`, async () => {
    await testServerError(client, config)
  })

  it(`${description} - handles network errors`, async () => {
    await testNetworkError(client, config)
  })

  it(`${description} - handles 404 not found`, async () => {
    await test404Error(client, config)
  })

  it(`${description} - handles 403 forbidden`, async () => {
    await test403Error(client, config)
  })
}