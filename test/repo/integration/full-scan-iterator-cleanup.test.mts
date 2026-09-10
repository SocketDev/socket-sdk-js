/**
 * @file Full-scan API clients close unread HTTP responses.
 */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { promiseWithResolvers } from '../../../src/utils.mts'
import { createPublicApiServer } from '../../utils/public-api-server.mts'

describe('unstarted full-scan iterator cleanup', () => {
  it.each(['getOrgFullScanV1', 'pollOrgFullScanV1'] as const)(
    '%s closes its unread HTTP response',
    async method => {
      const closed = promiseWithResolvers<void>()
      const server = await createPublicApiServer((request, response) => {
        request.resume()
        response.on('close', () => closed.resolve())
        response.writeHead(200, { 'X-Socket-Scan-Status': 'complete' })
        response.write('{"id":"example-artifact","name":"example-package"}\n')
      })
      try {
        const client = new SocketSdk('test-token', {
          retries: 0,
          apiV1BaseUrl: server.baseUrl,
        })
        const result = await client[method]('example-org', 'example-scan')
        if (!result.success || result.data.status !== 'complete') {
          throw new Error('Expected complete scan')
        }
        await result.data.records.return(undefined)
        await expect(closed.promise).resolves.toBeUndefined()
      } finally {
        await server.close()
      }
    },
  )
})
