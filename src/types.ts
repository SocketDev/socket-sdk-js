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
  key: string
  enabled: boolean
}

export type EntitlementsResponse = {
  items: Entitlement[]
}

export type PatchFile = {
  beforeHash?: string
  afterHash?: string
  socketBlob?: string | null
}

export type Vulnerability = {
  cves: string[]
  summary: string
  severity: string
  description: string
}

export type SecurityAlert = {
  ghsaId?: string | null
  cveId?: string | null
  summary: string
  severity: string
  description: string
}

export type PatchRecord = {
  uuid: string
  publishedAt: string
  description: string
  license: string
  tier: 'free' | 'paid'
  securityAlerts: SecurityAlert[]
}

export type PatchViewResponse = {
  uuid: string
  purl: string
  publishedAt: string
  files: Record<string, PatchFile>
  vulnerabilities: Record<string, Vulnerability>
  description: string
  license: string
  tier: 'free' | 'paid'
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
  responseType?: CustomResponseType
  throws?: boolean | undefined
}

export type GotOptions = {
  http?: HttpAgent | undefined
  https?: HttpsAgent | undefined
  http2?: ClientHttp2Session | undefined
}

export type QueryParams = Record<string, any>

export type RequestOptions = (
  | HttpsRequestOptions
  | HttpRequestOptions
  | ClientSessionRequestOptions
) & { timeout?: number | undefined }

export type SendMethod = 'POST' | 'PUT'

export type SendOptions = {
  method?: SendMethod | undefined
  body?: unknown | undefined
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
    props?: any | undefined
  }
>

export type SocketSdkOperations = keyof operations

export type SocketSdkSuccessResult<T extends SocketSdkOperations> =
  OpReturnType<operations[T]>

export type SocketSdkErrorResult<T extends SocketSdkOperations> = Omit<
  OpErrorType<operations[T]>,
  'error'
> & {
  error: string
  cause?: string | undefined
}

export type SocketSdkResult<T extends SocketSdkOperations> =
  | SocketSdkSuccessResult<T>
  | SocketSdkErrorResult<T>

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
  success: true
  status: 200
  data: UploadManifestFilesResponse
}

export type UploadManifestFilesError = {
  success: false
  status: number
  error: string
  cause: string | undefined
}

// CResult pattern for non-throwing API operations
export type CResult<T> =
  | {
      ok: true
      data: T
      message?: string | undefined
    }
  | {
      ok: false
      code?: number | undefined
      message: string
      cause?: string | undefined
      data?: unknown | undefined
    }

// Derived types that depend on SocketSdkOperations
export type BatchPackageFetchResultType = SocketSdkResult<'batchPackageFetch'>

export type BatchPackageStreamOptions = {
  chunkSize?: number | undefined
  concurrencyLimit?: number | undefined
  queryParams?: QueryParams | undefined
}
/* c8 ignore stop */
