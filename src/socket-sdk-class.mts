/* max-file-lines: sdk — SDK surface class, one method per API endpoint */
/**
 * @file SocketSdk class implementation for Socket security API client. Provides
 *   complete API functionality for vulnerability scanning, analysis, and
 *   reporting.
 */
import {
  createOrgAlertPolicy as requestCreateOrgAlertPolicy,
  deleteOrgAlertPolicy as requestDeleteOrgAlertPolicy,
  getOrgAlertPolicies as requestGetOrgAlertPolicies,
  getOrgAlertPolicy as requestGetOrgAlertPolicy,
  updateOrgAlertPolicy as requestUpdateOrgAlertPolicy,
} from './alert-policies.mts'
import {
  createOrgAlertPolicyRule as requestCreateOrgAlertPolicyRule,
  deleteOrgAlertPolicyRule as requestDeleteOrgAlertPolicyRule,
  getOrgAlertPolicyRule as requestGetOrgAlertPolicyRule,
  getOrgAlertPolicyRules as requestGetOrgAlertPolicyRules,
  updateOrgAlertPolicyRule as requestUpdateOrgAlertPolicyRule,
} from './alert-policy-rules.mts'
import {
  createOrgAlertResolution as requestCreateOrgAlertResolution,
  getOrgAlertPolicyMigrationStatus as requestGetOrgAlertPolicyMigrationStatus,
  translateOrgAlertPolicyMigrationTriage as requestTranslateOrgAlertPolicyMigrationTriage,
} from './alert-policy-migration.mts'
import {
  getOrgFixComputation as requestOrgFixComputation,
  getOrgFixes as requestOrgFixes,
  startOrgFixComputation as requestStartOrgFixComputation,
} from './org-fixes.mts'
import { getOrgPurlVersions } from './purl-versions-v1.mts'
import { getOrgFullScanV1 } from './full-scan-results-v1.mts'
import { pollOrgFullScanV1 } from './full-scan-polling-v1.mts'
import { downloadOrgPatchVerificationBundle } from './patch-verification.mts'
import type {
  AlertPolicyWriteOptions,
  CreateOrgAlertPolicyBody,
  CreateOrgAlertPolicyRuleBody,
  CreateOrgAlertResolutionBody,
  TranslateOrgAlertPolicyMigrationTriageBody,
  UpdateOrgAlertPolicyBody,
  UpdateOrgAlertPolicyRuleBody,
} from './types/alert-policies.mts'
import type { OrgFixesOptions } from './types/fixes.mts'
import type { PurlVersionsOptions } from './purl-versions-v1.mts'
import type { PollFullScanV1Options } from './types/full-scan-results-v1.mts'

import path from 'node:path'
import process from 'node:process'

import { createTtlCache } from '@socketsecurity/lib/cache/ttl/store'
import { UNKNOWN_ERROR } from '@socketsecurity/lib/constants/sentinels'
import { getAbortSignal } from '@socketsecurity/lib/process/abort'
import { isDebugNs } from '@socketsecurity/lib/debug/namespace'
import { debugLog } from '@socketsecurity/lib/debug/output'
import { errorMessage as getErrorMessage } from '@socketsecurity/lib/errors/message'
import { validateFiles } from '@socketsecurity/lib/fs/validate'
import { parseJson } from '@socketsecurity/lib/json/parse'
import { getDefaultLogger } from '@socketsecurity/lib/logger/default'
import { isObject } from '@socketsecurity/lib/objects/predicates'
import { ErrorCtor } from '@socketsecurity/lib/primordials/error'
import { StringPrototypeTrim } from '@socketsecurity/lib/primordials/string'

import { createOrgApiPath } from './org-api.mts'
import {
  createFullScanManifestParams,
  createFullScanV0Result,
} from './full-scan-compat.mts'
import { correlateMalwareResults } from './malware.mts'
import { SocketPurlClient } from './public-purl-client.mts'
import { fetchPurlRecords, streamBatchPurlRecords } from './purl.mts'
import type { PurlRecordTransform } from './purl.mts'
import type {
  OrgPurlQuery,
  PurlComponents,
  PurlFetchResult,
  PurlQuery,
  PurlRecord,
  PurlStreamOptions,
  PurlStreamResult,
} from './types/purl.mts'
import type { MalwareCheckEntry } from './types/malware.mts'

import {
  createSdkApiContext,
  requestSdkApi,
  validateSdkApiToken,
} from './api-client.mts'
import { handleSdkApiError } from './api-errors.mts'
import { executeSdkWithRetry } from './api-retry.mts'
import type { SdkApiContext } from './api-client.mts'

import {
  DEFAULT_CACHE_TTL,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_RETRIES,
  DEFAULT_RETRY_DELAY,
  publicPolicy,
  SOCKET_PUBLIC_API_TOKEN,
  SOCKET_PUBLIC_BLOB_STORE_URL,
} from './constants.mts'
import {
  createRequestBodyForBlobs,
  createRequestBodyForFilepaths,
  createUploadRequest,
} from './file-upload.mts'
import {
  assembleManifest,
  deriveApiV1BaseUrl,
  hashFile,
} from './full-scans-v1.mts'
import {
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
  getResponseJson,
  isResponseOk,
  reshapeArtifactForPublicPolicy,
  ResponseError,
} from './http-client.mts'
import {
  filterRedundantCause,
  normalizeBaseUrl,
  queryToSearchParams,
  resolveAbsPaths,
  resolveBasePath,
} from './utils.mts'
import { iterateNdjsonLines } from './utils/ndjson.mts'
import { pollCachedScan } from './utils/poll.mts'
import { bufferStreamedErrorResponse } from './utils/response-stream.mts'

import type {
  BatchPackageStreamOptions,
  CreateDependenciesSnapshotOptions,
  CustomResponseType,
  Entitlement,
  EntitlementsResponse,
  FileValidationCallback,
  GetOptions,
  PostOrgTelemetryPayload,
  PostOrgTelemetryResponse,
  QueryParams,
  RequestOptions,
  RequestOptionsWithHooks,
  SendOptions,
  SocketSdkErrorResult,
  SocketSdkGenericResult,
  SocketSdkOperations,
  SocketSdkOptions,
  SocketSdkResult,
  SocketSdkSuccessResult,
  StreamOrgFullScanOptions,
  UploadManifestFilesError,
  UploadManifestFilesOptions,
  UploadManifestFilesReturnType,
} from './types/core.mts'
import type {
  ArtifactPatches,
  GetPatchPackagesResponse,
  LookupPatchPackageResponse,
  PatchesBatchResponse,
  PatchPackageStatsResponse,
  PatchRecordsResponse,
  PatchSearchResponse,
  PatchViewResponse,
} from './types/patches.mts'
import type {
  CreateOrgRepoDiffOptions,
  GetOrgFullScanCsvOptions,
  GetOrgFullScanPdfOptions,
  HistoricalAlertsListOptions,
  HistoricalAlertsTrendOptions,
  HistoricalDependenciesTrendOptions,
  HistoricalSnapshotsListOptions,
  LicensePolicyViolations,
  UpdateOrgRepoLabelSettingBody,
} from './types/parity.mts'
import type {
  CreateFullScanOptions,
  DeleteRepositoryLabelResult,
  DeleteResult,
  FullScanItem,
  FullScanListResult,
  FullScanResult,
  GetRepositoryOptions,
  ListFullScansOptions,
  ListRepositoriesOptions,
  OrganizationsResult,
  RepositoriesListResult,
  RepositoryItem,
  RepositoryLabelItem,
  RepositoryLabelResult,
  RepositoryLabelsListResult,
  RepositoryResult,
  StrictErrorResult,
} from './types/strict.mts'
import type {
  AssembledManifest,
  BlobsUploadData,
  BlobUploadEntry,
  CreateFullScanFromManifestParams,
  CreateFullScanFromManifestResult,
  FullScanManifest,
  FullScanV1CreatedData,
  FullScanV1PendingData,
  ManifestLocalEntry,
  UploadBlobsResult,
} from './full-scans-v1.mts'
import type {
  PostEventsData,
  PostEventsResult,
  SocketEvent,
} from './events-v1.mts'
import type {
  GetThreatCampaignResult,
  ListThreatCampaignPackagesOptions,
  ListThreatCampaignPackagesResult,
  ListThreatCampaignsOptions,
  ListThreatCampaignsResult,
  ThreatCampaign,
  ThreatCampaignPackagesData,
  ThreatCampaignsListData,
} from './threat-campaigns-v1.mts'
import type { TtlCache } from '@socketsecurity/lib/cache/ttl/types'
import type { SocketSdkHttpResponse as HttpResponse } from './types/http.mts'
import type { SocketSdkJsonValue as JsonValue } from './types/util.mts'

const logger = getDefaultLogger()

let cachedAbortSignal: AbortSignal | undefined
export function getSdkAbortSignal(): AbortSignal {
  if (cachedAbortSignal === undefined) {
    cachedAbortSignal = getAbortSignal()
  }
  return cachedAbortSignal
}

/**
 * Socket SDK for programmatic access to Socket.dev security analysis APIs.
 * Provides methods for package scanning, organization management, and security
 * analysis.
 */
export class SocketSdk {
  readonly #apiContext: SdkApiContext
  readonly #apiV1BaseUrl: string | undefined
  readonly #apiToken: string
  readonly #baseUrl: string
  readonly #cache: TtlCache | undefined
  readonly #cacheByTtl: Map<number, TtlCache>
  readonly #cacheTtlConfig: SocketSdkOptions['cacheTtl']
  readonly #hooks: SocketSdkOptions['hooks']
  readonly #onFileValidation: FileValidationCallback | undefined
  readonly #pollIntervalMs: number
  readonly #reqOptions: RequestOptions
  readonly #reqOptionsWithHooks: RequestOptionsWithHooks
  readonly #retries: number
  readonly #retryDelay: number
  readonly #userAgent: string | undefined
  #v1FullScansUnavailable = false

  /**
   * Initialize Socket SDK with API token and configuration options. Sets up
   * authentication, base URL, HTTP client options, retry behavior, and
   * caching.
   */
  constructor(apiToken: string, options?: SocketSdkOptions | undefined) {
    const trimmedToken = validateSdkApiToken(apiToken)
    const {
      apiV1BaseUrl,
      signal,
      baseUrl = 'https://api.socket.dev/v0/',
      cache = false,
      cacheTtl,
      hooks,
      onFileValidation,
      pollIntervalMs = DEFAULT_POLL_INTERVAL,
      retries = DEFAULT_RETRIES,
      retryDelay = DEFAULT_RETRY_DELAY,
    } = { __proto__: null, ...options } as SocketSdkOptions

    this.#apiV1BaseUrl =
      apiV1BaseUrl === undefined ? undefined : normalizeBaseUrl(apiV1BaseUrl)
    this.#apiToken = trimmedToken
    this.#baseUrl = normalizeBaseUrl(baseUrl)
    this.#cacheTtlConfig = cacheTtl
    // For backward compatibility, if cacheTtl is a number, use it as default TTL.
    // If it's an object, use the default property or fallback to DEFAULT_CACHE_TTL.
    const defaultTtl =
      typeof cacheTtl === 'number'
        ? cacheTtl
        : (cacheTtl?.default ?? DEFAULT_CACHE_TTL)
    this.#cache = cache
      ? createTtlCache({
          memoize: true,
          prefix: 'socket-sdk',
          ttl: defaultTtl,
        })
      : /* c8 ignore next - cache disabled by default */ undefined
    // Map of TTL values to cache instances for per-endpoint caching.
    this.#cacheByTtl = new Map()
    this.#hooks = hooks
    this.#onFileValidation = onFileValidation
    this.#pollIntervalMs = pollIntervalMs
    this.#userAgent = options?.userAgent
    this.#retries = retries
    this.#retryDelay = retryDelay
    this.#apiContext = createSdkApiContext({
      ...options,
      apiToken: trimmedToken,
      baseUrl: this.#baseUrl,
      signal: signal ?? getSdkAbortSignal(),
    })
    this.#reqOptions = this.#apiContext.requestOptions
    this.#reqOptionsWithHooks = this.#apiContext.requestOptions
  }

  /**
   * Create standardized error result from query operation exceptions. Internal
   * error handling for non-throwing query API methods.
   */
  #createQueryErrorResult<T>(e: unknown): SocketSdkGenericResult<T> {
    if (e instanceof SyntaxError) {
      // Try to get response text from enhanced error, fall back to regex pattern for compatibility.
      const enhancedError = e as SyntaxError & {
        originalResponse?: string | undefined
      }
      let responseText = enhancedError.originalResponse || ''

      /* c8 ignore next 4 - c8 ignored: because getResponseJson always attaches originalResponse to SyntaxErrors; this regex fallback exists for third-party JSON parsers that may not */
      if (!responseText) {
        const match = e.message.match(/Invalid JSON response:\n([\s\S]*?)\n→/)
        responseText = match?.[1] || ''
      }

      const preview = responseText.slice(0, 100) || ''
      return {
        cause: `Please report this. JSON.parse threw an error over the following response: \`${StringPrototypeTrim(preview)}${responseText.length > 100 ? '…' : ''}\``,
        data: undefined,
        error: 'Server returned invalid JSON',
        status: 0,
        success: false,
      }
    }

    const errStr = e ? StringPrototypeTrim(getErrorMessage(e)) : ''
    return {
      cause: errStr || UNKNOWN_ERROR,
      data: undefined,
      error: 'API request failed',
      status: 0,
      success: false,
    }
  }

  /**
   * Execute an HTTP request with retry logic. Internal method for wrapping HTTP
   * operations with exponential backoff.
   */
  async #executeWithRetry<T>(
    operation: () => Promise<T>,
    signal?: AbortSignal | undefined,
  ): Promise<T> {
    return await executeSdkWithRetry(operation, {
      retries: this.#retries,
      retryDelay: this.#retryDelay,
      signal: signal ?? this.#reqOptions.signal,
    })
  }

  /**
   * Get the TTL for a specific endpoint. Returns endpoint-specific TTL if
   * configured, otherwise returns default TTL.
   */
  #getTtlForEndpoint(endpoint: string): number | undefined {
    const cacheTtl = this.#cacheTtlConfig
    if (typeof cacheTtl === 'number') {
      return cacheTtl
    }
    if (typeof cacheTtl === 'object' && cacheTtl !== null) {
      // Check for endpoint-specific TTL first.
      const endpointTtl = (cacheTtl as Record<string, number | undefined>)[
        endpoint
      ]
      if (typeof endpointTtl === 'number') {
        return endpointTtl
      }
      // Fall back to default.
      return cacheTtl.default
    }
    return undefined
  }

  /**
   * Get or create a cache instance with the specified TTL. Reuses existing
   * cache instances to avoid creating duplicates.
   */
  #getCacheForTtl(ttl: number): TtlCache {
    let cache = this.#cacheByTtl.get(ttl)
    if (!cache) {
      cache = createTtlCache({
        memoize: true,
        prefix: 'socket-sdk',
        ttl,
      })
      this.#cacheByTtl.set(ttl, cache)
    }
    return cache
  }

  /**
   * Execute a GET request with optional caching. Internal method for handling
   * cached GET requests with retry logic. Supports per-endpoint TTL
   * configuration.
   */
  async #getCached<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    endpointName?: string | undefined,
  ): Promise<T> {
    // If caching is disabled, just execute the request.
    if (!this.#cache) {
      return await this.#executeWithRetry(fetcher)
    }

    // Get endpoint-specific TTL if provided.
    const endpointTtl = endpointName
      ? this.#getTtlForEndpoint(endpointName)
      : undefined

    // Select the appropriate cache instance.
    // If endpoint has custom TTL, get/create cache for that TTL.
    // Otherwise use the default cache.
    const cacheToUse =
      endpointTtl !== undefined
        ? this.#getCacheForTtl(endpointTtl)
        : this.#cache

    // Use cache with retry logic.
    return await cacheToUse.getOrFetch(cacheKey, async () => {
      return await this.#executeWithRetry(fetcher)
    })
  }

  /**
   * Drive the cached-scan 200/202 polling loop for a GET url path. Each poll is
   * retry-wrapped (so 429/5xx still back off) and throws a ResponseError on a
   * non-2xx status; a 200 resolves with parsed JSON and a 202 keeps polling
   * until the result is ready or the wall-clock budget is exhausted. Internal
   * shared helper for getDiffScanById and getFullScan.
   */
  async #pollCachedScan(
    urlPath: string,
    label: string,
  ): Promise<JsonValue | undefined> {
    return await pollCachedScan({
      label,
      pollIntervalMs: this.#pollIntervalMs,
      requestFn: async () =>
        await this.#executeWithRetry(async () => {
          const response = await createGetRequest(
            this.#baseUrl,
            urlPath,
            this.#reqOptionsWithHooks,
          )
          // 202 Accepted is ok (2xx); let it through for the poll loop. Any
          // non-2xx throws so #executeWithRetry retries 429/5xx and 4xx
          // surfaces to the caller's catch.
          if (!isResponseOk(response)) {
            throw new ResponseError(response, '', urlPath)
          }
          return response
        }),
    })
  }

  /**
   * Handle API error responses and convert to standardized error result.
   * Internal error handling with status code analysis and message formatting.
   */
  async #handleApiError<T extends SocketSdkOperations>(
    error: unknown,
  ): Promise<SocketSdkErrorResult<T>> {
    return await handleSdkApiError(error)
  }

  /**
   * Handle successful API responses and convert to standardized success result.
   * Internal success handling with consistent response formatting.
   */
  #handleApiSuccess<T extends SocketSdkOperations>(
    data: unknown,
  ): SocketSdkSuccessResult<T> {
    return {
      cause: undefined,
      data: data as SocketSdkSuccessResult<T>['data'],
      error: undefined,
      // Use generic 200 OK status for all successful API responses.
      status: 200,
      success: true,
    } satisfies SocketSdkSuccessResult<T>
  }

  /**
   * Handle query API response data based on requested response type. Internal
   * method for processing different response formats (json, text, response).
   */
  async #handleQueryResponseData<T>(
    response: HttpResponse,
    responseType: CustomResponseType,
  ): Promise<T> {
    if (responseType === 'response') {
      return response as T
    }

    if (responseType === 'text') {
      return response.text() as T
    }

    if (responseType === 'json') {
      return (await getResponseJson(response)) as T
    }

    /* c8 ignore next - c8 ignored: because getApi always passes 'response', 'text', or 'json'; this is the default fallback for responseType='response' */
    return response as T
  }

  /**
   * Resolve the v1 API base URL for the v1 content-addressed full-scan and
   * blob endpoints. Throws when this SDK instance's configured base URL has
   * no known v1 counterpart.
   */
  #requireApiV1BaseUrl(): string {
    const v1BaseUrl = this.#apiV1BaseUrl ?? deriveApiV1BaseUrl(this.#baseUrl)
    if (v1BaseUrl === undefined) {
      throw new ErrorCtor(
        [
          'v1 endpoint requires a v1 base URL derived from this SDK instance.',
          `→ Where: baseUrl is "${this.#baseUrl}"`,
          `→ Saw: "${this.#baseUrl}"; wanted a base URL ending in "/v0/" (v1 is derived by swapping the trailing "v0/" for "v1/")`,
          '→ Fix: construct the SDK with the default "https://api.socket.dev/v0/" base, or a custom base whose version segment is "v0"',
        ].join('\n'),
      )
    }
    return v1BaseUrl
  }

  /**
   * Get metadata for a set of alert types. Accepts an array of alert type
   * identifiers and returns human-readable metadata for each, optionally
   * localized via the `language` query param.
   *
   * @param alertTypes - Alert type identifiers to look up.
   * @param options - Optional query params (e.g. `language`).
   *
   * @returns Metadata for the requested alert types.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /alert-types
   *
   * @quota 1 units
   *
   * @see https://docs.socket.dev/reference/alerttypes
   */
  async alertTypes(
    alertTypes: string[],
    options?: { language?: string | undefined } | undefined,
  ): Promise<SocketSdkResult<'alertTypes'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `alert-types?${queryToSearchParams(options as QueryParams)}`,
              alertTypes,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'alertTypes'>(data)
    } catch (e) {
      return await this.#handleApiError<'alertTypes'>(e)
    }
  }

  /**
   * Associate a repository with an organization repository label.
   *
   * @param orgSlug - Organization identifier.
   * @param labelId - Label identifier.
   * @param repositoryId - Repository identifier to associate with the label.
   *
   * @returns Association result.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/repos/labels/{label_id}/associate
   *
   * @quota 1 units
   *
   * @scopes repo-label:update
   *
   * @see https://docs.socket.dev/reference/associateorgrepolabel
   */
  async associateOrgRepoLabel(
    orgSlug: string,
    labelId: string,
    repositoryId: string,
  ): Promise<SocketSdkResult<'associateOrgRepoLabel'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels/${encodeURIComponent(labelId)}/associate`,
              { repository_id: repositoryId },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'associateOrgRepoLabel'>(data)
    } catch (e) {
      return await this.#handleApiError<'associateOrgRepoLabel'>(e)
    }
  }

  /**
   * Get package metadata and alerts by PURL strings for a specific
   * organization. Organization-scoped version of batchPackageFetch with
   * security policy label support.
   *
   * @example
   *   ```typescript
   *   const result = await sdk.batchOrgPackageFetch(
   *   'my-org',
   *   {
   *   components: [
   *   { purl: 'pkg:npm/express@4.19.2' },
   *   { purl: 'pkg:pypi/django@5.0.6' },
   *   ],
   *   },
   *   { labels: 'production', alerts: true },
   *   )
   *
   *   if (result.success) {
   *   for (const artifact of result.data) {
   *   console.log(`${artifact.name}@${artifact.version}`)
   *   }
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param componentsObj - Object containing array of components with PURL
   *   strings.
   * @param queryParams - Optional query parameters including labels, alerts,
   *   compact, etc.
   *
   * @returns Package metadata and alerts for the requested PURLs
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @operationId batchPackageFetchByOrg
   *
   * @apiEndpoint POST /orgs/{org_slug}/purl
   *
   * @quota 100 units
   *
   * @scopes packages:list
   *
   * @see https://docs.socket.dev/reference/batchpackagefetchbyorg
   */
  async batchOrgPackageFetch(
    orgSlug: string,
    componentsObj: PurlComponents,
    queryParams?: OrgPurlQuery | undefined,
  ): Promise<PurlFetchResult> {
    return await fetchPurlRecords(this.#apiContext, {
      path: createOrgApiPath(orgSlug, 'purl'),
      method: 'POST',
      body: componentsObj,
      query: queryParams,
    })
  }

  /**
   * Stream organization package analysis as records arrive.
   *
   * @operationId batchOrgPackageStream
   *
   * @quota 100 units
   *
   * @scopes packages:list
   */
  batchOrgPackageStream(
    orgSlug: string,
    componentsObj: PurlComponents,
    options?: PurlStreamOptions<OrgPurlQuery> | undefined,
  ): AsyncGenerator<PurlStreamResult> {
    return streamBatchPurlRecords(
      this.#apiContext,
      createOrgApiPath(orgSlug, 'purl'),
      componentsObj,
      options,
    )
  }

  /**
   * Fetch package analysis data for multiple packages in a single batch
   * request. Returns all results at once after processing is complete.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @operationId batchPackageFetch
   *
   * @quota 100 units
   *
   * @scopes packages:list
   */
  async batchPackageFetch(
    componentsObj: PurlComponents,
    queryParams?: PurlQuery | undefined,
  ): Promise<PurlFetchResult> {
    return await fetchPurlRecords(
      this.#apiContext,
      {
        path: 'purl',
        method: 'POST',
        body: componentsObj,
        query: queryParams,
      },
      this.#purlTransform(queryParams),
    )
  }

  /**
   * Stream package analysis data for multiple packages with chunked processing
   * and concurrency control. Returns results as they become available via async
   * generator.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @operationId batchPackageStream
   *
   * @quota 100 units
   *
   * @scopes packages:list
   */
  batchPackageStream(
    componentsObj: PurlComponents,
    options?: BatchPackageStreamOptions | undefined,
  ): AsyncGenerator<PurlStreamResult> {
    const opts = { __proto__: null, ...options } as typeof options
    return streamBatchPurlRecords(
      this.#apiContext,
      'purl',
      componentsObj,
      options,
      this.#purlTransform(opts?.queryParams),
    )
  }

  #purlTransform(
    queryParams?: PurlQuery | undefined,
  ): PurlRecordTransform | undefined {
    if (this.#apiToken !== SOCKET_PUBLIC_API_TOKEN) {
      return undefined
    }
    return record =>
      '_type' in record
        ? record
        : reshapeArtifactForPublicPolicy(record, {
            actions: queryParams?.actions,
            isAuthenticated: false,
            policy: publicPolicy,
          })
  }

  /**
   * Check every input PURL for malware. Incomplete analysis has an explicit
   * status.
   *
   * @operationId none
   */
  async checkMalware(
    components: Array<{ purl: string }>,
  ): Promise<SocketSdkGenericResult<MalwareCheckEntry[]>> {
    const client = new SocketPurlClient({
      hooks: this.#hooks,
      retries: this.#retries,
      retryDelay: this.#retryDelay,
      signal: this.#reqOptions.signal,
      timeout: this.#reqOptions.timeout,
      userAgent: this.#userAgent,
    })
    const records: PurlRecord[] = []
    for await (const result of client.batchPackageStream(
      { components },
      {
        queryParams: {
          alerts: true,
          purlErrors: true,
          cachedResultsOnly: true,
        },
      },
    )) {
      if (!result.success) {
        return result
      }
      records.push(result.data)
    }
    return {
      success: true,
      status: 200,
      data: correlateMalwareResults(components, records),
    }
  }

  /**
   * Create a snapshot of project dependencies by uploading manifest files.
   * Analyzes dependency files to generate a comprehensive security report.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 100 units
   *
   * @scopes report:write
   */
  async createDependenciesSnapshot(
    filepaths: string[],
    options?: CreateDependenciesSnapshotOptions | undefined,
  ): Promise<SocketSdkResult<'createDependenciesSnapshot'>> {
    const { pathsRelativeTo = '.', queryParams } = {
      __proto__: null,
      ...options,
    } as CreateDependenciesSnapshotOptions
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)

    // Validate file readability before upload.
    const { invalidPaths, validPaths } = validateFiles(absFilepaths)

    // If callback provided and files were invalid, invoke it.
    if (this.#onFileValidation && invalidPaths.length > 0) {
      const result = await this.#onFileValidation(validPaths, invalidPaths, {
        operation: 'createDependenciesSnapshot',
      })

      if (!result.shouldContinue) {
        const errorMsg = result.errorMessage ?? 'File validation failed'
        return {
          cause: filterRedundantCause(errorMsg, result.errorCause),
          data: undefined,
          error: errorMsg,
          status: 400,
          success: false,
        }
      }
    }

    // Default behavior if no callback: warn and continue.
    if (!this.#onFileValidation && invalidPaths.length > 0) {
      const samplePaths = invalidPaths.slice(0, 3).join('\n  - ')
      const remaining =
        invalidPaths.length > 3
          ? `\n  ... and ${invalidPaths.length - 3} more`
          : ''
      logger.warn(
        `Warning: ${invalidPaths.length} files skipped (unreadable):\n  - ${samplePaths}${remaining}\n` +
          '→ This may occur with Yarn Berry PnP or pnpm symlinks.\n' +
          '→ Try: Run installation command to ensure files are accessible.',
      )
    }

    // Fail if all files were invalid.
    if (validPaths.length === 0) {
      const samplePaths = invalidPaths.slice(0, 5).join('\n  - ')
      const remaining =
        invalidPaths.length > 5
          ? `\n  ... and ${invalidPaths.length - 5} more`
          : ''
      return {
        cause: [
          `All ${invalidPaths.length} files failed validation:`,
          `  - ${samplePaths}${remaining}`,
          '',
          '→ Common causes:',
          '  ·Yarn Berry PnP virtual filesystem (files are not on disk)',
          '  ·pnpm symlinks pointing to inaccessible locations',
          '  ·Incorrect file permissions',
          '  ·Files were deleted after discovery',
          '',
          '→ Solutions:',
          '  ·Yarn Berry: Use `nodeLinker: node-modules` in .yarnrc.yml',
          '  ·pnpm: Use `node-linker=hoisted` in .npmrc',
          '  ·Check file permissions with: ls -la <file>',
          '  ·Run package manager install command',
        ].join('\n'),
        data: undefined,
        error: 'No readable manifest files found',
        status: 400,
        success: false,
      }
    }

    // Continue with validated files.
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createUploadRequest(
              this.#baseUrl,
              `dependencies/upload?${queryToSearchParams(queryParams)}`,
              createRequestBodyForFilepaths(validPaths, basePath),
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'createDependenciesSnapshot'>(data)
    } catch (e) {
      return await this.#handleApiError<'createDependenciesSnapshot'>(e)
    }
  }

  /**
   * Create a full security scan for an organization.
   *
   * Uploads project manifest files and initiates full security analysis.
   * Returns scan metadata with guaranteed required fields.
   *
   * Transparently attempts the v1 content-addressed blob-cache path first; that
   * attempt may issue additional HTTP requests (manifest post, blob uploads)
   * before the scan is created, observable through the `onRequest`/`onResponse`
   * hooks, before falling back to the v0 multipart upload.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.createFullScan(
   *     'my-org',
   *     ['package.json', 'package-lock.json'],
   *     {
   *       repo: 'my-repo',
   *       branch: 'main',
   *       commit_message: 'Update dependencies',
   *       commit_hash: 'abc123',
   *       pathsRelativeTo: './my-project',
   *     },
   *   )
   *
   *   if (result.success) {
   *     console.log('Scan ID:', result.data.id)
   *     console.log('Report URL:', result.data.html_report_url)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param filepaths - Array of file paths to upload (package.json,
   *   package-lock.json, etc.)
   * @param options - Scan configuration including repository, branch, and
   *   commit details.
   *
   * @returns Full scan metadata including ID and URLs
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/full-scans
   *
   * @quota 1 units
   *
   * @scopes full-scans:create
   *
   * @see https://docs.socket.dev/reference/createorgfullscan
   */
  async createFullScan(
    orgSlug: string,
    filepaths: string[],
    options: CreateFullScanOptions,
  ): Promise<FullScanResult | StrictErrorResult> {
    const { pathsRelativeTo = '.', ...queryParams } = {
      __proto__: null,
      ...options,
    } as CreateFullScanOptions
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)

    // Validate file readability before upload.
    const { invalidPaths, validPaths } = validateFiles(absFilepaths)

    // If callback provided and files were invalid, invoke it.
    if (this.#onFileValidation && invalidPaths.length > 0) {
      const result = await this.#onFileValidation(validPaths, invalidPaths, {
        operation: 'createFullScan',
        orgSlug,
      })

      if (!result.shouldContinue) {
        const errorMsg = result.errorMessage ?? 'File validation failed'
        return {
          cause: filterRedundantCause(errorMsg, result.errorCause),
          data: undefined,
          error: errorMsg,
          status: 400,
          success: false,
        }
      }
    }

    // Default behavior if no callback: warn and continue.
    if (!this.#onFileValidation && invalidPaths.length > 0) {
      const samplePaths = invalidPaths.slice(0, 3).join('\n  - ')
      const remaining =
        invalidPaths.length > 3
          ? `\n  ... and ${invalidPaths.length - 3} more`
          : ''
      logger.warn(
        `Warning: ${invalidPaths.length} files skipped (unreadable):\n  - ${samplePaths}${remaining}\n` +
          '→ This may occur with Yarn Berry PnP or pnpm symlinks.\n' +
          '→ Try: Run installation command to ensure files are accessible.',
      )
    }

    // Fail if all files were invalid.
    if (validPaths.length === 0) {
      const samplePaths = invalidPaths.slice(0, 5).join('\n  - ')
      const remaining =
        invalidPaths.length > 5
          ? `\n  ... and ${invalidPaths.length - 5} more`
          : ''
      return {
        cause: [
          `All ${invalidPaths.length} files failed validation:`,
          `  - ${samplePaths}${remaining}`,
          '',
          '→ Common causes:',
          '  ·Yarn Berry PnP virtual filesystem (files are not on disk)',
          '  ·pnpm symlinks pointing to inaccessible locations',
          '  ·Incorrect file permissions',
          '  ·Files were deleted after discovery',
          '',
          '→ Solutions:',
          '  ·Yarn Berry: Use `nodeLinker: node-modules` in .yarnrc.yml',
          '  ·pnpm: Use `node-linker=hoisted` in .npmrc',
          '  ·Check file permissions with: ls -la <file>',
          '  ·Run package manager install command',
        ].join('\n'),
        data: undefined,
        error: 'No readable manifest files found',
        status: 400,
        success: false,
      }
    }

    // Try the v1 content-addressed manifest flow first; every failure mode
    // (unavailable route, unrepresentable path, retry exhaustion) falls back
    // to the v0 multipart upload below rather than surfacing to the caller.
    const v1Result = await this.#tryCreateFullScanViaManifest(
      orgSlug,
      validPaths,
      basePath,
      queryParams,
    )
    if (v1Result) {
      return v1Result
    }

    // Continue with validated files.
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createUploadRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/full-scans?${queryToSearchParams(queryParams as QueryParams)}`,
              createRequestBodyForFilepaths(validPaths, basePath),
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as FullScanItem,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'CreateOrgFullScan'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Attempt `createFullScan` via the v1 content-addressed manifest flow.
   * Returns the v0-shaped success envelope on a 201, or undefined when the
   * caller should fall back to the v0 multipart upload — an unavailable v1
   * route, a path the manifest can't represent, a genuine request error, or
   * retry exhaustion all fall back rather than surfacing to the caller, so
   * `createFullScan`'s caller-visible behavior never regresses.
   */
  async #tryCreateFullScanViaManifest(
    orgSlug: string,
    validPaths: string[],
    basePath: string,
    queryParams: QueryParams,
  ): Promise<FullScanResult | undefined> {
    if (this.#v1FullScansUnavailable) {
      return undefined
    }
    const v1BaseUrl = this.#apiV1BaseUrl ?? deriveApiV1BaseUrl(this.#baseUrl)
    if (v1BaseUrl === undefined) {
      return undefined
    }
    // The v1 body schema is `additionalProperties: false` — integration-linked
    // scans have no v1 equivalent yet, so they stay on v0.
    if (
      queryParams['integration_type'] !== undefined ||
      queryParams['integration_org_slug'] !== undefined
    ) {
      return undefined
    }

    try {
      const assembled = await assembleManifest(basePath, validPaths)
      if (assembled.skipped.length > 0 || assembled.entries.length === 0) {
        debugLog(
          'createFullScan:v1',
          `manifest cannot represent every path (${assembled.skipped.length} skipped) — falling back to v0`,
        )
        return undefined
      }

      return await this.#submitFullScanManifest(orgSlug, assembled, queryParams)
    } catch (e) {
      debugLog(
        'createFullScan:v1',
        `unexpected error in the v1 manifest flow — falling back to v0: ${getErrorMessage(e)}`,
      )
      return undefined
    }
  }

  async #submitFullScanManifest(
    orgSlug: string,
    assembled: AssembledManifest,
    queryParams: QueryParams,
  ): Promise<FullScanResult | undefined> {
    const params = createFullScanManifestParams(queryParams)
    const repo = params.repo
    const workspace = params.workspace

    const entriesByRelPath = new Map(
      assembled.entries.map(entry => [entry.relPath, entry]),
    )

    let previousMissingHashes: Set<string> | undefined
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await this.createFullScanFromManifest(
        orgSlug,
        assembled.manifest,
        params,
      )

      if (!result.success) {
        if (result.status === 404) {
          this.#v1FullScansUnavailable = true
          debugLog(
            'createFullScan:v1',
            `v1 full-scans route is unavailable (404) — memoizing and falling back to v0: ${result.error}`,
          )
        } else {
          debugLog(
            'createFullScan:v1',
            `v1 full-scans create failed (status ${result.status}) — falling back to v0: ${result.error}`,
          )
        }
        return undefined
      }

      if (result.status === 201) {
        const created = result.data
        return createFullScanV0Result(created, orgSlug, repo, workspace)
      }

      const { missing } = result.data
      const missingHashes = new Set(missing.map(m => m.hash))
      const previous = previousMissingHashes
      if (
        previous !== undefined &&
        missingHashes.size === previous.size &&
        Array.from(missingHashes).every(hash => previous.has(hash))
      ) {
        debugLog(
          'createFullScan:v1',
          'no progress across manifest retries (same blobs still missing) — falling back to v0',
        )
        return undefined
      }
      previousMissingHashes = missingHashes

      const missingEntries: ManifestLocalEntry[] = []
      for (let i = 0, { length } = missing; i < length; i += 1) {
        const missingBlob = missing[i]!
        const entry = entriesByRelPath.get(missingBlob.path)
        if (!entry) {
          debugLog(
            'createFullScan:v1',
            `server reported a missing blob with no local match ("${missingBlob.path}") — falling back to v0`,
          )
          return undefined
        }
        missingEntries.push(entry)
      }

      const uploadResult = await this.uploadBlobs(
        orgSlug,
        missingEntries.map(entry => ({
          __proto__: null,
          hash: entry.hash,
          localPath: entry.absPath,
          name: entry.relPath,
        })),
      )
      if (!uploadResult.success) {
        debugLog(
          'createFullScan:v1',
          `blob upload failed (status ${uploadResult.status}) — falling back to v0: ${uploadResult.error}`,
        )
        return undefined
      }
    }

    debugLog(
      'createFullScan:v1',
      'exhausted manifest retry attempts without a 201 — falling back to v0',
    )
    return undefined
  }

  /**
   * Create a full scan from a pre-built content-addressed manifest (v1 API,
   * internal preview — hidden from the public OpenAPI spec). A 201 means the
   * scan was created outright; a 202 means one or more manifest entries are
   * unknown to the org's blob store — upload the blobs named in
   * `data.missing` via `uploadBlobs`, then re-post the same manifest.
   *
   * @param orgSlug - Organization identifier.
   * @param manifest - Content-addressed manifest (see `assembleManifest`).
   * @param params - Scan metadata; only defined keys are sent.
   *
   * @returns 201 full-scan details, or 202 with the blob-presence breakdown
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/full-scans (v1)
   *
   * @operationId none
   */
  async createFullScanFromManifest(
    orgSlug: string,
    manifest: FullScanManifest,
    params: CreateFullScanFromManifestParams,
  ): Promise<CreateFullScanFromManifestResult | StrictErrorResult> {
    let v1BaseUrl: string
    try {
      v1BaseUrl = this.#requireApiV1BaseUrl()
    } catch (e) {
      return {
        cause: undefined,
        data: undefined,
        error: getErrorMessage(e),
        status: 400,
        success: false,
      }
    }

    try {
      const response = await this.#executeWithRetry(async () => {
        const res = await createRequestWithJson(
          'POST',
          v1BaseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans`,
          { manifest, ...params },
          this.#reqOptionsWithHooks,
        )
        if (!isResponseOk(res)) {
          throw new ResponseError(
            res,
            '',
            `${v1BaseUrl}orgs/${encodeURIComponent(orgSlug)}/full-scans`,
          )
        }
        return res
      })
      const data = await getResponseJson(response)
      if (response.status === 202) {
        return {
          cause: undefined,
          data: data as FullScanV1PendingData,
          error: undefined,
          status: 202,
          success: true,
        }
      }
      return {
        cause: undefined,
        data: data as FullScanV1CreatedData,
        error: undefined,
        status: 201,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<never>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Create a diff scan from two full scan IDs. Compares two existing full scans
   * to identify changes.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.createOrgDiffScanFromIds('my-org', {
   *     before: 'scan-id-1',
   *     after: 'scan-id-2',
   *     description: 'Compare versions',
   *     merge: false,
   *   })
   *
   *   if (result.success) {
   *     console.log('Diff scan created:', result.data.diff_scan.id)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param options - Diff scan creation options.
   * @param options.after - ID of the after/head full scan (newer)
   * @param options.before - ID of the before/base full scan (older)
   * @param options.description - Description of the diff scan.
   * @param options.external_href - External URL to associate with the diff
   *   scan.
   * @param options.merge - Set true for merged commits, false for open PR
   *   diffs.
   * @param options.on_duplicate - Set to "redirect" to receive a 302 redirect
   *   to the existing diff scan instead of a 409 error when a duplicate is
   *   detected.
   *
   * @returns Diff scan details
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/diff-scans/from-ids
   *
   * @quota 1 units
   *
   * @scopes diff-scans:create, full-scans:list
   *
   * @see https://docs.socket.dev/reference/createorgdiffscanfromids
   */
  async createOrgDiffScanFromIds(
    orgSlug: string,
    options: {
      after: string
      before: string
      description?: string | undefined
      external_href?: string | undefined
      merge?: boolean | undefined
      on_duplicate?: string | undefined
    },
  ): Promise<SocketSdkResult<'createOrgDiffScanFromIds'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/diff-scans/from-ids?${queryToSearchParams(options)}`,
              {},
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'createOrgDiffScanFromIds'>(data)
    } catch (e) {
      return await this.#handleApiError<'createOrgDiffScanFromIds'>(e)
    }
  }

  /**
   * Create a full scan from an archive file (.tar, .tar.gz/.tgz, or .zip).
   * Uploads and scans a compressed archive of project files.
   *
   * @param orgSlug - Organization identifier.
   * @param archivePath - Path to the archive file to upload.
   * @param options - Scan configuration options including repo, branch, and
   *   metadata.
   *
   * @returns Created full scan details with scan ID and status
   *
   * @throws {Error} When server returns 5xx status codes or file cannot be read
   *
   * @quota 1 units
   *
   * @scopes full-scans:create
   */
  async createOrgFullScanFromArchive(
    orgSlug: string,
    archivePath: string,
    options: {
      branch?: string | undefined
      commit_hash?: string | undefined
      commit_message?: string | undefined
      committers?: string | undefined
      integration_org_slug?: string | undefined
      integration_type?:
        | 'api'
        | 'azure'
        | 'bitbucket'
        | 'github'
        | 'gitlab'
        | 'web'
        | undefined
      make_default_branch?: boolean | undefined
      pull_request?: number | undefined
      repo: string
      scan_type?: string | undefined
      set_as_pending_head?: boolean | undefined
      tmp?: boolean | undefined
      workspace?: string | undefined
    },
  ): Promise<SocketSdkResult<'CreateOrgFullScanArchive'>> {
    const basePath = path.dirname(archivePath)
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createUploadRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/full-scans/archive?${queryToSearchParams(options as QueryParams)}`,
              createRequestBodyForFilepaths([archivePath], basePath),
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'CreateOrgFullScanArchive'>(data)
    } catch (e) {
      return await this.#handleApiError<'CreateOrgFullScanArchive'>(e)
    }
  }

  /**
   * Create a diff scan between a repository's current HEAD full scan and a new
   * full scan built from the uploaded manifest files. Returns metadata about
   * the new full scan and the diff scan.
   *
   * @param orgSlug - Organization identifier.
   * @param repoSlug - Repository slug whose HEAD full scan is the diff base.
   * @param filepaths - Manifest file paths to upload as the new full scan.
   * @param options - Diff scan metadata (branch, commit, PR, etc.) and
   *   `pathsRelativeTo` controlling how the file paths are resolved.
   *
   * @returns Created full scan and diff scan details.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/diff-scans/from-repo/{repo_slug}
   *
   * @quota 1 units
   *
   * @scopes repo:list, diff-scans:create, full-scans:create
   *
   * @see https://docs.socket.dev/reference/createorgrepodiff
   */
  async createOrgRepoDiff(
    orgSlug: string,
    repoSlug: string,
    filepaths: string[],
    options?: CreateOrgRepoDiffOptions | undefined,
  ): Promise<SocketSdkResult<'createOrgRepoDiff'>> {
    const { pathsRelativeTo = '.', ...queryParams } = {
      __proto__: null,
      ...options,
    } as CreateOrgRepoDiffOptions
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)

    // Validate file readability before upload. Unlike createFullScan this does
    // not invoke the onFileValidation callback: that callback's operation union
    // is scoped to the manifest-upload methods, and widening a shared type for
    // one method would be the wrong boundary. All-invalid still fails clearly.
    const { invalidPaths, validPaths } = validateFiles(absFilepaths)
    if (validPaths.length === 0) {
      return {
        cause: `All ${invalidPaths.length} manifest files failed validation`,
        data: undefined,
        error: 'No readable manifest files found',
        status: 400,
        success: false,
      }
    }

    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createUploadRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/diff-scans/from-repo/${encodeURIComponent(repoSlug)}?${queryToSearchParams(queryParams as QueryParams)}`,
              createRequestBodyForFilepaths(validPaths, basePath),
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'createOrgRepoDiff'>(data)
    } catch (e) {
      return await this.#handleApiError<'createOrgRepoDiff'>(e)
    }
  }

  /**
   * Create a new webhook for an organization. Webhooks allow you to receive
   * HTTP POST notifications when specific events occur.
   *
   * @param orgSlug - Organization identifier.
   * @param webhookData - Webhook configuration including name, URL, secret, and
   *   events.
   *
   * @returns Created webhook details including webhook ID
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes webhooks:create
   */
  async createOrgWebhook(
    orgSlug: string,
    webhookData: {
      description?: null | string | undefined
      events: string[]
      filters?: { repositoryIds: null | string[] } | null | undefined
      headers?: null | Record<string, unknown> | undefined
      name: string
      secret: string
      url: string
    },
  ): Promise<SocketSdkResult<'createOrgWebhook'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/webhooks`,
              webhookData,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'createOrgWebhook'>(data)
    } catch (e) {
      return await this.#handleApiError<'createOrgWebhook'>(e)
    }
  }

  /**
   * Create a new repository in an organization.
   *
   * Registers a repository for monitoring and security scanning.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.createRepository('my-org', 'my-repo', {
   *     description: 'My project repository',
   *     homepage: 'https://example.com',
   *     visibility: 'private',
   *   })
   *
   *   if (result.success) {
   *     console.log('Repository created:', result.data.id)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param repoSlug - Repository name/slug.
   * @param params - Additional repository configuration.
   * @param params.archived - Whether the repository is archived.
   * @param params.default_branch - Default branch of the repository.
   * @param params.description - Description of the repository.
   * @param params.homepage - Homepage URL of the repository.
   * @param params.visibility - Visibility setting ('public' or 'private')
   * @param params.workspace - Workspace of the repository.
   *
   * @returns Created repository details
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/repos
   *
   * @quota 1 units
   *
   * @scopes repo:create
   *
   * @see https://docs.socket.dev/reference/createorgrepo
   */
  async createRepository(
    orgSlug: string,
    repoSlug: string,
    params?:
      | {
          archived?: boolean | undefined
          default_branch?: null | string | undefined
          description?: null | string | undefined
          homepage?: null | string | undefined
          visibility?: 'private' | 'public' | undefined
          workspace?: string | undefined
        }
      | undefined,
  ): Promise<RepositoryResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos`,
              { ...params, name: repoSlug },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as RepositoryItem,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'createOrgRepo'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Create a new repository label for an organization.
   *
   * Labels can be used to group and organize repositories and apply
   * security/license policies.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.createRepositoryLabel('my-org', {
   *     name: 'production',
   *   })
   *
   *   if (result.success) {
   *     console.log('Label created:', result.data.id)
   *     console.log('Label name:', result.data.name)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param labelData - Label configuration (must include name property)
   *
   * @returns Created label with guaranteed id and name fields
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/repos/labels
   *
   * @quota 1 units
   *
   * @scopes repo-label:create
   *
   * @see https://docs.socket.dev/reference/createorgrepolabel
   */
  async createRepositoryLabel(
    orgSlug: string,
    labelData: QueryParams,
  ): Promise<RepositoryLabelResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels`,
              labelData,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as RepositoryLabelItem,
        error: undefined,
        status: 201,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'createOrgRepoLabel'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Delete a full scan from an organization.
   *
   * Permanently removes scan data and results.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.deleteFullScan('my-org', 'scan_123')
   *
   *   if (result.success) {
   *     console.log('Scan deleted successfully')
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param scanId - Full scan identifier to delete.
   *
   * @returns Success confirmation
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint DELETE /orgs/{org_slug}/full-scans/{full_scan_id}
   *
   * @quota 1 units
   *
   * @scopes full-scans:delete
   *
   * @see https://docs.socket.dev/reference/deleteorgfullscan
   */
  async deleteFullScan(
    orgSlug: string,
    scanId: string,
  ): Promise<DeleteResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createDeleteRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(scanId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as DeleteResult['data'],
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'deleteOrgFullScan'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Delete an alert resolution by UUID. Once deleted, alerts previously
   * hidden by this resolution reappear after the next org snapshot.
   *
   * @param orgSlug - Organization identifier.
   * @param uuid - UUID of the alert resolution to delete.
   *
   * @returns Success confirmation
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint DELETE /orgs/{org_slug}/alerts/resolutions/{uuid}
   *
   * @quota 1 units
   *
   * @scopes alert-resolution:delete
   */
  async deleteOrgAlertResolution(
    orgSlug: string,
    uuid: string,
  ): Promise<SocketSdkResult<'deleteOrgAlertResolution'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createDeleteRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/alerts/resolutions/${encodeURIComponent(uuid)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'deleteOrgAlertResolution'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgAlertResolution'>(e)
    }
  }

  /**
   * Delete a triage entry for a specific alert in an organization. Removes the
   * triage record identified by its UUID.
   *
   * @param orgSlug - Organization identifier.
   * @param uuid - Alert triage UUID to delete.
   *
   * @returns Deletion result.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint DELETE /orgs/{org_slug}/triage/alerts/{uuid}
   *
   * @quota 1 units
   *
   * @scopes triage:alerts-update
   *
   * @see https://docs.socket.dev/reference/deleteorgalerttriage
   */
  async deleteOrgAlertTriage(
    orgSlug: string,
    uuid: string,
  ): Promise<SocketSdkResult<'deleteOrgAlertTriage'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createDeleteRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/triage/alerts/${encodeURIComponent(uuid)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'deleteOrgAlertTriage'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgAlertTriage'>(e)
    }
  }

  /**
   * Delete a diff scan from an organization. Permanently removes diff scan data
   * and results.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes diff-scans:delete
   */
  async deleteOrgDiffScan(
    orgSlug: string,
    diffScanId: string,
  ): Promise<SocketSdkResult<'deleteOrgDiffScan'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createDeleteRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/diff-scans/${encodeURIComponent(diffScanId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'deleteOrgDiffScan'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgDiffScan'>(e)
    }
  }

  /**
   * Delete a single setting from a repository label.
   *
   * @param orgSlug - Organization identifier.
   * @param labelId - Label identifier.
   * @param settingKey - Key of the label setting to delete.
   *
   * @returns Deletion result.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint DELETE
   *   /orgs/{org_slug}/repos/labels/{label_id}/label-setting
   *
   * @quota 1 units
   *
   * @scopes repo-label:update
   *
   * @see https://docs.socket.dev/reference/deleteorgrepolabelsetting
   */
  async deleteOrgRepoLabelSetting(
    orgSlug: string,
    labelId: string,
    settingKey: string,
  ): Promise<SocketSdkResult<'deleteOrgRepoLabelSetting'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createDeleteRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels/${encodeURIComponent(labelId)}/label-setting?${queryToSearchParams({ setting_key: settingKey })}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'deleteOrgRepoLabelSetting'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgRepoLabelSetting'>(e)
    }
  }

  /**
   * Delete a webhook from an organization. This will stop all future webhook
   * deliveries to the webhook URL.
   *
   * @param orgSlug - Organization identifier.
   * @param webhookId - Webhook ID to delete.
   *
   * @returns Success status
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes webhooks:delete
   */
  async deleteOrgWebhook(
    orgSlug: string,
    webhookId: string,
  ): Promise<SocketSdkResult<'deleteOrgWebhook'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createDeleteRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/webhooks/${encodeURIComponent(webhookId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'deleteOrgWebhook'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgWebhook'>(e)
    }
  }

  /**
   * Delete a repository from an organization.
   *
   * Removes repository monitoring and associated scan data.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.deleteRepository('my-org', 'old-repo')
   *
   *   if (result.success) {
   *     console.log('Repository deleted')
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param repoSlug - Repository slug/name to delete.
   * @param options - Optional parameters including workspace.
   *
   * @returns Success confirmation
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint DELETE /orgs/{org_slug}/repos/{repo_slug}
   *
   * @quota 1 units
   *
   * @scopes repo:delete
   *
   * @see https://docs.socket.dev/reference/deleteorgrepo
   */
  async deleteRepository(
    orgSlug: string,
    repoSlug: string,
    options?: GetRepositoryOptions | undefined,
  ): Promise<DeleteResult | StrictErrorResult> {
    const { workspace } = {
      __proto__: null,
      ...options,
    } as GetRepositoryOptions
    const queryString = workspace
      ? `?${queryToSearchParams({ workspace } as QueryParams)}`
      : ''
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createDeleteRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}${queryString}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as DeleteResult['data'],
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'deleteOrgRepo'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Delete a repository label from an organization.
   *
   * Removes label and all its associations (repositories, security policy,
   * license policy, etc.).
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.deleteRepositoryLabel('my-org', 'label-id-123')
   *
   *   if (result.success) {
   *     console.log('Label deleted:', result.data.status)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param labelId - Label identifier.
   *
   * @returns Deletion confirmation
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint DELETE /orgs/{org_slug}/repos/labels/{label_id}
   *
   * @quota 1 units
   *
   * @scopes repo-label:delete
   *
   * @see https://docs.socket.dev/reference/deleteorgrepolabel
   */
  async deleteRepositoryLabel(
    orgSlug: string,
    labelId: string,
  ): Promise<DeleteRepositoryLabelResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createDeleteRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels/${encodeURIComponent(labelId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as DeleteRepositoryLabelResult['data'],
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'deleteOrgRepoLabel'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Disassociate a repository from an organization repository label.
   *
   * @param orgSlug - Organization identifier.
   * @param labelId - Label identifier.
   * @param repositoryId - Repository identifier to disassociate from the label.
   *
   * @returns Disassociation result.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/repos/labels/{label_id}/disassociate
   *
   * @quota 1 units
   *
   * @scopes repo-label:update
   *
   * @see https://docs.socket.dev/reference/disassociateorgrepolabel
   */
  async disassociateOrgRepoLabel(
    orgSlug: string,
    labelId: string,
    repositoryId: string,
  ): Promise<SocketSdkResult<'disassociateOrgRepoLabel'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels/${encodeURIComponent(labelId)}/disassociate`,
              { repository_id: repositoryId },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'disassociateOrgRepoLabel'>(data)
    } catch (e) {
      return await this.#handleApiError<'disassociateOrgRepoLabel'>(e)
    }
  }

  /**
   * Download full scan files as a tar archive.
   *
   * Streams the full scan file contents to the specified output path as a tar
   * file. Includes size limit enforcement to prevent excessive disk usage.
   *
   * @param orgSlug - Organization identifier.
   * @param fullScanId - Full scan identifier.
   * @param outputPath - Local file path to write the tar archive.
   *
   * @returns Download result with success/error status
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes full-scans:list
   */
  async downloadOrgFullScanFilesAsTar(
    orgSlug: string,
    fullScanId: string,
    outputPath: string,
  ): Promise<SocketSdkResult<'downloadOrgFullScanFilesAsTar'>> {
    try {
      const res = await requestSdkApi(this.#apiContext, {
        path: createOrgApiPath(
          orgSlug,
          'full-scans',
          fullScanId,
          'files',
          'tar',
        ),
        stream: true,
      })

      // Stream response directly to file. Use pipeline() so errors from the
      // source response stream propagate (a bare .pipe() leaves the source
      // without an 'error' listener and crashes the process on network
      // failure).
      const { createWriteStream } = await import('node:fs')
      const { pipeline } = await import('node:stream/promises')
      await pipeline(res.rawResponse!, createWriteStream(outputPath))

      return this.#handleApiSuccess<'downloadOrgFullScanFilesAsTar'>(res)
    } catch (e) {
      return await this.#handleApiError<'downloadOrgFullScanFilesAsTar'>(e)
    }
  }

  /**
   * Download patch file content from Socket blob storage. Retrieves patched
   * file contents using SSRI hash or hex hash.
   *
   * This is a low-level utility method - you'll typically use this after
   * calling `viewPatch()` to get patch metadata, then download individual
   * patched files.
   *
   * @example
   *   ;```typescript
   *   const sdk = new SocketSdk('your-api-token')
   *   // First get patch metadata
   *   const patch = await sdk.viewPatch('my-org', 'patch-uuid')
   *   // Then download the actual patched file
   *   const fileContent = await sdk.downloadPatch(
   *     patch.files['index.js'].socketBlob,
   *   )
   *   ```
   *
   * @param hash - The blob hash in SSRI (sha256-base64) or hex format.
   * @param options - Optional configuration.
   * @param options.baseUrl - Override blob store URL (for testing)
   *
   * @returns Promise<string> - The patch file content as UTF-8 string
   *
   * @throws Error if blob not found (404) or download fails
   *
   * @operationId none
   */
  async downloadPatch(
    hash: string,
    options?: { baseUrl?: string | undefined } | undefined,
  ): Promise<string> {
    options = { __proto__: null, ...options } as typeof options
    const blobPath = `/blob/${encodeURIComponent(hash)}`
    const blobBaseUrl = options?.baseUrl || SOCKET_PUBLIC_BLOB_STORE_URL
    const url = `${blobBaseUrl}${blobPath}`
    // 50MB limit
    const MAX_PATCH_SIZE = 50 * 1024 * 1024

    const res = await createGetRequest(blobBaseUrl, blobPath, {
      hooks: this.#hooks,
      maxResponseSize: MAX_PATCH_SIZE,
      signal: this.#reqOptions.signal,
      timeout: this.#reqOptions.timeout,
    })

    if (res.status === 404) {
      const message = [
        `Blob not found: ${hash}`,
        `→ URL: ${url}`,
        '→ The patch file may have expired or the hash is incorrect.',
        '→ Verify: The blob hash is correct.',
        '→ Note: Blob URLs may expire after a certain time period.',
      ].join('\n')
      throw new ErrorCtor(message)
    }
    if (res.status !== 200) {
      const message = [
        `Failed to download blob: ${res.status} ${res.statusText}`,
        `→ Hash: ${hash}`,
        `→ URL: ${url}`,
        '→ The blob storage service may be temporarily unavailable.',
        res.status >= 500
          ? '→ Try: Retry the download after a short delay.'
          : '→ Verify: The blob hash and URL are correct.',
      ].join('\n')
      throw new ErrorCtor(message)
    }

    return res.text()
  }

  /**
   * Export scan results in CycloneDX SBOM format. Returns Software Bill of
   * Materials compliant with CycloneDX standard.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes report:read
   */
  async exportCDX(
    orgSlug: string,
    fullScanId: string,
  ): Promise<SocketSdkResult<'exportCDX'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/export/cdx/${encodeURIComponent(fullScanId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'exportCDX'>(data)
    } catch (e) {
      return await this.#handleApiError<'exportCDX'>(e)
    }
  }

  /**
   * Export vulnerability exploitability data as an OpenVEX v0.2.0 document.
   * Includes patch data and reachability analysis for vulnerability
   * assessment.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.exportOpenVEX('my-org', 'scan-id', {
   *     author: 'Security Team',
   *     role: 'VEX Generator',
   *   })
   *
   *   if (result.success) {
   *     console.log('VEX Version:', result.data.version)
   *     console.log('Statements:', result.data.statements.length)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param id - Full scan or SBOM report ID.
   * @param options - Optional parameters including author, role, and
   *   document_id.
   *
   * @returns OpenVEX document with vulnerability exploitability information
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/export/openvex/{id}
   *
   * @quota 1 units
   *
   * @scopes report:read
   *
   * @see https://docs.socket.dev/reference/exportopenvex
   */
  async exportOpenVEX(
    orgSlug: string,
    id: string,
    options?:
      | {
          author?: string | undefined
          document_id?: string | undefined
          role?: string | undefined
        }
      | undefined,
  ): Promise<SocketSdkResult<'exportOpenVEX'>> {
    const queryString = options
      ? `?${queryToSearchParams(options as QueryParams)}`
      : ''
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/export/openvex/${encodeURIComponent(id)}${queryString}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'exportOpenVEX'>(data)
    } catch (e) {
      return await this.#handleApiError<'exportOpenVEX'>(e)
    }
  }

  /**
   * Export scan results in SPDX SBOM format. Returns Software Bill of Materials
   * compliant with SPDX standard.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes report:read
   */
  async exportSPDX(
    orgSlug: string,
    fullScanId: string,
  ): Promise<SocketSdkResult<'exportSPDX'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/export/spdx/${encodeURIComponent(fullScanId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'exportSPDX'>(data)
    } catch (e) {
      return await this.#handleApiError<'exportSPDX'>(e)
    }
  }

  /**
   * Execute a raw GET request to any API endpoint with configurable response
   * type. Supports both throwing (default) and non-throwing modes.
   *
   * @param urlPath - API endpoint path (e.g., 'organizations')
   * @param options - Request options including responseType and throws
   *   behavior.
   *
   * @returns Raw response, parsed data, or SocketSdkGenericResult based on
   *   options.
   *
   * @operationId getApi
   *
   * @quota 0 units
   */
  async getApi<T = HttpResponse>(
    urlPath: string,
    options?: GetOptions | undefined,
  ): Promise<T | SocketSdkGenericResult<T>> {
    const { responseType = 'response', throws = true } = {
      __proto__: null,
      ...options,
    } as GetOptions

    const url = `${this.#baseUrl}${urlPath}`
    try {
      const response = await this.#executeWithRetry(async () => {
        const res = await createGetRequest(
          this.#baseUrl,
          urlPath,
          this.#reqOptionsWithHooks,
        )
        // Check for HTTP error status codes first.
        if (!isResponseOk(res)) {
          throw new ResponseError(res, '', url)
        }
        return res
      })

      const data = await this.#handleQueryResponseData<T>(
        response,
        responseType,
      )

      if (throws) {
        return data
      }

      return {
        cause: undefined,
        data,
        error: undefined,
        status: response.status,
        success: true,
      }
    } catch (e) {
      if (throws) {
        throw e
      }

      if (e instanceof ResponseError) {
        // Re-use existing error handling logic from the SDK
        const errorResult = await this.#handleApiError<never>(e)
        return {
          cause: errorResult.cause,
          data: undefined,
          error: errorResult.error,
          status: errorResult.status,
          success: false,
          url: errorResult.url,
        }
      }

      return this.#createQueryErrorResult<T>(e)
    }
  }

  /**
   * Get list of API tokens for an organization. Returns organization API tokens
   * with metadata and permissions.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 10 units
   *
   * @scopes api-tokens:list
   */
  async getAPITokens(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getAPITokens'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/api-tokens`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getAPITokens'>(data)
    } catch (e) {
      return await this.#handleApiError<'getAPITokens'>(e)
    }
  }

  /**
   * Retrieve audit log events for an organization. Returns chronological log of
   * security and administrative actions.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes audit-log:list
   */
  async getAuditLogEvents(
    orgSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'getAuditLogEvents'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/audit-log?${queryToSearchParams(queryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getAuditLogEvents'>(data)
    } catch (e) {
      return await this.#handleApiError<'getAuditLogEvents'>(e)
    }
  }

  /**
   * Get details for a specific diff scan. Returns comparison between two full
   * scans with artifact changes.
   *
   * Reads from the immutable cached-scan store by default (`cached: true`). On
   * a cache miss the API returns 202 Accepted and computes the result in the
   * background; this method polls transparently until the result is ready, so
   * callers only ever observe the final comparison. Pass `cached: false` to
   * bypass the cache and live-compute the diff (slower, for debugging). When
   * `cached` is true the `omit_license_details` option is ignored server-side —
   * cached results always include license details.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.getDiffScanById('my-org', 'diff-scan-id')
   *
   *   if (result.success) {
   *     console.log(result.data.diff_scan.artifacts.added)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param diffScanId - Diff scan identifier.
   * @param options - Optional query parameters.
   * @param options.cached - Read cached immutable results (defaults to true).
   * @param options.omit_license_details - Omit license details (ignored when
   *   cached).
   * @param options.omit_unchanged - Omit unchanged artifacts from the response.
   *
   * @returns Diff scan comparison with artifact changes
   *
   * @throws {Error} When server returns 5xx status codes or polling times out
   *
   * @apiEndpoint GET /orgs/{org_slug}/diff-scans/{diff_scan_id}
   *
   * @quota 1 units
   *
   * @scopes diff-scans:list
   *
   * @see https://docs.socket.dev/reference/getdiffscanbyid
   */
  async getDiffScanById(
    orgSlug: string,
    diffScanId: string,
    options?:
      | {
          cached?: boolean | undefined
          omit_license_details?: boolean | undefined
          omit_unchanged?: boolean | undefined
        }
      | undefined,
  ): Promise<SocketSdkResult<'getDiffScanById'>> {
    const { cached = true, ...rest } = { __proto__: null, ...options } as {
      cached?: boolean | undefined
    } & QueryParams
    // Omit the cached param when disabled: an absent param reads as false
    // server-side, so there's no reason to send cached=false on the wire.
    const queryParams = {
      __proto__: null,
      ...(cached ? { cached: true } : undefined),
      ...rest,
    } as QueryParams
    const urlPath = `orgs/${encodeURIComponent(orgSlug)}/diff-scans/${encodeURIComponent(diffScanId)}?${queryToSearchParams(queryParams)}`
    try {
      const data = await this.#pollCachedScan(urlPath, diffScanId)
      return this.#handleApiSuccess<'getDiffScanById'>(data)
    } catch (e) {
      return await this.#handleApiError<'getDiffScanById'>(e)
    }
  }

  /**
   * Get GitHub-flavored markdown comments for a diff scan. Returns dependency
   * overview and alert comments suitable for pull requests.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.getDiffScanGfm('my-org', 'diff-scan-id')
   *
   *   if (result.success) {
   *     console.log(result.data.dependency_overview_comment)
   *     console.log(result.data.dependency_alert_comment)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param diffScanId - Diff scan identifier.
   * @param options - Optional query parameters.
   * @param options.github_installation_id - GitHub installation ID for
   *   settings.
   *
   * @returns Diff scan metadata with formatted markdown comments
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/diff-scans/{diff_scan_id}/gfm
   *
   * @quota 1 units
   *
   * @scopes diff-scans:list
   *
   * @see https://docs.socket.dev/reference/getdiffscangfm
   */
  async getDiffScanGfm(
    orgSlug: string,
    diffScanId: string,
    options?: { github_installation_id?: string | undefined } | undefined,
  ): Promise<SocketSdkResult<'GetDiffScanGfm'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/diff-scans/${encodeURIComponent(diffScanId)}/gfm${options ? `?${queryToSearchParams(options)}` : ''}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'GetDiffScanGfm'>(data)
    } catch (e) {
      return await this.#handleApiError<'GetDiffScanGfm'>(e)
    }
  }

  /**
   * Retrieve the enabled entitlements for an organization.
   *
   * This method fetches the organization's entitlements and filters for only
   * the enabled ones, returning their keys. Entitlements represent Socket
   * Products that the organization has access to use.
   *
   * @operationId getEnabledEntitlements
   *
   * @quota 0 units
   */
  async getEnabledEntitlements(orgSlug: string): Promise<string[]> {
    const data = await this.#executeWithRetry(
      async () =>
        await getResponseJson(
          await createGetRequest(
            this.#baseUrl,
            `orgs/${encodeURIComponent(orgSlug)}/entitlements`,
            this.#reqOptionsWithHooks,
          ),
        ),
    )

    // Extract enabled products from the response.
    const items = (data as EntitlementsResponse)?.items || []
    return items
      .filter((item: Entitlement) => item?.enabled && item.key)
      .map((item: Entitlement) => item.key)
  }

  /**
   * Retrieve all entitlements for an organization.
   *
   * This method fetches all entitlements for an organization and returns the
   * complete list with their status. The result covers both enabled and
   * disabled entitlements.
   *
   * @operationId getEntitlements
   *
   * @quota 0 units
   */
  async getEntitlements(orgSlug: string): Promise<Entitlement[]> {
    const data = await this.#executeWithRetry(
      async () =>
        await getResponseJson(
          await createGetRequest(
            this.#baseUrl,
            `orgs/${encodeURIComponent(orgSlug)}/entitlements`,
            this.#reqOptionsWithHooks,
          ),
        ),
    )

    return (data as EntitlementsResponse)?.items || []
  }

  /**
   * Get complete full scan results buffered in memory.
   *
   * Returns entire scan data as JSON for programmatic processing. For large
   * scans, consider using streamFullScan() instead.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.getFullScan('my-org', 'scan_123')
   *
   *   if (result.success) {
   *   console.log('Scan status:', result.data.scan_state)
   *   console.log('Repository:', result.data.repository_slug)
   *   }
   *   ```
   *
   *   Reads from the immutable cached-scan store by default (`cached: true`). On a
   *   cache miss the API returns 202 Accepted and computes the result in the
   *   background; this method polls transparently until the result is ready, so
   *   callers only ever observe the final scan. Pass `cached: false` to bypass the
   *   cache and live-compute the scan (slower, for debugging).
   *
   * @param orgSlug - Organization identifier.
   * @param scanId - Full scan identifier.
   * @param options - Optional query parameters.
   * @param options.cached - Read cached immutable results (defaults to true).
   * @param options.include_license_details - Include per-artifact license
   *   details.
   * @param options.include_scores - Include score data for each artifact.
   *
   * @returns Complete full scan data including all artifacts
   *
   * @throws {Error} When server returns 5xx status codes or polling times out
   *
   * @apiEndpoint GET /orgs/{org_slug}/full-scans/{full_scan_id}
   *
   * @quota 1 units
   *
   * @scopes full-scans:list
   *
   * @see https://docs.socket.dev/reference/getorgfullscan
   */
  async getFullScan(
    orgSlug: string,
    scanId: string,
    options?:
      | {
          cached?: boolean | undefined
          include_license_details?: boolean | undefined
          include_scores?: boolean | undefined
        }
      | undefined,
  ): Promise<FullScanResult | StrictErrorResult> {
    const { cached = true, ...rest } = { __proto__: null, ...options } as {
      cached?: boolean | undefined
    } & QueryParams
    // Omit the cached param when disabled: an absent param reads as false
    // server-side, so there's no reason to send cached=false on the wire.
    const queryParams = {
      __proto__: null,
      ...(cached ? { cached: true } : undefined),
      ...rest,
    } as QueryParams
    const urlPath = `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(scanId)}?${queryToSearchParams(queryParams)}`
    try {
      const data = await this.#pollCachedScan(urlPath, scanId)
      return {
        cause: undefined,
        data: data as FullScanItem,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'getOrgFullScan'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Get metadata for a specific full scan.
   *
   * Returns scan configuration, status, and summary information without full
   * artifact data. Useful for checking scan status without downloading complete
   * results.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.getFullScanMetadata('my-org', 'scan_123')
   *
   *   if (result.success) {
   *     console.log('Scan state:', result.data.scan_state)
   *     console.log('Branch:', result.data.branch)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param scanId - Full scan identifier.
   *
   * @returns Scan metadata including status and configuration
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/full-scans/{full_scan_id}/metadata
   *
   * @quota 1 units
   *
   * @scopes full-scans:list
   *
   * @see https://docs.socket.dev/reference/getorgfullscanmetadata
   */
  async getFullScanMetadata(
    orgSlug: string,
    scanId: string,
  ): Promise<FullScanResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(scanId)}/metadata`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as FullScanItem,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult =
        await this.#handleApiError<'getOrgFullScanMetadata'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * List integration events for a specific organization integration.
   *
   * @param orgSlug - Organization identifier.
   * @param integrationId - Integration identifier.
   *
   * @returns Integration event history.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET
   *   /orgs/{org_slug}/settings/integrations/{integration_id}/events
   *
   * @quota 1 units
   *
   * @scopes integration:list
   *
   * @see https://docs.socket.dev/reference/getintegrationevents
   */
  async getIntegrationEvents(
    orgSlug: string,
    integrationId: string,
  ): Promise<SocketSdkResult<'getIntegrationEvents'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/settings/integrations/${encodeURIComponent(integrationId)}/events`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getIntegrationEvents'>(data)
    } catch (e) {
      return await this.#handleApiError<'getIntegrationEvents'>(e)
    }
  }

  /**
   * Get security issues for a specific npm package and version. Returns
   * detailed vulnerability and security alert information.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   */
  async getIssuesByNpmPackage(
    pkgName: string,
    version: string,
  ): Promise<SocketSdkResult<'getIssuesByNPMPackage'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `npm/${encodeURIComponent(pkgName)}/${encodeURIComponent(version)}/issues`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getIssuesByNPMPackage'>(data)
    } catch (e) {
      return await this.#handleApiError<'getIssuesByNPMPackage'>(e)
    }
  }

  /**
   * Get the Socket API OpenAPI definition.
   *
   * @returns The OpenAPI document.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /openapi
   *
   * @quota 1 units
   *
   * @see https://docs.socket.dev/reference/getopenapi
   */
  async getOpenAPI(): Promise<SocketSdkResult<'getOpenAPI'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              'openapi',
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOpenAPI'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOpenAPI'>(e)
    }
  }

  /**
   * Get the Socket API OpenAPI definition as JSON.
   *
   * @returns The OpenAPI document.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /openapi.json
   *
   * @quota 1 units
   *
   * @see https://docs.socket.dev/reference/getopenapijson
   */
  async getOpenAPIJSON(): Promise<SocketSdkResult<'getOpenAPIJSON'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              'openapi.json',
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOpenAPIJSON'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOpenAPIJSON'>(e)
    }
  }

  /**
   * List full scans associated with a specific alert. Returns paginated full
   * scan references for alert investigation.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.getOrgAlertFullScans('my-org', {
   *     alertKey: 'npm/lodash/cve-2021-23337',
   *     range: '-7d',
   *     per_page: 50,
   *   })
   *
   *   if (result.success) {
   *     for (const item of result.data.items) {
   *       console.log('Full Scan ID:', item.fullScanId)
   *     }
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param options - Query parameters including alertKey, range, pagination.
   *
   * @returns Paginated array of full scans associated with the alert
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/alert-full-scan-search
   *
   * @quota 10 units
   *
   * @scopes alerts:list
   *
   * @see https://docs.socket.dev/reference/alertfullscans
   */
  async getOrgAlertFullScans(
    orgSlug: string,
    options: {
      alertKey: string
      per_page?: number | undefined
      range?: string | undefined
      startAfterCursor?: string | undefined
    },
  ): Promise<SocketSdkResult<'alertFullScans'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/alert-full-scan-search?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'alertFullScans'>(data)
    } catch (e) {
      return await this.#handleApiError<'alertFullScans'>(e)
    }
  }

  /**
   * Fetch a single active alert resolution by UUID. Returns the same row
   * shape as the list endpoint.
   *
   * @param orgSlug - Organization identifier.
   * @param uuid - UUID of the alert resolution to fetch.
   *
   * @returns The requested alert resolution.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/alerts/resolutions/{uuid}
   *
   * @quota 1 units
   *
   * @scopes alert-resolution:read
   */
  async getOrgAlertResolution(
    orgSlug: string,
    uuid: string,
  ): Promise<SocketSdkResult<'getOrgAlertResolution'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/alerts/resolutions/${encodeURIComponent(uuid)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgAlertResolution'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgAlertResolution'>(e)
    }
  }

  /**
   * List active alert resolutions for an organization. Results are
   * paginated via an opaque cursor and ordered by created_at.
   *
   * @param orgSlug - Organization identifier.
   * @param options - Optional query parameters for sort direction and
   *   pagination.
   *
   * @returns Paginated list of alert resolutions with cursor-based
   * pagination.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/alerts/resolutions
   *
   * @quota 1 units
   *
   * @scopes alert-resolution:list
   */
  async getOrgAlertResolutions(
    orgSlug: string,
    options?:
      | {
          direction?: string | undefined
          per_page?: number | undefined
          startAfterCursor?: string | undefined
        }
      | undefined,
  ): Promise<SocketSdkResult<'getOrgAlertResolutions'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/alerts/resolutions?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgAlertResolutions'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgAlertResolutions'>(e)
    }
  }

  /**
   * List latest alerts for an organization (Beta). Returns paginated alerts
   * with comprehensive filtering options.
   *
   * @param orgSlug - Organization identifier.
   * @param options - Optional query parameters for pagination and filtering.
   *
   * @returns Paginated list of alerts with cursor-based pagination
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 10 units
   *
   * @scopes alerts:list
   */
  async getOrgAlertsList(
    orgSlug: string,
    options?:
      | {
          'filters.alertAction'?: string | undefined
          'filters.alertAction.notIn'?: string | undefined
          'filters.alertCategory'?: string | undefined
          'filters.alertCategory.notIn'?: string | undefined
          'filters.alertCveId'?: string | undefined
          'filters.alertCveId.notIn'?: string | undefined
          'filters.alertCveTitle'?: string | undefined
          'filters.alertCveTitle.notIn'?: string | undefined
          'filters.alertCweId'?: string | undefined
          'filters.alertCweId.notIn'?: string | undefined
          'filters.alertCweName'?: string | undefined
          'filters.alertCweName.notIn'?: string | undefined
          'filters.alertEPSS'?: string | undefined
          'filters.alertEPSS.notIn'?: string | undefined
          'filters.alertFixType'?: string | undefined
          'filters.alertFixType.notIn'?: string | undefined
          'filters.alertKEV'?: boolean | undefined
          'filters.alertKEV.notIn'?: boolean | undefined
          'filters.alertPriority'?: string | undefined
          'filters.alertPriority.notIn'?: string | undefined
          'filters.alertReachabilityType'?: string | undefined
          'filters.alertReachabilityType.notIn'?: string | undefined
          'filters.alertSeverity'?: string | undefined
          'filters.alertSeverity.notIn'?: string | undefined
          'filters.alertStatus'?: string | undefined
          'filters.alertStatus.notIn'?: string | undefined
          'filters.alertType'?: string | undefined
          'filters.alertType.notIn'?: string | undefined
          'filters.alertUpdatedAt.eq'?: string | undefined
          'filters.alertUpdatedAt.gt'?: string | undefined
          'filters.alertUpdatedAt.gte'?: string | undefined
          'filters.alertUpdatedAt.lt'?: string | undefined
          'filters.alertUpdatedAt.lte'?: string | undefined
          'filters.repoFullName'?: string | undefined
          'filters.repoFullName.notIn'?: string | undefined
          'filters.repoLabels'?: string | undefined
          'filters.repoLabels.notIn'?: string | undefined
          'filters.repoSlug'?: string | undefined
          'filters.repoSlug.notIn'?: string | undefined
          per_page?: number | undefined
          startAfterCursor?: string | undefined
        }
      | undefined,
  ): Promise<SocketSdkResult<'alertsList'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/alerts?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'alertsList'>(data)
    } catch (e) {
      return await this.#handleApiError<'alertsList'>(e)
    }
  }

  /**
   * Get analytics data for organization usage patterns and security metrics.
   * Returns statistical analysis for specified time period.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes report:write
   */
  async getOrgAnalytics(
    time: string,
  ): Promise<SocketSdkResult<'getOrgAnalytics'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `analytics/org/${encodeURIComponent(time)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgAnalytics'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgAnalytics'>(e)
    }
  }

  /**
   * Fetch available fixes for vulnerabilities in a repository or scan. Returns
   * fix recommendations including version upgrades and update types.
   *
   * @param orgSlug - Organization identifier.
   * @param options - Fix query options including repo_slug or full_scan_id,
   *   vulnerability IDs, and preferences.
   * @param options.include_stateful_alert_ids - Set to include a
   *   statefulAlertIds map (GHSA ID → open stateful alert IDs) in the
   *   response, org-scoped only.
   *
   * @returns Fix details for requested vulnerabilities with upgrade
   *   recommendations.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @operationId getOrgFixes
   *
   * @quota 10 units
   *
   * @scopes fixes:list
   */
  async getOrgFixes(
    orgSlug: string,
    options: OrgFixesOptions,
  ): ReturnType<typeof requestOrgFixes> {
    return await requestOrgFixes(this.#apiContext, orgSlug, options)
  }

  /**
   * Export a full scan's alerts as CSV. The endpoint responds with raw
   * `text/csv`, so the result data is the CSV text rather than a parsed object.
   *
   * @param orgSlug - Organization identifier.
   * @param fullScanId - Full scan identifier.
   * @param options - Query params (`include_license_details` is required) plus
   *   an optional `filters` body forwarded to the export.
   *
   * @returns The CSV export text.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @operationId getOrgFullScanCsv
   *
   * @apiEndpoint POST /orgs/{org_slug}/full-scans/{full_scan_id}/format/csv
   *
   * @quota 1 units
   *
   * @scopes full-scans:list
   *
   * @see https://docs.socket.dev/reference/getorgfullscancsv
   */
  async getOrgFullScanCsv(
    orgSlug: string,
    fullScanId: string,
    options: GetOrgFullScanCsvOptions,
  ): Promise<SocketSdkGenericResult<string>> {
    const { filters, ...queryParams } = {
      __proto__: null,
      ...options,
    } as GetOrgFullScanCsvOptions
    const urlPath = `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}/format/csv?${queryToSearchParams(queryParams as QueryParams)}`
    const url = `${this.#baseUrl}${urlPath}`
    try {
      const response = await this.#executeWithRetry(async () => {
        const res = await createRequestWithJson(
          'POST',
          this.#baseUrl,
          urlPath,
          { filters },
          this.#reqOptionsWithHooks,
        )
        if (!isResponseOk(res)) {
          throw new ResponseError(res, '', url)
        }
        return res
      })
      return {
        cause: undefined,
        data: response.text(),
        error: undefined,
        status: response.status,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'getOrgFullScanCsv'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
        url: errorResult.url,
      }
    }
  }

  /**
   * Export a full scan's alerts as a PDF report. The endpoint responds with raw
   * `application/pdf`, so the result data is the PDF bytes as a Buffer.
   *
   * @param orgSlug - Organization identifier.
   * @param fullScanId - Full scan identifier.
   * @param options - Query params (`include_license_details` is required) plus
   *   optional `filters`, `groupBy`, and `additionalInformation` body fields.
   *
   * @returns The PDF report bytes.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @operationId getOrgFullScanPdf
   *
   * @apiEndpoint POST /orgs/{org_slug}/full-scans/{full_scan_id}/format/pdf
   *
   * @quota 1 units
   *
   * @scopes full-scans:list
   *
   * @see https://docs.socket.dev/reference/getorgfullscanpdf
   */
  async getOrgFullScanPdf(
    orgSlug: string,
    fullScanId: string,
    options: GetOrgFullScanPdfOptions,
  ): Promise<SocketSdkGenericResult<Buffer>> {
    const { additionalInformation, filters, groupBy, ...queryParams } = {
      __proto__: null,
      ...options,
    } as GetOrgFullScanPdfOptions
    const urlPath = `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}/format/pdf?${queryToSearchParams(queryParams as QueryParams)}`
    const url = `${this.#baseUrl}${urlPath}`
    try {
      const response = await this.#executeWithRetry(async () => {
        const res = await createRequestWithJson(
          'POST',
          this.#baseUrl,
          urlPath,
          { additionalInformation, filters, groupBy },
          this.#reqOptionsWithHooks,
        )
        if (!isResponseOk(res)) {
          throw new ResponseError(res, '', url)
        }
        return res
      })
      return {
        cause: undefined,
        data: response.body,
        error: undefined,
        status: response.status,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'getOrgFullScanPdf'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
        url: errorResult.url,
      }
    }
  }

  /**
   * Get organization's license policy configuration. Returns allowed,
   * restricted, and monitored license types.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes license-policy:read
   */
  async getOrgLicensePolicy(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getOrgLicensePolicy'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/settings/license-policy`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgLicensePolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgLicensePolicy'>(e)
    }
  }

  /**
   * Get a single setting for a repository label.
   *
   * @param orgSlug - Organization identifier.
   * @param labelId - Label identifier.
   * @param settingKey - Key of the label setting to fetch.
   *
   * @returns The requested label setting.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/repos/labels/{label_id}/label-setting
   *
   * @quota 1 units
   *
   * @scopes repo-label:list
   *
   * @see https://docs.socket.dev/reference/getorgrepolabelsetting
   */
  async getOrgRepoLabelSetting(
    orgSlug: string,
    labelId: string,
    settingKey: string,
  ): Promise<SocketSdkResult<'getOrgRepoLabelSetting'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels/${encodeURIComponent(labelId)}/label-setting?${queryToSearchParams({ setting_key: settingKey })}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgRepoLabelSetting'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgRepoLabelSetting'>(e)
    }
  }

  /**
   * Get organization's security policy configuration. Returns alert rules,
   * severity thresholds, and enforcement settings.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes security-policy:read
   */
  async getOrgSecurityPolicy(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getOrgSecurityPolicy'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/settings/security-policy`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgSecurityPolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgSecurityPolicy'>(e)
    }
  }

  /**
   * Get organization's telemetry configuration. Returns whether telemetry is
   * enabled for the organization.
   *
   * @param orgSlug - Organization identifier.
   *
   * @returns Telemetry configuration with enabled status
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   */
  async getOrgTelemetryConfig(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getOrgTelemetryConfig'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/telemetry/config`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgTelemetryConfig'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgTelemetryConfig'>(e)
    }
  }

  /**
   * List threat-feed items for an organization. Returns recently observed
   * malicious / suspicious packages, paginated and filterable by ecosystem,
   * name, version, and review state. Requires an Enterprise plan with the
   * Threat Feed add-on and the `threat-feed:list` scope.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes threat-feed:list
   */
  async getOrgThreatFeedItems(
    orgSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'getOrgThreatFeedItems'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/threat-feed?${queryToSearchParams(queryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgThreatFeedItems'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgThreatFeedItems'>(e)
    }
  }

  /**
   * Get organization triage settings and status. Returns alert triage
   * configuration and current state.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes triage:alerts-list
   */
  async getOrgTriage(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getOrgTriage'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/triage/alerts`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgTriage'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgTriage'>(e)
    }
  }

  /**
   * Get details of a specific webhook. Returns webhook configuration including
   * events, URL, and filters.
   *
   * @param orgSlug - Organization identifier.
   * @param webhookId - Webhook ID to retrieve.
   *
   * @returns Webhook details
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes webhooks:list
   */
  async getOrgWebhook(
    orgSlug: string,
    webhookId: string,
  ): Promise<SocketSdkResult<'getOrgWebhook'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/webhooks/${encodeURIComponent(webhookId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgWebhook'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgWebhook'>(e)
    }
  }

  /**
   * List all webhooks for an organization. Supports pagination and sorting
   * options.
   *
   * @param orgSlug - Organization identifier.
   * @param options - Optional query parameters for pagination and sorting.
   *
   * @returns List of webhooks with pagination info
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes webhooks:list
   */
  async getOrgWebhooksList(
    orgSlug: string,
    options?:
      | {
          direction?: string | undefined
          page?: number | undefined
          per_page?: number | undefined
          sort?: string | undefined
        }
      | undefined,
  ): Promise<SocketSdkResult<'getOrgWebhooksList'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/webhooks?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrgWebhooksList'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgWebhooksList'>(e)
    }
  }

  /**
   * Get current API quota usage and limits. Returns remaining requests, rate
   * limits, and quota reset times.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 0 units
   */
  async getQuota(): Promise<SocketSdkResult<'getQuota'>> {
    try {
      const data = await this.#getCached(
        'quota',
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              'quota',
              this.#reqOptionsWithHooks,
            ),
          ),
        'quota',
      )
      return this.#handleApiSuccess<'getQuota'>(data)
    } catch (e) {
      return await this.#handleApiError<'getQuota'>(e)
    }
  }

  /**
   * Get analytics data for a specific repository. Returns security metrics,
   * dependency trends, and vulnerability statistics.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes report:write
   */
  async getRepoAnalytics(
    repo: string,
    time: string,
  ): Promise<SocketSdkResult<'getRepoAnalytics'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `analytics/repo/${encodeURIComponent(repo)}/${encodeURIComponent(time)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getRepoAnalytics'>(data)
    } catch (e) {
      return await this.#handleApiError<'getRepoAnalytics'>(e)
    }
  }

  /**
   * Get details for a specific repository.
   *
   * Returns repository configuration, monitoring status, and metadata.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.getRepository('my-org', 'my-repo')
   *
   *   if (result.success) {
   *     console.log('Repository:', result.data.name)
   *     console.log('Visibility:', result.data.visibility)
   *     console.log('Default branch:', result.data.default_branch)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param repoSlug - Repository slug/name.
   * @param options - Optional parameters including workspace.
   *
   * @returns Repository details with configuration
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/repos/{repo_slug}
   *
   * @quota 1 units
   *
   * @scopes repo:list
   *
   * @see https://docs.socket.dev/reference/getorgrepo
   */
  async getRepository(
    orgSlug: string,
    repoSlug: string,
    options?: GetRepositoryOptions | undefined,
  ): Promise<RepositoryResult | StrictErrorResult> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const repoSlugParam = encodeURIComponent(repoSlug)
    const { workspace } = {
      __proto__: null,
      ...options,
    } as GetRepositoryOptions
    const queryString = workspace
      ? `?${queryToSearchParams({ workspace } as QueryParams)}`
      : ''

    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${orgSlugParam}/repos/${repoSlugParam}${queryString}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as RepositoryItem,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'getOrgRepo'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Get details for a specific repository label.
   *
   * Returns label configuration, associated repositories, and policy settings.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.getRepositoryLabel('my-org', 'label-id-123')
   *
   *   if (result.success) {
   *     console.log('Label name:', result.data.name)
   *     console.log('Associated repos:', result.data.repository_ids)
   *     console.log('Has security policy:', result.data.has_security_policy)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param labelId - Label identifier.
   *
   * @returns Label details with guaranteed id and name fields
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/repos/labels/{label_id}
   *
   * @quota 1 units
   *
   * @scopes repo-label:list
   *
   * @see https://docs.socket.dev/reference/getorgrepolabel
   */
  async getRepositoryLabel(
    orgSlug: string,
    labelId: string,
  ): Promise<RepositoryLabelResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels/${encodeURIComponent(labelId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as RepositoryLabelItem,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'getOrgRepoLabel'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Get security score for a specific npm package and version. Returns
   * numerical security rating and scoring breakdown.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   */
  async getScoreByNpmPackage(
    pkgName: string,
    version: string,
  ): Promise<SocketSdkResult<'getScoreByNPMPackage'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `npm/${encodeURIComponent(pkgName)}/${encodeURIComponent(version)}/score`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getScoreByNPMPackage'>(data)
    } catch (e) {
      return await this.#handleApiError<'getScoreByNPMPackage'>(e)
    }
  }

  /**
   * Get the Socket Basics configuration for an organization.
   *
   * @param orgSlug - Organization identifier.
   *
   * @returns The Socket Basics configuration.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/settings/socket-basics
   *
   * @quota 1 units
   *
   * @scopes socket-basics:read
   *
   * @see https://docs.socket.dev/reference/getsocketbasicsconfig
   */
  async getSocketBasicsConfig(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getSocketBasicsConfig'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/settings/socket-basics`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getSocketBasicsConfig'>(data)
    } catch (e) {
      return await this.#handleApiError<'getSocketBasicsConfig'>(e)
    }
  }

  /**
   * Get list of supported file types for full scan generation. Returns glob
   * patterns for supported manifest files, lockfiles, and configuration
   * formats.
   *
   * Files whose names match the patterns returned by this endpoint can be
   * uploaded for report generation. Examples include `package.json`,
   * `package-lock.json`, and `yarn.lock`.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.getSupportedFiles('my-org')
   *
   *   if (result.success) {
   *     console.log('NPM patterns:', result.data.NPM)
   *     console.log('PyPI patterns:', result.data.PyPI)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   *
   * @returns Nested object with environment and file type patterns
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/supported-files
   *
   * @quota 1 units
   *
   * @scopes No scopes required, but authentication is required
   *
   * @see https://docs.socket.dev/reference/getsupportedfiles
   */
  async getSupportedFiles(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getSupportedFiles'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/supported-files`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getSupportedFiles'>(data)
    } catch (e) {
      return await this.#handleApiError<'getSupportedFiles'>(e)
    }
  }

  /**
   * Get a single threat campaign by ID (v1 API, public route). Same shape as
   * one item from `listThreatCampaigns`; package PURLs are not inlined —
   * fetch them via `listThreatCampaignPackages`. Requires an Enterprise plan
   * with the Threat Feed add-on and the `threat-campaigns:list` token scope.
   *
   * @param orgSlug - Organization identifier.
   * @param campaignId - Campaign identifier.
   *
   * @returns The campaign
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/threat-campaigns/{campaign_id} (v1)
   *
   * @operationId none
   */
  async getThreatCampaign(
    orgSlug: string,
    campaignId: string,
  ): Promise<GetThreatCampaignResult | StrictErrorResult> {
    let v1BaseUrl: string
    try {
      v1BaseUrl = this.#requireApiV1BaseUrl()
    } catch (e) {
      return {
        cause: undefined,
        data: undefined,
        error: getErrorMessage(e),
        status: 400,
        success: false,
      }
    }

    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              v1BaseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/threat-campaigns/${encodeURIComponent(campaignId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as ThreatCampaign,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<never>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * List threat-feed items across all organizations the token can see. Returns
   * recently observed malicious / suspicious packages, paginated and filterable
   * by ecosystem, name, version, and review state.
   *
   * The backend marks the top-level `/threat-feed` route as the legacy form;
   * prefer the org-scoped {@link getOrgThreatFeedItems}.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes threat-feed:list
   */
  async getThreatFeedItems(
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'getThreatFeedItems'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `threat-feed?${queryToSearchParams(queryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'getThreatFeedItems'>(data)
    } catch (e) {
      return await this.#handleApiError<'getThreatFeedItems'>(e)
    }
  }

  /**
   * List historical alerts for an organization. Returns point-in-time alert
   * data across repositories with extensive filtering and cursor pagination.
   *
   * @param orgSlug - Organization identifier.
   * @param options - Date, range, pagination, and alert filter options.
   *
   * @returns Paginated historical alerts with an end cursor.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/historical/alerts
   *
   * @quota 10 units
   *
   * @scopes historical:alerts-list
   *
   * @see https://docs.socket.dev/reference/historicalalertslist
   */
  async historicalAlertsList(
    orgSlug: string,
    options?: HistoricalAlertsListOptions | undefined,
  ): Promise<SocketSdkResult<'historicalAlertsList'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/historical/alerts?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'historicalAlertsList'>(data)
    } catch (e) {
      return await this.#handleApiError<'historicalAlertsList'>(e)
    }
  }

  /**
   * Get a trend of historical alert counts for an organization. Returns
   * aggregated alert totals over the requested time range.
   *
   * @param orgSlug - Organization identifier.
   * @param options - Date, range, aggregation, and alert filter options.
   *
   * @returns Historical alert trend data.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/historical/alerts/trend
   *
   * @quota 10 units
   *
   * @scopes historical:alerts-trend
   *
   * @see https://docs.socket.dev/reference/historicalalertstrend
   */
  async historicalAlertsTrend(
    orgSlug: string,
    options?: HistoricalAlertsTrendOptions | undefined,
  ): Promise<SocketSdkResult<'historicalAlertsTrend'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/historical/alerts/trend?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'historicalAlertsTrend'>(data)
    } catch (e) {
      return await this.#handleApiError<'historicalAlertsTrend'>(e)
    }
  }

  /**
   * Get a trend of historical dependency counts for an organization. Returns
   * aggregated dependency totals over the requested time range.
   *
   * @param orgSlug - Organization identifier.
   * @param options - Date, range, and dependency filter options.
   *
   * @returns Historical dependency trend data.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/historical/dependencies/trend
   *
   * @quota 10 units
   *
   * @scopes historical:dependencies-trend
   *
   * @see https://docs.socket.dev/reference/historicaldependenciestrend
   */
  async historicalDependenciesTrend(
    orgSlug: string,
    options?: HistoricalDependenciesTrendOptions | undefined,
  ): Promise<SocketSdkResult<'historicalDependenciesTrend'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/historical/dependencies/trend?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'historicalDependenciesTrend'>(data)
    } catch (e) {
      return await this.#handleApiError<'historicalDependenciesTrend'>(e)
    }
  }

  /**
   * List historical dependency snapshots for an organization. Returns snapshot
   * metadata with status filtering and cursor pagination.
   *
   * @param orgSlug - Organization identifier.
   * @param options - Date, range, pagination, and snapshot filter options.
   *
   * @returns Paginated historical snapshots with an end cursor.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/historical/snapshots
   *
   * @quota 10 units
   *
   * @scopes historical:snapshots-list
   *
   * @see https://docs.socket.dev/reference/historicalsnapshotslist
   */
  async historicalSnapshotsList(
    orgSlug: string,
    options?: HistoricalSnapshotsListOptions | undefined,
  ): Promise<SocketSdkResult<'historicalSnapshotsList'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/historical/snapshots?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'historicalSnapshotsList'>(data)
    } catch (e) {
      return await this.#handleApiError<'historicalSnapshotsList'>(e)
    }
  }

  /**
   * Start a new historical dependency snapshot for an organization. Triggers
   * the background computation of a point-in-time dependency snapshot.
   *
   * @param orgSlug - Organization identifier.
   *
   * @returns Snapshot start acknowledgement, including the new request ID.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/historical/snapshots
   *
   * @quota 10 units
   *
   * @scopes historical:snapshots-start
   *
   * @see https://docs.socket.dev/reference/historicalsnapshotsstart
   */
  async historicalSnapshotsStart(
    orgSlug: string,
  ): Promise<SocketSdkResult<'historicalSnapshotsStart'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/historical/snapshots`,
              {},
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'historicalSnapshotsStart'>(data)
    } catch (e) {
      return await this.#handleApiError<'historicalSnapshotsStart'>(e)
    }
  }

  /**
   * Get metadata for a set of licenses (SPDX identifiers or expressions).
   *
   * @param request - License metadata request body.
   * @param options - Optional query params (e.g. `includetext` to include the
   *   full license text).
   *
   * @returns Metadata for the requested licenses.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /license-metadata
   *
   * @quota 1 units
   *
   * @see https://docs.socket.dev/reference/licensemetadata
   */
  async licenseMetadata(
    request: QueryParams,
    options?: { includetext?: boolean | undefined } | undefined,
  ): Promise<SocketSdkResult<'licenseMetadata'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `license-metadata?${queryToSearchParams(options as QueryParams)}`,
              request,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'licenseMetadata'>(data)
    } catch (e) {
      return await this.#handleApiError<'licenseMetadata'>(e)
    }
  }

  /**
   * Compute license policy violations for a set of packages (Beta). The
   * endpoint streams newline-delimited JSON, which this method parses into an
   * array of violation records.
   *
   * @param request - License allow-list request body.
   *
   * @returns The parsed license policy violations.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @operationId licensePolicy
   *
   * @apiEndpoint POST /license-policy
   *
   * @quota 100 units
   *
   * @scopes packages:list, license-policy:read
   *
   * @see https://docs.socket.dev/reference/licensepolicy
   */
  async licensePolicy(
    request: QueryParams,
  ): Promise<SocketSdkGenericResult<LicensePolicyViolations>> {
    const urlPath = 'license-policy'
    const url = `${this.#baseUrl}${urlPath}`
    try {
      const response = await this.#executeWithRetry(async () => {
        const res = await createRequestWithJson(
          'POST',
          this.#baseUrl,
          urlPath,
          request,
          this.#reqOptionsWithHooks,
        )
        if (!isResponseOk(res)) {
          throw new ResponseError(res, '', url)
        }
        return res
      })
      // Parse the newline-delimited JSON response into violation records.
      const results: LicensePolicyViolations = []
      const text = response.text()
      let start = 0
      for (let i = 0; i <= text.length; i++) {
        if (i === text.length || text.charCodeAt(i) === 10) {
          if (i > start) {
            const line = text.slice(start, i)
            const violation = parseJson(line, {
              throws: false,
            }) as LicensePolicyViolations[number] | null
            if (isObject(violation)) {
              results.push(violation)
            }
          }
          start = i + 1
        }
      }
      return {
        cause: undefined,
        data: results,
        error: undefined,
        status: response.status,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'licensePolicy'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
        url: errorResult.url,
      }
    }
  }

  /**
   * List all full scans for an organization.
   *
   * Returns paginated list of full scan metadata with guaranteed required
   * fields for improved TypeScript autocomplete.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.listFullScans('my-org', {
   *     branch: 'main',
   *     per_page: 50,
   *     use_cursor: true,
   *   })
   *
   *   if (result.success) {
   *     result.data.results.forEach(scan => {
   *       console.log(scan.id, scan.created_at) // Guaranteed fields
   *     })
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param options - Filtering and pagination options.
   *
   * @returns List of full scans with metadata
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/full-scans
   *
   * @quota 1 units
   *
   * @scopes full-scans:list
   *
   * @see https://docs.socket.dev/reference/getorgfullscanlist
   */
  async listFullScans(
    orgSlug: string,
    options?: ListFullScansOptions | undefined,
  ): Promise<FullScanListResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/full-scans?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as FullScanListResult['data'],
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'getOrgFullScanList'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * List all organizations accessible to the current user.
   *
   * Returns organization details and access permissions with guaranteed
   * required fields.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.listOrganizations()
   *
   *   if (result.success) {
   *   // `organizations` is a map keyed by org id, so iterate its values.
   *   Object.values(result.data.organizations).forEach(org => {
   *   console.log(org.name, org.slug) // Guaranteed fields
   *   })
   *   }
   *   ```
   *
   * @returns List of organizations with metadata
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /organizations
   *
   * @quota 1 units
   *
   * @see https://docs.socket.dev/reference/getorganizations
   */
  async listOrganizations(): Promise<OrganizationsResult | StrictErrorResult> {
    try {
      const data = await this.#getCached(
        'organizations',
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              'organizations',
              this.#reqOptionsWithHooks,
            ),
          ),
        'organizations',
      )
      return {
        cause: undefined,
        data: data as OrganizationsResult['data'],
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'getOrganizations'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * List all diff scans for an organization. Returns paginated list of diff
   * scan metadata and status.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes diff-scans:list
   */
  async listOrgDiffScans(
    orgSlug: string,
  ): Promise<SocketSdkResult<'listOrgDiffScans'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/diff-scans`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'listOrgDiffScans'>(data)
    } catch (e) {
      return await this.#handleApiError<'listOrgDiffScans'>(e)
    }
  }

  /**
   * List all repositories in an organization.
   *
   * Returns paginated list of repository metadata with guaranteed required
   * fields.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.listRepositories('my-org', {
   *     per_page: 50,
   *     sort: 'name',
   *     direction: 'asc',
   *   })
   *
   *   if (result.success) {
   *     result.data.results.forEach(repo => {
   *       console.log(repo.name, repo.visibility)
   *     })
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param options - Pagination and filtering options.
   *
   * @returns List of repositories with metadata
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/repos
   *
   * @quota 1 units
   *
   * @scopes repo:list
   *
   * @see https://docs.socket.dev/reference/getorgrepolist
   */
  async listRepositories(
    orgSlug: string,
    options?: ListRepositoriesOptions | undefined,
  ): Promise<RepositoriesListResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as RepositoriesListResult['data'],
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'getOrgRepoList'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * List all repository labels for an organization.
   *
   * Returns paginated list of labels configured for repository organization and
   * policy management.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.listRepositoryLabels('my-org', {
   *     per_page: 50,
   *     page: 1,
   *   })
   *
   *   if (result.success) {
   *     result.data.results.forEach(label => {
   *       console.log('Label:', label.name)
   *       console.log('Associated repos:', label.repository_ids?.length || 0)
   *     })
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param options - Pagination options.
   *
   * @returns List of labels with guaranteed id and name fields
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/repos/labels
   *
   * @quota 1 units
   *
   * @scopes repo-label:list
   *
   * @see https://docs.socket.dev/reference/getorgrepolabellist
   */
  async listRepositoryLabels(
    orgSlug: string,
    options?: QueryParams | undefined,
  ): Promise<RepositoryLabelsListResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as RepositoryLabelsListResult['data'],
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'getOrgRepoLabelList'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * List package PURLs affected by a single threat campaign (v1 API, public
   * route), cursor-paginated. Pass the previous response's `endCursor` back
   * as `options.cursor` to fetch the next page. Requires an Enterprise plan
   * with the Threat Feed add-on and the `threat-campaigns:list` token scope.
   *
   * @param orgSlug - Organization identifier.
   * @param campaignId - Campaign identifier.
   * @param options - Pagination options (`per_page`, `cursor`).
   *
   * @returns `{ items, endCursor }` — opaque PURL strings and the next cursor
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/threat-campaigns/{campaign_id}/packages (v1)
   *
   * @operationId none
   */
  async listThreatCampaignPackages(
    orgSlug: string,
    campaignId: string,
    options?: ListThreatCampaignPackagesOptions | undefined,
  ): Promise<ListThreatCampaignPackagesResult | StrictErrorResult> {
    let v1BaseUrl: string
    try {
      v1BaseUrl = this.#requireApiV1BaseUrl()
    } catch (e) {
      return {
        cause: undefined,
        data: undefined,
        error: getErrorMessage(e),
        status: 400,
        success: false,
      }
    }

    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              v1BaseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/threat-campaigns/${encodeURIComponent(campaignId)}/packages?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as ThreatCampaignPackagesData,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<never>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * List threat campaigns for an organization (v1 API, public route),
   * paginated and filterable by status, ecosystem, and an incremental sync
   * parameter (`updated_after`). Package PURLs are not inlined — fetch them
   * per campaign via `listThreatCampaignPackages`. Requires an Enterprise
   * plan with the Threat Feed add-on and the `threat-campaigns:list` token
   * scope.
   *
   * @param orgSlug - Organization identifier.
   * @param options - Filter and pagination options; `status` defaults to
   *   `'ongoing'` server-side when omitted.
   *
   * @returns `{ items, endCursor }` — campaigns and the next cursor
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/threat-campaigns (v1)
   *
   * @operationId none
   */
  async listThreatCampaigns(
    orgSlug: string,
    options?: ListThreatCampaignsOptions | undefined,
  ): Promise<ListThreatCampaignsResult | StrictErrorResult> {
    let v1BaseUrl: string
    try {
      v1BaseUrl = this.#requireApiV1BaseUrl()
    } catch (e) {
      return {
        cause: undefined,
        data: undefined,
        error: getErrorMessage(e),
        status: 400,
        success: false,
      }
    }

    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              v1BaseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/threat-campaigns?${queryToSearchParams(options as QueryParams)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as ThreatCampaignsListData,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<never>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Create a new API token for an organization. Generates API token with
   * specified scopes and metadata.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 10 units
   *
   * @scopes api-tokens:create
   */
  async postAPIToken(
    orgSlug: string,
    tokenData: QueryParams,
  ): Promise<SocketSdkResult<'postAPIToken'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/api-tokens`,
              tokenData,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'postAPIToken'>(data)
    } catch (e) {
      return await this.#handleApiError<'postAPIToken'>(e)
    }
  }

  /**
   * Revoke an API token for an organization. Permanently disables the token and
   * removes access.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 10 units
   *
   * @scopes api-tokens:revoke
   */
  async postAPITokensRevoke(
    orgSlug: string,
    tokenId: string,
  ): Promise<SocketSdkResult<'postAPITokensRevoke'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/api-tokens/revoke`,
              { id: tokenId },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'postAPITokensRevoke'>(data)
    } catch (e) {
      return await this.#handleApiError<'postAPITokensRevoke'>(e)
    }
  }

  /**
   * Rotate an API token for an organization. Generates new token value while
   * preserving token metadata.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 10 units
   *
   * @scopes api-tokens:rotate
   */
  async postAPITokensRotate(
    orgSlug: string,
    tokenId: string,
  ): Promise<SocketSdkResult<'postAPITokensRotate'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/api-tokens/rotate`,
              { id: tokenId },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'postAPITokensRotate'>(data)
    } catch (e) {
      return await this.#handleApiError<'postAPITokensRotate'>(e)
    }
  }

  /**
   * Update an existing API token for an organization. Modifies token metadata,
   * scopes, or other properties.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 10 units
   *
   * @scopes api-tokens:create
   */
  async postAPITokenUpdate(
    orgSlug: string,
    tokenId: string,
    updateData: QueryParams,
  ): Promise<SocketSdkResult<'postAPITokenUpdate'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/api-tokens/update`,
              { id: tokenId, ...updateData },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'postAPITokenUpdate'>(data)
    } catch (e) {
      return await this.#handleApiError<'postAPITokenUpdate'>(e)
    }
  }

  /**
   * Post organization events for telemetry ingestion (v1 API, public route).
   * Send events directly to Socket; an empty batch is accepted as a no-op.
   * Requires an organization API token (any scope).
   *
   * @param orgSlug - Organization identifier.
   * @param events - Event payloads to ingest (max 1000 per call).
   *
   * @returns Empty object envelope on success
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/events (v1)
   *
   * @operationId none
   */
  async postEvents(
    orgSlug: string,
    events: SocketEvent[],
  ): Promise<PostEventsResult | StrictErrorResult> {
    let v1BaseUrl: string
    try {
      v1BaseUrl = this.#requireApiV1BaseUrl()
    } catch (e) {
      return {
        cause: undefined,
        data: undefined,
        error: getErrorMessage(e),
        status: 400,
        success: false,
      }
    }

    try {
      const response = await this.#executeWithRetry(async () => {
        const res = await createRequestWithJson(
          'POST',
          v1BaseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/events`,
          events,
          this.#reqOptionsWithHooks,
        )
        if (!isResponseOk(res)) {
          throw new ResponseError(
            res,
            '',
            `${v1BaseUrl}orgs/${encodeURIComponent(orgSlug)}/events`,
          )
        }
        return res
      })
      const data = await getResponseJson(response)
      return {
        cause: undefined,
        data: data as PostEventsData,
        error: undefined,
        status: response.status as 200 | 201,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<never>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Post telemetry data for an organization. Sends telemetry events and
   * analytics data for monitoring and analysis.
   *
   * @param orgSlug - Organization identifier.
   * @param telemetryData - Telemetry payload containing events and metrics.
   *
   * @returns Empty object on successful submission
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @operationId none
   *
   * @quota 0 units
   */
  async postOrgTelemetry(
    orgSlug: string,
    telemetryData: PostOrgTelemetryPayload,
  ): Promise<SocketSdkGenericResult<PostOrgTelemetryResponse>> {
    try {
      const data = (await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/telemetry`,
              telemetryData,
              this.#reqOptionsWithHooks,
            ),
          ),
      )) as PostOrgTelemetryResponse
      return {
        cause: undefined,
        data,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      return await this.#handleApiError<never>(e)
    }
  }

  /**
   * Update user or organization settings. Configures preferences,
   * notifications, and security policies.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   */
  async postSettings(
    selectors: Array<{ organization?: string | undefined }>,
  ): Promise<SocketSdkResult<'postSettings'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              'settings',
              { json: selectors },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'postSettings'>(data)
    } catch (e) {
      return await this.#handleApiError<'postSettings'>(e)
    }
  }

  /**
   * Create a new full scan by rescanning an existing scan. Supports shallow
   * (policy reapplication) and deep (dependency resolution rerun) modes.
   *
   * @example
   *   ;```typescript
   *   // Shallow rescan (reapply policies to cached data)
   *   const result = await sdk.rescanFullScan('my-org', 'scan_123', {
   *     mode: 'shallow',
   *   })
   *
   *   if (result.success) {
   *     console.log('New Scan ID:', result.data.id)
   *     console.log('Status:', result.data.status)
   *   }
   *
   *   // Deep rescan (rerun dependency resolution)
   *   const deepResult = await sdk.rescanFullScan('my-org', 'scan_123', {
   *     mode: 'deep',
   *   })
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param fullScanId - Full scan ID to rescan.
   * @param options - Rescan options including mode (shallow or deep)
   *
   * @returns New scan ID and status
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/full-scans/{full_scan_id}/rescan
   *
   * @quota 1 units
   *
   * @scopes full-scans:create
   *
   * @see https://docs.socket.dev/reference/rescanorgfullscan
   */
  async rescanFullScan(
    orgSlug: string,
    fullScanId: string,
    options?:
      | {
          mode?: 'shallow' | 'deep' | undefined
        }
      | undefined,
  ): Promise<SocketSdkResult<'rescanOrgFullScan'>> {
    const queryString = options
      ? `?${queryToSearchParams(options as QueryParams)}`
      : ''
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}/rescan${queryString}`,
              {},
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'rescanOrgFullScan'>(data)
    } catch (e) {
      return await this.#handleApiError<'rescanOrgFullScan'>(e)
    }
  }

  /**
   * Search for dependencies across monitored projects. Returns matching
   * packages with security information and usage patterns.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   */
  async searchDependencies(
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'searchDependencies'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              'dependencies/search',
              queryParams,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'searchDependencies'>(data)
    } catch (e) {
      return await this.#handleApiError<'searchDependencies'>(e)
    }
  }

  /**
   * Send POST or PUT request with JSON body and return parsed JSON response.
   * Supports both throwing (default) and non-throwing modes.
   *
   * @param urlPath - API endpoint path (e.g., 'organizations')
   * @param options - Request options including method, body, and throws
   *   behavior.
   *
   * @returns Parsed JSON response or SocketSdkGenericResult based on options
   *
   * @operationId sendApi
   *
   * @quota 0 units
   */
  async sendApi<T>(
    urlPath: string,
    options?: SendOptions | undefined,
  ): Promise<T | SocketSdkGenericResult<T>> {
    const {
      body,
      // Default to POST method for JSON API requests.
      method = 'POST',
      throws = true,
    } = { __proto__: null, ...options } as SendOptions

    const url = `${this.#baseUrl}${urlPath}`
    try {
      // Route to appropriate HTTP method handler (POST or PUT).
      const response = await this.#executeWithRetry(async () => {
        const res = await createRequestWithJson(
          method,
          this.#baseUrl,
          urlPath,
          body,
          this.#reqOptionsWithHooks,
        )
        if (!isResponseOk(res)) {
          throw new ResponseError(res, '', url)
        }
        return res
      })

      const data = (await getResponseJson(response)) as T

      if (throws) {
        return data
      }

      return {
        cause: undefined,
        data,
        error: undefined,
        status: response.status,
        success: true,
      }
    } catch (e) {
      if (throws) {
        throw e
      }

      if (e instanceof ResponseError) {
        const errorResult = await this.#handleApiError<never>(e)
        return {
          cause: errorResult.cause,
          data: undefined,
          error: errorResult.error,
          status: errorResult.status,
          success: false,
          url: errorResult.url,
        }
      }

      return this.#createQueryErrorResult<T>(e)
    }
  }

  /**
   * Stream a full scan's results to a file, to stdout, or to the caller.
   *
   * The response body is never buffered: the request resolves as soon as the
   * headers arrive, and the body is piped straight to the destination. Without
   * an `output` the body is left unread on `data.rawResponse` for the caller to
   * pipe or iterate — read or destroy that stream, or the socket stays open.
   *
   * @example
   *   ;```typescript
   *   // Stream to file
   *   await sdk.streamFullScan('my-org', 'scan_123', {
   *     output: './scan-results.json',
   *   })
   *
   *   // Stream to stdout
   *   await sdk.streamFullScan('my-org', 'scan_123', {
   *     output: true,
   *   })
   *
   *   // Consume the body yourself
   *   const result = await sdk.streamFullScan('my-org', 'scan_123')
   *   if (result.success) {
   *     for await (const chunk of result.data.rawResponse) {
   *       // ...
   *     }
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param scanId - Full scan identifier.
   * @param options - Where to send the body. Set `output` to a file path to
   *   write there, or to `true` to write to stdout.
   *
   * @returns Scan result carrying the unconsumed response stream
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/full-scans/{full_scan_id}
   *
   * @quota 1 units
   *
   * @scopes full-scans:list
   *
   * @see https://docs.socket.dev/reference/getorgfullscan
   */
  async streamFullScan(
    orgSlug: string,
    scanId: string,
    options?: StreamOrgFullScanOptions | undefined,
  ): Promise<SocketSdkResult<'getOrgFullScan'>> {
    const { output } = {
      __proto__: null,
      ...options,
    } as StreamOrgFullScanOptions
    try {
      const res = await requestSdkApi(this.#apiContext, {
        path: createOrgApiPath(orgSlug, 'full-scans', scanId),
        stream: true,
      })

      if (typeof output === 'string') {
        const { createWriteStream } = await import('node:fs')
        const { pipeline } = await import('node:stream/promises')
        await pipeline(res.rawResponse!, createWriteStream(output))
      } else if (output === true) {
        const { pipeline } = await import('node:stream/promises')
        // Pipe to stdout but don't end stdout when the source ends.
        await pipeline(res.rawResponse!, process.stdout, { end: false })
      }

      return this.#handleApiSuccess<'getOrgFullScan'>(res)
    } catch (e) {
      return await this.#handleApiError<'getOrgFullScan'>(e)
    }
  }

  /**
   * Stream patches for artifacts in a scan report.
   *
   * This method streams all available patches for artifacts in a scan. Free
   * tier users will only receive free patches.
   *
   * The returned ReadableStream is pull-driven: each `read()` parses only as
   * much of the NDJSON response as that record needs, so the first record is
   * available before the API has finished sending, a slow consumer applies
   * backpressure to the socket, and the full dataset is never resident. A
   * transport that cannot expose the response stream (the browser build's
   * `fetch` backend) falls back to reading the buffered body.
   *
   * @operationId streamPatchesFromScan
   *
   * @quota 100 units
   */
  async streamPatchesFromScan(
    orgSlug: string,
    scanId: string,
  ): Promise<ReadableStream<ArtifactPatches>> {
    const urlPath = `orgs/${encodeURIComponent(orgSlug)}/patches/scan/${encodeURIComponent(scanId)}`
    const url = `${this.#baseUrl}${urlPath}`
    const response = await this.#executeWithRetry(
      async () =>
        await createGetRequest(this.#baseUrl, urlPath, {
          ...this.#reqOptionsWithHooks,
          stream: true,
        }),
    )

    // Check for HTTP error status codes.
    if (!isResponseOk(response)) {
      throw new ResponseError(
        await bufferStreamedErrorResponse(response),
        'GET Request failed',
        url,
      )
    }

    const raw = response.rawResponse
    const lines = iterateNdjsonLines(raw ?? [response.text()])
    return new ReadableStream<ArtifactPatches>({
      async cancel() {
        raw?.destroy()
      },
      async pull(controller) {
        // Skip lines that are not a JSON object and keep reading; enqueue the
        // first record found, then hand control back so the consumer's next
        // read drives the next chunk off the socket.
        for (;;) {
          const next = await lines.next()
          if (next.done) {
            controller.close()
            return
          }
          const record = parseJson(next.value, {
            throws: false,
          }) as ArtifactPatches | null
          if (isObject(record)) {
            controller.enqueue(record)
            return
          }
          debugLog(
            'streamPatchesFromScan',
            `Skipped unparsable line: ${next.value.slice(0, 120)}`,
          )
        }
      },
    })
  }

  /**
   * Update alert triage status for an organization. Modifies alert resolution
   * status and triage decisions.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes triage:alerts-update
   */
  async updateOrgAlertTriage(
    orgSlug: string,
    alertId: string,
    triageData: QueryParams,
  ): Promise<SocketSdkResult<'updateOrgAlertTriage'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/triage/alerts`,
              { alertTriage: [{ uuid: alertId, ...triageData }] },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'updateOrgAlertTriage'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgAlertTriage'>(e)
    }
  }

  /**
   * Update organization's license policy configuration. Modifies allowed,
   * restricted, and monitored license types.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes license-policy:update
   */
  async updateOrgLicensePolicy(
    orgSlug: string,
    policyData: QueryParams,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'updateOrgLicensePolicy'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/settings/license-policy?${queryToSearchParams(queryParams)}`,
              policyData,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'updateOrgLicensePolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgLicensePolicy'>(e)
    }
  }

  /**
   * Update the settings for a repository label. Accepts the structured
   * issue-rules body defined by the API.
   *
   * @param orgSlug - Organization identifier.
   * @param labelId - Label identifier.
   * @param settings - Label settings body (issue rules).
   *
   * @returns Update result.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint PUT /orgs/{org_slug}/repos/labels/{label_id}/label-setting
   *
   * @quota 1 units
   *
   * @scopes repo-label:update
   *
   * @see https://docs.socket.dev/reference/updateorgrepolabelsetting
   */
  async updateOrgRepoLabelSetting(
    orgSlug: string,
    labelId: string,
    settings: UpdateOrgRepoLabelSettingBody,
  ): Promise<SocketSdkResult<'updateOrgRepoLabelSetting'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'PUT',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels/${encodeURIComponent(labelId)}/label-setting`,
              settings,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'updateOrgRepoLabelSetting'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgRepoLabelSetting'>(e)
    }
  }

  /**
   * Update organization's security policy configuration. Modifies alert rules,
   * severity thresholds, and enforcement settings.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes security-policy:update
   */
  async updateOrgSecurityPolicy(
    orgSlug: string,
    policyData: QueryParams,
  ): Promise<SocketSdkResult<'updateOrgSecurityPolicy'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/settings/security-policy`,
              policyData,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'updateOrgSecurityPolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgSecurityPolicy'>(e)
    }
  }

  /**
   * Update organization's telemetry configuration. Enables or disables
   * telemetry for the organization.
   *
   * @param orgSlug - Organization identifier.
   * @param telemetryData - Telemetry configuration with enabled flag.
   *
   * @returns Updated telemetry configuration
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes telemetry-policy:update
   */
  async updateOrgTelemetryConfig(
    orgSlug: string,
    telemetryData: { enabled?: boolean | undefined },
  ): Promise<SocketSdkResult<'updateOrgTelemetryConfig'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'PUT',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/telemetry/config`,
              telemetryData,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'updateOrgTelemetryConfig'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgTelemetryConfig'>(e)
    }
  }

  /**
   * Update an existing webhook's configuration. All fields are optional - only
   * provided fields will be updated.
   *
   * @param orgSlug - Organization identifier.
   * @param webhookId - Webhook ID to update.
   * @param webhookData - Updated webhook configuration.
   *
   * @returns Updated webhook details
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @quota 1 units
   *
   * @scopes webhooks:update
   */
  async updateOrgWebhook(
    orgSlug: string,
    webhookId: string,
    webhookData: {
      description?: null | string | undefined
      events?: string[] | undefined
      filters?: { repositoryIds: null | string[] } | null | undefined
      headers?: null | Record<string, unknown> | undefined
      name?: string | undefined
      secret?: null | string | undefined
      url?: string | undefined
    },
  ): Promise<SocketSdkResult<'updateOrgWebhook'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'PUT',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/webhooks/${encodeURIComponent(webhookId)}`,
              webhookData,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'updateOrgWebhook'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgWebhook'>(e)
    }
  }

  /**
   * Update configuration for a repository.
   *
   * Modifies monitoring settings, branch configuration, and scan preferences.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.updateRepository('my-org', 'my-repo', {
   *     default_branch: 'develop',
   *   })
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param repoSlug - Repository slug/name.
   * @param params - The request body: configuration updates such as
   *   description, homepage, or default_branch.
   * @param options - Optional parameters including workspace.
   *
   * @returns Updated repository details
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/repos/{repo_slug}
   *
   * @quota 1 units
   *
   * @scopes repo:update
   *
   * @see https://docs.socket.dev/reference/updateorgrepo
   */
  async updateRepository(
    orgSlug: string,
    repoSlug: string,
    params: QueryParams,
    options?: GetRepositoryOptions | undefined,
  ): Promise<RepositoryResult | StrictErrorResult> {
    const { workspace } = {
      __proto__: null,
      ...options,
    } as GetRepositoryOptions
    const queryString = workspace
      ? `?${queryToSearchParams({ workspace } as QueryParams)}`
      : ''
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}${queryString}`,
              params,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as RepositoryItem,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'updateOrgRepo'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Update a repository label for an organization.
   *
   * Modifies label properties like name. Label names must be non-empty and less
   * than 1000 characters.
   *
   * @example
   *   ;```typescript
   *   const result = await sdk.updateRepositoryLabel(
   *     'my-org',
   *     'label-id-123',
   *     { name: 'staging' },
   *   )
   *
   *   if (result.success) {
   *     console.log('Label updated:', result.data.name)
   *     console.log('Label ID:', result.data.id)
   *   }
   *   ```
   *
   * @param orgSlug - Organization identifier.
   * @param labelId - Label identifier.
   * @param labelData - Label updates (typically name property)
   *
   * @returns Updated label with guaranteed id and name fields
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint PUT /orgs/{org_slug}/repos/labels/{label_id}
   *
   * @quota 1 units
   *
   * @scopes repo-label:update
   *
   * @see https://docs.socket.dev/reference/updateorgrepolabel
   */
  async updateRepositoryLabel(
    orgSlug: string,
    labelId: string,
    labelData: QueryParams,
  ): Promise<RepositoryLabelResult | StrictErrorResult> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'PUT',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/repos/labels/${encodeURIComponent(labelId)}`,
              labelData,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as RepositoryLabelItem,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<'updateOrgRepoLabel'>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Upload blobs to an organization's content-addressed blob store (v1 API,
   * internal preview — hidden from the public OpenAPI spec). Each entry's
   * hash is computed from `localPath` when omitted; `name` is diagnostics-
   * only metadata (defaults to the file's basename). Idempotent: re-uploading
   * an already-stored digest reports it under `already_existed`.
   *
   * @param orgSlug - Organization identifier.
   * @param entries - Files to upload; see `BlobUploadEntry`.
   *
   * @returns Digests grouped into `stored` (newly written) and
   *   `already_existed`
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint POST /orgs/{org_slug}/blobs (v1)
   *
   * @operationId none
   */
  async uploadBlobs(
    orgSlug: string,
    entries: BlobUploadEntry[],
  ): Promise<UploadBlobsResult | StrictErrorResult> {
    let v1BaseUrl: string
    try {
      v1BaseUrl = this.#requireApiV1BaseUrl()
    } catch (e) {
      return {
        cause: undefined,
        data: undefined,
        error: getErrorMessage(e),
        status: 400,
        success: false,
      }
    }

    const resolvedEntries: Array<{
      absPath: string
      hash: string
      name: string
    }> = []
    for (let i = 0, { length } = entries; i < length; i += 1) {
      const entry = entries[i]!
      let hash: string
      try {
        hash = entry.hash ?? (await hashFile(entry.localPath)).hash
      } catch (e) {
        return {
          cause: getErrorMessage(e),
          data: undefined,
          error: [
            'Failed to hash a blob-upload entry before uploading.',
            `→ Where: uploadBlobs(orgSlug="${orgSlug}"), entries[${i}].localPath`,
            `→ Saw: "${entry.localPath}" — ${getErrorMessage(e)}`,
            '→ Fix: verify the file exists, is a regular file (not a directory), and is readable, then retry.',
          ].join('\n'),
          status: 400,
          success: false,
        }
      }
      resolvedEntries.push({
        absPath: entry.localPath,
        hash,
        name: entry.name ?? path.basename(entry.localPath),
      })
    }

    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createUploadRequest(
              v1BaseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/blobs`,
              createRequestBodyForBlobs(resolvedEntries),
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return {
        cause: undefined,
        data: data as BlobsUploadData,
        error: undefined,
        status: 200,
        success: true,
      }
    } catch (e) {
      const errorResult = await this.#handleApiError<never>(e)
      return {
        cause: errorResult.cause,
        data: undefined,
        error: errorResult.error,
        status: errorResult.status,
        success: false,
      }
    }
  }

  /**
   * Upload manifest files for dependency analysis. Processes package files to
   * create dependency snapshots and security analysis.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @operationId uploadManifestFiles
   *
   * @quota 100 units
   *
   * @scopes packages:upload
   */
  async uploadManifestFiles(
    orgSlug: string,
    filepaths: string[],
    options?: UploadManifestFilesOptions | undefined,
  ): Promise<UploadManifestFilesReturnType | UploadManifestFilesError> {
    const { pathsRelativeTo = '.' } = {
      __proto__: null,
      ...options,
    } as UploadManifestFilesOptions
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)

    // Validate file readability before upload.
    const { invalidPaths, validPaths } = validateFiles(absFilepaths)

    // If callback provided and files were invalid, invoke it.
    if (this.#onFileValidation && invalidPaths.length > 0) {
      const result = await this.#onFileValidation(validPaths, invalidPaths, {
        operation: 'uploadManifestFiles',
        orgSlug,
      })

      if (!result.shouldContinue) {
        const errorMsg = result.errorMessage ?? 'File validation failed'
        const finalCause = filterRedundantCause(errorMsg, result.errorCause)
        return {
          error: errorMsg,
          status: 400,
          success: false,
          ...(finalCause ? { cause: finalCause } : {}),
        }
      }
    }

    // Default behavior if no callback: warn and continue.
    if (!this.#onFileValidation && invalidPaths.length > 0) {
      const samplePaths = invalidPaths.slice(0, 3).join('\n  - ')
      const remaining =
        invalidPaths.length > 3
          ? `\n  ... and ${invalidPaths.length - 3} more`
          : ''
      logger.warn(
        `Warning: ${invalidPaths.length} files skipped (unreadable):\n  - ${samplePaths}${remaining}\n` +
          '→ This may occur with Yarn Berry PnP or pnpm symlinks.\n' +
          '→ Try: Run installation command to ensure files are accessible.',
      )
    }

    // Fail if all files were invalid.
    if (validPaths.length === 0) {
      const samplePaths = invalidPaths.slice(0, 5).join('\n  - ')
      const remaining =
        invalidPaths.length > 5
          ? `\n  ... and ${invalidPaths.length - 5} more`
          : ''
      return {
        cause: [
          `All ${invalidPaths.length} files failed validation:`,
          `  - ${samplePaths}${remaining}`,
          '',
          '→ Common causes:',
          '  ·Yarn Berry PnP virtual filesystem (files are not on disk)',
          '  ·pnpm symlinks pointing to inaccessible locations',
          '  ·Incorrect file permissions',
          '  ·Files were deleted after discovery',
          '',
          '→ Solutions:',
          '  ·Yarn Berry: Use `nodeLinker: node-modules` in .yarnrc.yml',
          '  ·pnpm: Use `node-linker=hoisted` in .npmrc',
          '  ·Check file permissions with: ls -la <file>',
          '  ·Run package manager install command',
        ].join('\n'),
        error: 'No readable manifest files found',
        status: 400,
        success: false,
      }
    }

    // Continue with validated files.
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createUploadRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/upload-manifest-files`,
              createRequestBodyForFilepaths(validPaths, basePath),
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<never>(
        data,
      ) as unknown as UploadManifestFilesReturnType
    } catch (e) {
      /* c8 ignore start - Error handling in uploadManifestFiles method for edge cases. */
      return await this.#handleApiError<never>(e)
      /* c8 ignore stop */
    }
  }

  /**
   * View an organization's computed license policy allow list (Beta). Returns
   * the saturated license policy for the organization.
   *
   * @param orgSlug - Organization identifier.
   *
   * @returns The organization's license policy view.
   *
   * @throws {Error} When server returns 5xx status codes
   *
   * @apiEndpoint GET /orgs/{org_slug}/settings/license-policy/view
   *
   * @quota 1 units
   *
   * @scopes license-policy:read
   *
   * @see https://docs.socket.dev/reference/viewlicensepolicy
   */
  async viewLicensePolicy(
    orgSlug: string,
  ): Promise<SocketSdkResult<'viewLicensePolicy'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/settings/license-policy/view`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return this.#handleApiSuccess<'viewLicensePolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'viewLicensePolicy'>(e)
    }
  }

  /**
   * View detailed information about a specific patch by its UUID.
   *
   * This method retrieves comprehensive patch details including files,
   * vulnerabilities, description, license, and tier information.
   *
   * @operationId viewPatch
   *
   * @quota 10 units
   */
  async viewPatch(orgSlug: string, uuid: string): Promise<PatchViewResponse> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/patches/view/${encodeURIComponent(uuid)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return data as PatchViewResponse
    } catch (e) {
      const result = await this.#handleApiError<never>(e)
      throw new ErrorCtor(result.error, { cause: result.cause })
    }
  }

  /**
   * Search for available patches that fix a specific CVE.
   *
   * Returns a list of patches with high-level metadata (no blob content).
   * Use `viewPatch()` to fetch full patch details including blob content.
   *
   * @operationId fetchPatchesByCVE
   *
   * @quota 10 units
   */
  async fetchPatchesByCVE(
    orgSlug: string,
    cveId: string,
  ): Promise<PatchSearchResponse> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/patches/by-cve/${encodeURIComponent(cveId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return data as PatchSearchResponse
    } catch (e) {
      const result = await this.#handleApiError<never>(e)
      throw new ErrorCtor(result.error, { cause: result.cause })
    }
  }

  /**
   * Search for available patches that fix a specific GHSA.
   *
   * Returns a list of patches with high-level metadata (no blob content).
   * Use `viewPatch()` to fetch full patch details including blob content.
   *
   * @operationId fetchPatchesByGHSA
   *
   * @quota 10 units
   */
  async fetchPatchesByGHSA(
    orgSlug: string,
    ghsaId: string,
  ): Promise<PatchSearchResponse> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/patches/by-ghsa/${encodeURIComponent(ghsaId)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return data as PatchSearchResponse
    } catch (e) {
      const result = await this.#handleApiError<never>(e)
      throw new ErrorCtor(result.error, { cause: result.cause })
    }
  }

  /**
   * Search for available patches for a package specified by PURL.
   *
   * Returns a list of patches with high-level metadata (no blob content).
   * Use `viewPatch()` to fetch full patch details including blob content.
   *
   * @operationId fetchPatchesByPackage
   *
   * @quota 10 units
   */
  async fetchPatchesByPackage(
    orgSlug: string,
    purl: string,
  ): Promise<PatchSearchResponse> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/patches/by-package/${encodeURIComponent(purl)}`,
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return data as PatchSearchResponse
    } catch (e) {
      const result = await this.#handleApiError<never>(e)
      throw new ErrorCtor(result.error, { cause: result.cause })
    }
  }

  /**
   * Search for available patches for multiple packages specified by PURL.
   *
   * Accepts a `components` array in CycloneDX SBOM format, where each
   * component has a `purl` field, allowing direct upload of a CDX file's
   * components array for batch scanning.
   *
   * @operationId fetchPatchesBatch
   *
   * @quota 20 units
   */
  async fetchPatchesBatch(
    orgSlug: string,
    components: Array<{ purl: string }>,
  ): Promise<PatchesBatchResponse> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/patches/batch`,
              { components },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return data as PatchesBatchResponse
    } catch (e) {
      const result = await this.#handleApiError<never>(e)
      throw new ErrorCtor(result.error, { cause: result.cause })
    }
  }

  /**
   * Fetch the metadata records of multiple patches by UUID in one request:
   * the view-endpoint shape (serving PURL, publish date, vulnerabilities,
   * per-file before/after hashes) WITHOUT file contents.
   *
   * Unknown or unpublished UUIDs are listed in `missing`; patches the
   * organization is not entitled to are listed in `forbidden`.
   *
   * @operationId fetchPatchRecords
   *
   * @quota 10 units
   */
  async fetchPatchRecords(
    orgSlug: string,
    uuids: string[],
  ): Promise<PatchRecordsResponse> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/patches/records`,
              { uuids },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return data as PatchRecordsResponse
    } catch (e) {
      const result = await this.#handleApiError<never>(e)
      throw new ErrorCtor(result.error, { cause: result.cause })
    }
  }

  /**
   * Get org-scoped download references for a batch of patches.
   *
   * Send a list of published-patch UUIDs. For each UUID the response
   * returns either a stable, org-unique set of download references for the
   * patched package, or a status explaining why no URL was issued.
   *
   * @operationId getPatchPackages
   *
   * @quota 20 units
   */
  async getPatchPackages(
    orgSlug: string,
    uuids: string[],
    options?: { freeOnly?: boolean | undefined } | undefined,
  ): Promise<GetPatchPackagesResponse> {
    options = { __proto__: null, ...options } as typeof options
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/patches/package`,
              { uuids, freeOnly: options?.freeOnly },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return data as GetPatchPackagesResponse
    } catch (e) {
      const result = await this.#handleApiError<never>(e)
      throw new ErrorCtor(result.error, { cause: result.cause })
    }
  }

  /**
   * High-level statistics for a batch of patch package references granted
   * to this organization.
   *
   * Send a list of package references — each is the download URL, the
   * grant token (the "patch key"), OR the patch UUID. Results are keyed by
   * the reference string sent.
   *
   * @operationId patchPackageStats
   *
   * @quota 10 units
   */
  async patchPackageStats(
    orgSlug: string,
    references: string[],
  ): Promise<PatchPackageStatsResponse> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/patches/package/stats`,
              { references },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return data as PatchPackageStatsResponse
    } catch (e) {
      const result = await this.#handleApiError<never>(e)
      throw new ErrorCtor(result.error, { cause: result.cause })
    }
  }

  /**
   * Look up the patch metadata behind a batch of patch package references
   * granted to this organization.
   *
   * Send a list of package references — each is either the grant token
   * (the "patch key") or the full download URL issued. Results are keyed
   * by the reference string sent.
   *
   * @operationId lookupPatchPackage
   *
   * @quota 10 units
   */
  async lookupPatchPackage(
    orgSlug: string,
    references: string[],
  ): Promise<LookupPatchPackageResponse> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createRequestWithJson(
              'POST',
              this.#baseUrl,
              `orgs/${encodeURIComponent(orgSlug)}/patches/package/lookup`,
              { references },
              this.#reqOptionsWithHooks,
            ),
          ),
      )
      return data as LookupPatchPackageResponse
    } catch (e) {
      const result = await this.#handleApiError<never>(e)
      throw new ErrorCtor(result.error, { cause: result.cause })
    }
  }

  /**
   * Download a compact per-file binary delta (bsdiff/BSDIFF40) archive for
   * the patched files in this patch. The returned bytes are a `.tar.gz`
   * whose entries are named verbatim by the manifest `file_path` and
   * contain the BSDIFF40 bytes for that file.
   *
   * @operationId getPatchDiff
   *
   * @quota 10 units
   */
  async getPatchDiff(orgSlug: string, uuid: string): Promise<Uint8Array> {
    const response = await requestSdkApi(this.#apiContext, {
      path: createOrgApiPath(orgSlug, 'patches', 'diff', uuid),
      maxResponseSize: 100 * 1024 * 1024,
    })
    return new Uint8Array(response.arrayBuffer())
  }

  /**
   * Download a patch blob by its SHA256 content hash. Returns the raw
   * binary content.
   *
   * @operationId getPatchBlob
   *
   * @quota 1 units
   */
  async getPatchBlob(orgSlug: string, hash: string): Promise<Uint8Array> {
    const response = await requestSdkApi(this.#apiContext, {
      path: createOrgApiPath(orgSlug, 'patches', 'blob', hash),
      maxResponseSize: 100 * 1024 * 1024,
    })
    return new Uint8Array(response.arrayBuffer())
  }
  /**
   * Get organization alert policies.
   *
   * @operationId getOrgAlertPolicies
   *
   * @quota 1 units
   *
   * @scopes alert-policy:list
   */
  async getOrgAlertPolicies(
    orgSlug: string,
  ): ReturnType<typeof requestGetOrgAlertPolicies> {
    return await requestGetOrgAlertPolicies(this.#apiContext, orgSlug)
  }

  /**
   * Get organization alert policy.
   *
   * @operationId getOrgAlertPolicy
   *
   * @quota 1 units
   *
   * @scopes alert-policy:read
   */
  async getOrgAlertPolicy(
    orgSlug: string,
    policyId: string,
  ): ReturnType<typeof requestGetOrgAlertPolicy> {
    return await requestGetOrgAlertPolicy(this.#apiContext, orgSlug, policyId)
  }

  /**
   * Create organization alert policy.
   *
   * @operationId createOrgAlertPolicy
   *
   * @quota 1 units
   *
   * @scopes alert-policy:create
   */
  async createOrgAlertPolicy(
    orgSlug: string,
    body: CreateOrgAlertPolicyBody,
    options?: AlertPolicyWriteOptions | undefined,
  ): ReturnType<typeof requestCreateOrgAlertPolicy> {
    return await requestCreateOrgAlertPolicy(
      this.#apiContext,
      orgSlug,
      body,
      options,
    )
  }

  /**
   * Update organization alert policy.
   *
   * @operationId updateOrgAlertPolicy
   *
   * @quota 1 units
   *
   * @scopes alert-policy:update
   */
  async updateOrgAlertPolicy(
    orgSlug: string,
    policyId: string,
    body: UpdateOrgAlertPolicyBody,
    options?: AlertPolicyWriteOptions | undefined,
  ): ReturnType<typeof requestUpdateOrgAlertPolicy> {
    return await requestUpdateOrgAlertPolicy(
      this.#apiContext,
      orgSlug,
      policyId,
      body,
      options,
    )
  }

  /**
   * Delete organization alert policy.
   *
   * @operationId deleteOrgAlertPolicy
   *
   * @quota 1 units
   *
   * @scopes alert-policy:delete
   */
  async deleteOrgAlertPolicy(
    orgSlug: string,
    policyId: string,
    options?: AlertPolicyWriteOptions | undefined,
  ): ReturnType<typeof requestDeleteOrgAlertPolicy> {
    return await requestDeleteOrgAlertPolicy(
      this.#apiContext,
      orgSlug,
      policyId,
      options,
    )
  }

  /**
   * Get organization alert policy rules.
   *
   * @operationId getOrgAlertPolicyRules
   *
   * @quota 1 units
   *
   * @scopes alert-policy:list
   */
  async getOrgAlertPolicyRules(
    orgSlug: string,
    policyId: string,
  ): ReturnType<typeof requestGetOrgAlertPolicyRules> {
    return await requestGetOrgAlertPolicyRules(
      this.#apiContext,
      orgSlug,
      policyId,
    )
  }

  /**
   * Get organization alert policy rule.
   *
   * @operationId getOrgAlertPolicyRule
   *
   * @quota 1 units
   *
   * @scopes alert-policy:read
   */
  async getOrgAlertPolicyRule(
    orgSlug: string,
    policyId: string,
    ruleId: string,
  ): ReturnType<typeof requestGetOrgAlertPolicyRule> {
    return await requestGetOrgAlertPolicyRule(
      this.#apiContext,
      orgSlug,
      policyId,
      ruleId,
    )
  }

  /**
   * Create organization alert policy rule.
   *
   * @operationId createOrgAlertPolicyRule
   *
   * @quota 1 units
   *
   * @scopes alert-policy:create
   */
  async createOrgAlertPolicyRule(
    orgSlug: string,
    policyId: string,
    body: CreateOrgAlertPolicyRuleBody,
    options?: AlertPolicyWriteOptions | undefined,
  ): ReturnType<typeof requestCreateOrgAlertPolicyRule> {
    return await requestCreateOrgAlertPolicyRule(
      this.#apiContext,
      orgSlug,
      policyId,
      body,
      options,
    )
  }

  /**
   * Update organization alert policy rule.
   *
   * @operationId updateOrgAlertPolicyRule
   *
   * @quota 1 units
   *
   * @scopes alert-policy:update
   */
  async updateOrgAlertPolicyRule(
    orgSlug: string,
    policyId: string,
    ruleId: string,
    body: UpdateOrgAlertPolicyRuleBody,
    options?: AlertPolicyWriteOptions | undefined,
  ): ReturnType<typeof requestUpdateOrgAlertPolicyRule> {
    return await requestUpdateOrgAlertPolicyRule(
      this.#apiContext,
      orgSlug,
      policyId,
      ruleId,
      body,
      options,
    )
  }

  /**
   * Delete organization alert policy rule.
   *
   * @operationId deleteOrgAlertPolicyRule
   *
   * @quota 1 units
   *
   * @scopes alert-policy:delete
   */
  async deleteOrgAlertPolicyRule(
    orgSlug: string,
    policyId: string,
    ruleId: string,
    options?: AlertPolicyWriteOptions | undefined,
  ): ReturnType<typeof requestDeleteOrgAlertPolicyRule> {
    return await requestDeleteOrgAlertPolicyRule(
      this.#apiContext,
      orgSlug,
      policyId,
      ruleId,
      options,
    )
  }

  /**
   * Create organization alert resolution.
   *
   * @operationId createOrgAlertResolution
   *
   * @quota 1 units
   *
   * @scopes alert-resolution:create
   */
  async createOrgAlertResolution(
    orgSlug: string,
    body: CreateOrgAlertResolutionBody,
    options?: AlertPolicyWriteOptions | undefined,
  ): ReturnType<typeof requestCreateOrgAlertResolution> {
    return await requestCreateOrgAlertResolution(
      this.#apiContext,
      orgSlug,
      body,
      options,
    )
  }

  /**
   * Get organization alert policy migration status.
   *
   * @operationId getOrgAlertPolicyMigrationStatus
   *
   * @quota 1 units
   *
   * @scopes alert-policy:list
   */
  async getOrgAlertPolicyMigrationStatus(
    orgSlug: string,
  ): ReturnType<typeof requestGetOrgAlertPolicyMigrationStatus> {
    return await requestGetOrgAlertPolicyMigrationStatus(
      this.#apiContext,
      orgSlug,
    )
  }

  /**
   * Translate organization alert policy migration triage.
   *
   * @operationId translateOrgAlertPolicyMigrationTriage
   *
   * @quota 1 units
   */
  async translateOrgAlertPolicyMigrationTriage(
    orgSlug: string,
    body: TranslateOrgAlertPolicyMigrationTriageBody,
  ): ReturnType<typeof requestTranslateOrgAlertPolicyMigrationTriage> {
    return await requestTranslateOrgAlertPolicyMigrationTriage(
      this.#apiContext,
      orgSlug,
      body,
    )
  }

  /**
   * Start an advanced fix computation.
   *
   * @operationId startOrgFixComputation
   *
   * @quota 10 units
   *
   * @scopes fixes:list
   */
  async startOrgFixComputation(
    orgSlug: string,
    options: OrgFixesOptions,
  ): ReturnType<typeof requestStartOrgFixComputation> {
    return await requestStartOrgFixComputation(
      this.#apiContext,
      orgSlug,
      options,
    )
  }

  /**
   * Read an advanced fix computation.
   *
   * @operationId getOrgFixComputation
   *
   * @quota 0 units
   *
   * @scopes fixes:list
   */
  async getOrgFixComputation(
    orgSlug: string,
    computationId: string,
  ): ReturnType<typeof requestOrgFixComputation> {
    return await requestOrgFixComputation(
      this.#apiContext,
      orgSlug,
      computationId,
    )
  }

  /**
   * List package version history through the v1 API.
   *
   * @operationId getOrgPurlVersions
   *
   * @quota 100 units
   *
   * @scopes packages:list
   */
  async getOrgPurlVersions(
    orgSlug: string,
    purl: string,
    options?: PurlVersionsOptions | undefined,
  ): ReturnType<typeof getOrgPurlVersions> {
    return await getOrgPurlVersions(
      this.#apiContext,
      orgSlug,
      purl,
      options,
      this.#requireApiV1BaseUrl(),
    )
  }

  /**
   * Read advanced v1 scan processing, complete, or failed state.
   *
   * @operationId none
   */
  async getOrgFullScanV1(
    orgSlug: string,
    fullScanId: string,
  ): ReturnType<typeof getOrgFullScanV1> {
    return await getOrgFullScanV1(
      this.#apiContext,
      orgSlug,
      fullScanId,
      this.#requireApiV1BaseUrl(),
    )
  }

  /**
   * Poll advanced v1 scan processing until a terminal state.
   *
   * @operationId none
   */
  async pollOrgFullScanV1(
    orgSlug: string,
    fullScanId: string,
    options?: PollFullScanV1Options | undefined,
  ): ReturnType<typeof pollOrgFullScanV1> {
    return await pollOrgFullScanV1(this.#apiContext, orgSlug, fullScanId, {
      ...options,
      baseUrl: this.#requireApiV1BaseUrl(),
    })
  }

  /**
   * Download an advanced verification bundle as gzip bytes.
   *
   * @operationId downloadOrgPatchVerificationBundle
   *
   * @quota 10 units
   */
  async downloadOrgPatchVerificationBundle(
    orgSlug: string,
    uuid: string,
  ): ReturnType<typeof downloadOrgPatchVerificationBundle> {
    return await downloadOrgPatchVerificationBundle(
      this.#apiContext,
      orgSlug,
      uuid,
    )
  }
}

// Optional live heap trace.
/* c8 ignore start - optional debug logging for heap monitoring */
if (isDebugNs('heap')) {
  const used = process.memoryUsage()
  debugLog('heap', `heap used: ${Math.round(used.heapUsed / 1024 / 1024)}MB`)
}
/* c8 ignore stop - end debug logging */
