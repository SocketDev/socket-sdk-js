/**
 * @file Suite-owned SDK client and HTTP coverage fixture lifecycle.
 */

import { afterAll, beforeAll } from 'vitest'

import { SocketSdk } from '../../src/index.mts'
import { createPublicApiServer } from './public-api-server.mts'
import { respondToSdkCoverageRequest } from './sdk-api-coverage-server.mts'

export function setupSdkCoverageClient(): {
  readonly client: SocketSdk
  readonly baseUrl: string
} {
  let server: Awaited<ReturnType<typeof createPublicApiServer>>
  let client: SocketSdk
  beforeAll(async () => {
    server = await createPublicApiServer((request, response) => {
      request.resume()
      request.once('end', () => respondToSdkCoverageRequest(request, response))
    })
    client = new SocketSdk('test-token', {
      baseUrl: server.baseUrl,
      timeout: 5000,
    })
  })
  afterAll(async () => {
    await server.close()
  })
  return {
    get client() {
      return client
    },
    get baseUrl() {
      return server.baseUrl
    },
  }
}
