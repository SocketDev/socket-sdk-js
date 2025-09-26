/** @fileoverview Test environment setup and cleanup utilities. */
import nock from 'nock'
import { afterEach, beforeEach } from 'vitest'

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

// Handle unhandled rejections in tests.
process.on('unhandledRejection', cause => {
  const error = new Error('Unhandled rejection')
  ;(error as any).cause = cause
  throw error
})
