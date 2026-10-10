/**
 * @file Authentication failure stops each real transport before network I/O.
 */
import { describe, expect, it } from 'vitest'

import { SdkAuthenticationError } from '../../../src/auth.mts'
import FormData from '../../../src/external/form-data.js'
import { createUploadRequest } from '../../../src/file-upload.mts'
import {
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
} from '../../../src/http-client.mts'

import type { RequestOptionsWithHooks } from '../../../src/types/core.mts'

describe('transport credential resolution', () => {
  const baseUrl = 'invalid-base-url'
  const requests = [
    {
      name: 'GET',
      send: (options: RequestOptionsWithHooks) =>
        createGetRequest(baseUrl, 'resource', options),
    },
    {
      name: 'DELETE',
      send: (options: RequestOptionsWithHooks) =>
        createDeleteRequest(baseUrl, 'resource', options),
    },
    {
      name: 'JSON',
      send: (options: RequestOptionsWithHooks) =>
        createRequestWithJson('POST', baseUrl, 'resource', {}, options),
    },
    {
      name: 'multipart',
      send: (options: RequestOptionsWithHooks) =>
        createUploadRequest(baseUrl, 'resource', new FormData(), options),
    },
  ]

  it.each(requests)(
    '$name stops when credential resolution fails',
    async request => {
      let providerCalls = 0
      let requestHooks = 0
      await expect(
        request.send({
          authProvider: async () => {
            providerCalls += 1
            throw new Error('login required')
          },
          hooks: {
            onRequest() {
              requestHooks += 1
            },
          },
        }),
      ).rejects.toBeInstanceOf(SdkAuthenticationError)
      expect(providerCalls).toBe(1)
      expect(requestHooks).toBe(0)
    },
  )

  it.each(requests)(
    '$name checks cancellation after resolving credentials',
    async request => {
      const controller = new AbortController()
      let providerCalls = 0
      await expect(
        request.send({
          signal: controller.signal,
          authProvider: async () => {
            providerCalls += 1
            controller.abort()
            return { token: 'example-token', authScheme: 'bearer' }
          },
        }),
      ).rejects.toBe(controller.signal.reason)
      expect(providerCalls).toBe(1)
    },
  )
})
