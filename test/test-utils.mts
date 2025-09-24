import { Readable } from 'node:stream'

import nock from 'nock'
import { afterEach, beforeEach, vi } from 'vitest'

// @ts-ignore - internal import
export { default as SOCKET_PUBLIC_API_TOKEN } from '@socketsecurity/registry/lib/constants/socket-public-api-token'

// Mock fs.createReadStream to prevent test-package.json from being created.
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    createReadStream: vi.fn((path: string) => {
      // Return a mock readable stream for test-package.json.
      if (path.includes('test-package.json')) {
        const stream = new Readable()
        stream.push('{"name": "test-package", "version": "1.0.0"}')
        stream.push(null)
        return stream
      }
      // For other files, use the actual createReadStream.
      return actual.createReadStream(path)
    }),
  }
})

// Handle unhandled rejections in tests.
process.on('unhandledRejection', cause => {
  const error = new Error('Unhandled rejection')
  ;(error as any).cause = cause
  throw error
})

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
