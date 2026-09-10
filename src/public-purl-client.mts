/**
 * @file Public PURL proxy client with explicit optional authentication.
 */

import { createSdkApiContext } from './api-client.mts'
import { fetchPurlRecords, streamBatchPurlRecords } from './purl.mts'
import {
  assertPublicPurlOrganization,
  validatePublicPurlQuery,
} from './utils/public-purl-options.mts'

import type { SdkApiContext } from './api-client.mts'
import type {
  PublicApiClientOptions,
  PublicOrgPurlQuery,
  PublicPurlQuery,
  PurlComponents,
  PurlFetchResult,
  PurlStreamOptions,
  PurlStreamResult,
} from './types/purl.mts'

export const SOCKET_PURL_API_URL = 'https://purl-api.socket.dev/'

export class SocketPurlClient {
  readonly #authenticated: boolean
  readonly #context: SdkApiContext

  constructor(options: PublicApiClientOptions = {}) {
    const opts = { __proto__: null, ...options } as typeof options
    this.#authenticated = opts.apiToken !== undefined
    this.#context = createSdkApiContext({
      ...opts,
      baseUrl: opts.baseUrl ?? SOCKET_PURL_API_URL,
    })
  }

  getPurl(
    purl: string,
    queryParams?: PublicPurlQuery | undefined,
  ): Promise<PurlFetchResult> {
    return fetchPurlRecords(this.#context, {
      path: `purl/${encodeURIComponent(purl)}`,
      query: validatePublicPurlQuery(queryParams),
    })
  }

  batchPackageFetch(
    payload: PurlComponents,
    queryParams?: PublicPurlQuery | undefined,
  ): Promise<PurlFetchResult> {
    return fetchPurlRecords(this.#context, {
      path: 'batch',
      method: 'POST',
      body: payload,
      query: validatePublicPurlQuery(queryParams),
    })
  }

  batchPackageStream(
    payload: PurlComponents,
    options?: PurlStreamOptions<PublicPurlQuery> | undefined,
  ): AsyncGenerator<PurlStreamResult> {
    const opts = { __proto__: null, ...options } as typeof options
    return streamBatchPurlRecords(this.#context, 'batch', payload, {
      ...options,
      queryParams: validatePublicPurlQuery(opts?.queryParams),
    })
  }

  batchOrgPackageFetch(
    orgSlug: string,
    payload: PurlComponents,
    queryParams?: PublicOrgPurlQuery | undefined,
  ): Promise<PurlFetchResult> {
    assertPublicPurlOrganization(orgSlug, {
      authenticated: this.#authenticated,
    })
    return fetchPurlRecords(this.#context, {
      path: `orgs/${encodeURIComponent(orgSlug)}/batch`,
      method: 'POST',
      body: payload,
      query: validatePublicPurlQuery(queryParams, { allowLabels: true }),
    })
  }

  batchOrgPackageStream(
    orgSlug: string,
    payload: PurlComponents,
    options?: PurlStreamOptions<PublicOrgPurlQuery> | undefined,
  ): AsyncGenerator<PurlStreamResult> {
    const opts = { __proto__: null, ...options } as typeof options
    assertPublicPurlOrganization(orgSlug, {
      authenticated: this.#authenticated,
    })
    return streamBatchPurlRecords(
      this.#context,
      `orgs/${encodeURIComponent(orgSlug)}/batch`,
      payload,
      {
        ...options,
        queryParams: validatePublicPurlQuery(opts?.queryParams, {
          allowLabels: true,
        }),
      },
    )
  }
}
