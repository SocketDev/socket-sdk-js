/**
 * @file Package version history from the v1 organization API.
 */
import { requestSdkJson } from './api-client.mts'
import { deriveApiV1BaseUrl } from './full-scans-v1.mts'
import { createOrgApiPath } from './org-api.mts'

import type { SdkApiContext } from './api-client.mts'

import type { paths } from '../types/api-v1.d.ts'

export type PurlVersionsData =
  paths['/v1/orgs/{org_slug}/purl/versions/{purl}']['get']['responses'][200]['content']['application/json']
export type PurlVersionEntry = PurlVersionsData['versions'][number]
export type PurlVersionsOptions = { limit?: number | undefined }

export function getOrgPurlVersions(
  context: SdkApiContext,
  orgSlug: string,
  purl: string,
  options: PurlVersionsOptions = {},
  baseUrl = deriveApiV1BaseUrl(context.baseUrl),
) {
  if (!baseUrl) {
    throw new TypeError(
      'Missing v1 API URL for package version history. Supply an apiV1BaseUrl for the custom API base.',
    )
  }
  if (
    options.limit !== undefined &&
    (!Number.isSafeInteger(options.limit) || options.limit < 1)
  ) {
    throw new TypeError(
      'Invalid limit in package version history: expected a positive integer. Supply a limit of at least 1.',
    )
  }
  return requestSdkJson<PurlVersionsData>(context, {
    baseUrl,
    path: createOrgApiPath(orgSlug, 'purl', 'versions', purl),
    query: options,
  })
}
