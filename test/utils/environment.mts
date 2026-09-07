/**
 * @file Test environment setup and cleanup utilities.
 */
import process from 'node:process'

import nock from 'nock'
import { afterEach, beforeEach } from 'vitest'

import { FAST_TEST_CONFIG } from './fast-test-config.mts'
import { SocketSdk } from '../../src/index.mts'

import type { IncomingHttpHeaders } from 'node:http'

/**
 * Normalize a nock `scope.on('request')` payload's headers across nock majors:
 * nock 14 emits a legacy ClientRequest-shaped req whose `headers` is a plain
 * IncomingHttpHeaders object; nock 15 emits a fetch Request whose `headers`
 * is a Headers instance. Tests capture through this so the assertion shape
 * stays stable across the fleet catalog's nock pin.
 */
export function captureRequestHeaders(req: {
  headers: Headers | IncomingHttpHeaders
}): IncomingHttpHeaders {
  const { headers } = req
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  return { ...headers }
}

/**
 * Create a test client with a standard token.
 *
 * @example
 *   ;```ts
 *   describe('My tests', () => {
 *     let client: SocketSdk
 *     beforeEach(() => {
 *       client = createTestClient()
 *     })
 *   })
 *   ```
 *
 * @param token - Optional API token (default: 'test-api-token')
 * @param options - Optional SDK configuration.
 *
 * @returns SocketSdk instance for testing
 */
export function createTestClient(
  token = 'test-api-token',
  options?: ConstructorParameters<typeof SocketSdk>[1] | undefined,
): SocketSdk {
  return new SocketSdk(token, { ...FAST_TEST_CONFIG, ...options })
}

/**
 * Setup nock environment with standard beforeEach/afterEach hooks. Handles nock
 * activation, cleanup, and pending mock detection.
 */
export function setupNockEnvironment() {
  beforeEach(() => {
    nock.restore()
    nock.cleanAll()
    nock.activate()
    nock.disableNetConnect()
  })

  afterEach(() => {
    try {
      if (!nock.isDone()) {
        throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
      }
    } finally {
      nock.abortPendingRequests()
      nock.cleanAll()
      nock.restore()
    }
  })
}

/**
 * Setup test environment with nock and create a test client. This is a
 * convenience function that combines setupTestEnvironment and client creation.
 *
 * @example
 *   ;```ts
 *   describe('My tests', () => {
 *     const getClient = setupTestClient({ retries: 0 })
 *
 *     it('should work', async () => {
 *       const client = getClient()
 *       // ... test code
 *     })
 *   })
 *   ```
 *
 * @param token - Optional API token (default: 'test-api-token')
 * @param options - Optional SDK configuration.
 *
 * @returns Function that returns the current test client
 */
export function setupTestClient(
  token = 'test-api-token',
  options?: ConstructorParameters<typeof SocketSdk>[1] | undefined,
): () => SocketSdk {
  let client: SocketSdk

  setupTestEnvironment()

  beforeEach(() => {
    client = createTestClient(token, options)
  })

  return () => client
}

export function setupTestEnvironment() {
  setupNockEnvironment()
}

// Handle unhandled rejections in tests.
process.on('unhandledRejection', cause => {
  const error = new Error('Unhandled rejection', { cause })
  throw error
})
