/**
 * @fileoverview Type definitions and interfaces for Socket SDK.
 * Provides TypeScript types for API requests, responses, and internal SDK functionality.
 */
/* c8 ignore start - Type definitions only, no runtime code to test. */
import type { components, operations } from '../types/api'
import type { OpErrorType, OpReturnType } from '../types/api-helpers'
import type { Remap } from '@socketsecurity/registry/lib/objects'
import type { ClientHttp2Session } from 'http2-wrapper'
import type {
  Agent as HttpAgent,
  RequestOptions as HttpRequestOptions,
} from 'node:http'
import type { ClientSessionRequestOptions } from 'node:http2'
import type {
  Agent as HttpsAgent,
  RequestOptions as HttpsRequestOptions,
} from 'node:https'

export type ALERT_ACTION = 'error' | 'monitor' | 'warn' | 'ignore'

export type ALERT_TYPE = keyof NonNullable<
  operations['getOrgSecurityPolicy']['responses']['200']['content']['application/json']['securityPolicyRules']
>

export type Entitlement = {
  enabled: boolean
  key: string
}

export type EntitlementsResponse = {
  items: Entitlement[]
}

export type PatchFile = {
  afterHash?: string | undefined
  beforeHash?: string | undefined
  socketBlob?: string | null
}

export type Vulnerability = {
  cves: string[]
  description: string
  severity: string
  summary: string
}

export type SecurityAlert = {
  description: string
  severity: string
  summary: string
  cveId?: string | null
  ghsaId?: string | null
}

export type PatchRecord = {
  description: string
  license: string
  publishedAt: string
  securityAlerts: SecurityAlert[]
  tier: 'free' | 'paid'
  uuid: string
}

export type PatchViewResponse = {
  description: string
  files: Record<string, PatchFile>
  license: string
  publishedAt: string
  purl: string
  tier: 'free' | 'paid'
  uuid: string
  vulnerabilities: Record<string, Vulnerability>
}

export type ArtifactPatches = {
  artifactId: string
  patches: PatchRecord[]
}

export type Agent = HttpsAgent | HttpAgent | ClientHttp2Session

export type CompactSocketArtifactAlert = Remap<
  Omit<
    SocketArtifactAlert,
    'actionSource' | 'category' | 'end' | 'file' | 'start'
  >
>

export type CompactSocketArtifact = Remap<
  Omit<
    SocketArtifact,
    | 'alerts'
    | 'alertKeysToReachabilitySummaries'
    | 'alertKeysToReachabilityTypes'
    | 'artifact'
    | 'batchIndex'
    | 'dead'
    | 'dependencies'
    | 'dev'
    | 'direct'
    | 'inputPurl'
    | 'manifestFiles'
    | 'score'
    | 'size'
    | 'topLevelAncestors'
  > & {
    alerts: CompactSocketArtifactAlert[]
  }
>

export type CustomResponseType = 'response' | 'text' | 'json'

export type GetOptions = {
  responseType?: CustomResponseType | undefined
  throws?: boolean | undefined
}

export type GotOptions = {
  http2?: ClientHttp2Session | undefined
  http?: HttpAgent | undefined
  https?: HttpsAgent | undefined
}

export type QueryParams = Record<string, any>

export type HeadersRecord = Record<string, string | string[]> | undefined

export type SocketArtifactWithExtras = SocketArtifact & {
  scorecards?: any | undefined
  supplyChainRisk?: any | undefined
  topLevelAncestors?: any | undefined
}

export type RequestOptions = (
  | (HttpsRequestOptions & { headers?: HeadersRecord | undefined })
  | (HttpRequestOptions & { headers?: HeadersRecord | undefined })
  | (ClientSessionRequestOptions & { headers?: HeadersRecord | undefined })
) & { timeout?: number | undefined }

export type SendMethod = 'POST' | 'PUT'

export type SendOptions = {
  body?: unknown | undefined
  method?: SendMethod | undefined
  throws?: boolean | undefined
}

export type SocketArtifact = Remap<
  Omit<components['schemas']['SocketArtifact'], 'alerts'> & {
    alerts?: SocketArtifactAlert[] | undefined
  }
>

export type SocketArtifactAlert = Remap<
  Omit<components['schemas']['SocketAlert'], 'action' | 'props' | 'type'> & {
    type: ALERT_TYPE
    action?: ALERT_ACTION | undefined
    props?: Record<string, unknown> | undefined
  }
>

export type SocketSdkOperations = keyof operations

export type SocketSdkSuccessResult<T extends SocketSdkOperations> =
  OpReturnType<operations[T]> & {
    cause?: undefined
    error?: undefined
  }

export type SocketSdkErrorResult<T extends SocketSdkOperations> = Omit<
  OpErrorType<operations[T]>,
  'error'
> & {
  cause?: string | undefined
  data?: undefined
  error: string
}

export type SocketSdkResult<T extends SocketSdkOperations> =
  | SocketSdkSuccessResult<T>
  | SocketSdkErrorResult<T>

// Generic result type for methods not mapped to specific operations
export type SocketSdkGenericResult<T> =
  | {
      cause?: undefined
      data: T
      error?: undefined
      status: number
      success: true
    }
  | {
      cause?: string | undefined
      data?: undefined
      error: string
      status: number
      success: false
    }

export interface SocketSdkOptions {
  agent?: Agent | GotOptions | undefined
  baseUrl?: string | undefined
  timeout?: number | undefined
  userAgent?: string | undefined
}

export type UploadManifestFilesResponse = {
  tarHash: string
  unmatchedFiles: string[]
}

export type UploadManifestFilesReturnType = {
  cause?: undefined
  data: UploadManifestFilesResponse
  error?: undefined
  status: 200
  success: true
}

export type UploadManifestFilesError = {
  cause?: string | undefined
  data?: undefined
  error: string
  status: number
  success: false
}

// Derived types that depend on SocketSdkOperations
export type BatchPackageFetchResultType = SocketSdkResult<'batchPackageFetch'>

export type BatchPackageStreamOptions = {
  chunkSize?: number | undefined
  concurrencyLimit?: number | undefined
  queryParams?: QueryParams | undefined
}
/* c8 ignore stop */
