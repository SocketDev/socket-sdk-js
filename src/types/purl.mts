/**
 * @file PURL request options and discriminated NDJSON response records.
 */

import type { components } from '../../types/api.d.ts'
import type {
  CompactSocketArtifact,
  SocketArtifact,
  SocketSdkGenericResult,
  SocketSdkOptions,
} from './core.mts'

export type PurlComponents = { components: Array<{ purl: string }> }

export type PurlErrorRecord = {
  _type: 'purlError'
  value: components['schemas']['PurlErrorSchema']
}

export type PurlSummaryRecord = {
  _type: 'summary'
  value: components['schemas']['PurlSummarySchema']
}

export type PurlArtifact = SocketArtifact | CompactSocketArtifact

export type PurlRecord = PurlArtifact | PurlErrorRecord | PurlSummaryRecord

export type PurlFetchResult = SocketSdkGenericResult<PurlRecord[]>

export type PurlStreamResult = SocketSdkGenericResult<PurlRecord>

export type PublicPurlQuery = {
  actions?: string | undefined
  alerts?: boolean | undefined
  cachedResultsOnly?: boolean | undefined
  compact?: boolean | undefined
  fixable?: boolean | undefined
  licenseattrib?: boolean | undefined
  licensedetails?: boolean | undefined
  purlErrors?: boolean | undefined
}

export type PublicOrgPurlQuery = PublicPurlQuery & {
  labels?: string | undefined
}

export type PurlQuery = PublicPurlQuery & {
  poll?: boolean | undefined
  summary?: boolean | undefined
  timeoutSec?: number | undefined
}

export type OrgPurlQuery = PurlQuery & {
  labels?: string | undefined
}

export type PurlStreamOptions<Query = PurlQuery> = {
  chunkSize?: number | undefined
  concurrencyLimit?: number | undefined
  queryParams?: Query | undefined
  signal?: AbortSignal | undefined
}

export type PublicApiClientOptions = Pick<
  SocketSdkOptions,
  | 'authScheme'
  | 'baseUrl'
  | 'hooks'
  | 'retries'
  | 'retryDelay'
  | 'signal'
  | 'timeout'
  | 'userAgent'
> & {
  apiToken?: string | undefined
}
