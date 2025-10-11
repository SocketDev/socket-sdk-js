/** @fileoverview Test environment setup and cleanup utilities. */
import nock from 'nock'
import { afterEach, beforeEach } from 'vitest'

import { FAST_TEST_CONFIG } from './fast-test-config.mts'
import { SocketSdk } from '../../src/index'

export function setupTestEnvironment() {
  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
    nock.cleanAll()
  })
}

/**
 * Create a test client with a standard token.
 *
 * @param token - Optional API token (default: 'test-api-token')
 * @param options - Optional SDK configuration
 * @returns SocketSdk instance for testing
 *
 * @example
 * ```ts
 * describe('My tests', () => {
 *   let client: SocketSdk
 *   beforeEach(() => { client = createTestClient() })
 * })
 * ```
 */
export function createTestClient(
  token = 'test-api-token',
  options?: ConstructorParameters<typeof SocketSdk>[1],
): SocketSdk {
  return new SocketSdk(token, { ...FAST_TEST_CONFIG, ...options })
}

// Handle unhandled rejections in tests.
process.on('unhandledRejection', cause => {
  const error = new Error('Unhandled rejection', { cause })
  throw error
})
