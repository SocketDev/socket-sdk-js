/**
 * @fileoverview SocketSdk class implementation for Socket security API client.
 * Provides complete API functionality for vulnerability scanning, analysis, and reporting.
 */
import events from 'node:events'
import { createWriteStream } from 'node:fs'
import readline from 'node:readline'

import SOCKET_PUBLIC_API_TOKEN from '@socketsecurity/registry/lib/constants/SOCKET_PUBLIC_API_TOKEN'
import UNKNOWN_ERROR from '@socketsecurity/registry/lib/constants/UNKNOWN_ERROR'
import abortSignal from '@socketsecurity/registry/lib/constants/abort-signal'
import { debugLog, isDebugNs } from '@socketsecurity/registry/lib/debug'
import { jsonParse } from '@socketsecurity/registry/lib/json'
import { getOwn, isObjectObject } from '@socketsecurity/registry/lib/objects'
import { pRetry } from '@socketsecurity/registry/lib/promises'
import { urlSearchParamAsBoolean } from '@socketsecurity/registry/lib/url'

import { DEFAULT_USER_AGENT, httpAgentNames } from './constants'
import {
  createRequestBodyForFilepaths,
  createRequestBodyForJson,
  createUploadRequest,
} from './file-upload'
import {
  ResponseError,
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
  getErrorResponseBody,
  getHttpModule,
  getResponse,
  getResponseJson,
  isResponseOk,
  reshapeArtifactForPublicPolicy,
} from './http-client'
import {
  normalizeBaseUrl,
  promiseWithResolvers,
  queryToSearchParams,
  resolveAbsPaths,
  resolveBasePath,
} from './utils'

import type {
  Agent,
  ArtifactPatches,
  BatchPackageFetchResultType,
  BatchPackageStreamOptions,
  CompactSocketArtifact,
  CreateDependenciesSnapshotOptions,
  CreateOrgFullScanOptions,
  CreateScanFromFilepathsOptions,
  CustomResponseType,
  Entitlement,
  EntitlementsResponse,
  GetOptions,
  GotOptions,
  PatchViewResponse,
  QueryParams,
  RequestOptions,
  SendOptions,
  SocketArtifact,
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
} from './types'
import type { IncomingMessage } from 'node:http'

/**
 * Socket SDK for programmatic access to Socket.dev security analysis APIs.
 * Provides methods for package scanning, organization management, and security analysis.
 */
export class SocketSdk {
  readonly #apiToken: string
  readonly #baseUrl: string
  readonly #reqOptions: RequestOptions
  readonly #retries: number
  readonly #retryDelay: number

  /**
   * Initialize Socket SDK with API token and configuration options.
   * Sets up authentication, base URL, HTTP client options, and retry behavior.
   */
  constructor(apiToken: string, options?: SocketSdkOptions | undefined) {
    const {
      agent: agentOrObj,
      baseUrl = 'https://api.socket.dev/v0/',
      retries = 3,
      retryDelay = 1000,
      timeout,
      userAgent,
    } = { __proto__: null, ...options } as SocketSdkOptions
    const agentKeys = agentOrObj ? Object.keys(agentOrObj) : []
    const agentAsGotOptions = agentOrObj as GotOptions
    const agent = (
      agentKeys.length && agentKeys.every(k => httpAgentNames.has(k))
        ? /* c8 ignore next 3 - Got-style agent options compatibility layer */
          agentAsGotOptions.https ||
          agentAsGotOptions.http ||
          agentAsGotOptions.http2
        : agentOrObj
    ) as Agent | undefined
    this.#apiToken = apiToken
    this.#baseUrl = normalizeBaseUrl(baseUrl)
    this.#retries = retries
    this.#retryDelay = retryDelay
    this.#reqOptions = {
      ...(agent ? { agent } : {}),
      headers: {
        Authorization: `Basic ${btoa(`${apiToken}:`)}`,
        'User-Agent': userAgent ?? DEFAULT_USER_AGENT,
      },
      signal: abortSignal,
      ...(timeout ? { timeout } : {}),
    }
  }

  /**
   * Execute an HTTP request with retry logic.
   * Internal method for wrapping HTTP operations with exponential backoff.
   */
  async #executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    const result = await pRetry(operation, {
      baseDelayMs: this.#retryDelay,
      onRetry(_attempt: number, error: unknown) {
        /* c8 ignore next 3 - Early return for non-ResponseError types in retry logic */
        if (!(error instanceof ResponseError)) {
          return
        }
        const { statusCode } = error.response
        // Don't retry authentication/authorization errors - they won't succeed.
        if (statusCode === 401 || statusCode === 403) {
          throw error
        }
      },
      onRetryRethrow: true,
      retries: this.#retries,
    })
    /* c8 ignore next 3 - Defensive check for undefined result from pRetry abort */
    if (result === undefined) {
      throw new Error('Request aborted')
    }
    return result
  }

  /**
   * Create async generator for streaming batch package URL processing.
   * Internal method for handling chunked PURL responses with error handling.
   */
  async *#createBatchPurlGenerator(
    componentsObj: { components: Array<{ purl: string }> },
    queryParams?: QueryParams | undefined,
  ): AsyncGenerator<BatchPackageFetchResultType> {
    let res: IncomingMessage | undefined
    try {
      res = await this.#executeWithRetry(() =>
        this.#createBatchPurlRequest(componentsObj, queryParams),
      )
    } catch (e) {
      yield await this.#handleApiError<'batchPackageFetch'>(e)
      return
    }
    // Validate response before processing.
    /* c8 ignore next 3 - Defensive check, response should always be defined after successful request */
    if (!res) {
      throw new Error('Failed to get response from batch PURL request')
    }
    // Parse the newline delimited JSON response.
    const rli = readline.createInterface({
      input: res,
      crlfDelay: Number.POSITIVE_INFINITY,
      signal: abortSignal,
    })
    const isPublicToken = this.#apiToken === SOCKET_PUBLIC_API_TOKEN
    for await (const line of rli) {
      const trimmed = line.trim()
      const artifact = trimmed
        ? (jsonParse(line, { throws: false }) as SocketArtifact)
        : /* c8 ignore next - Empty line handling in batch streaming response parsing. */ null
      if (isObjectObject(artifact)) {
        yield this.#handleApiSuccess<'batchPackageFetch'>(
          isPublicToken
            ? /* c8 ignore start - Public token artifact reshaping branch for policy compliance. */ reshapeArtifactForPublicPolicy(
                artifact!,
                false,
                queryParams?.['actions'] as string,
              )
            : /* c8 ignore stop */
              artifact!,
        )
      }
    }
  }

  /**
   * Create HTTP request for batch package URL processing.
   * Internal method for handling PURL batch API calls with retry logic.
   */
  async #createBatchPurlRequest(
    componentsObj: { components: Array<{ purl: string }> },
    queryParams?: QueryParams | undefined,
  ): Promise<IncomingMessage> {
    // Adds the first 'abort' listener to abortSignal.
    const req = getHttpModule(this.#baseUrl)
      .request(`${this.#baseUrl}purl?${queryToSearchParams(queryParams)}`, {
        method: 'POST',
        ...this.#reqOptions,
      })
      .end(JSON.stringify(componentsObj))
    const response = await getResponse(req)

    // Throw ResponseError for non-2xx status codes so retry logic works properly.
    if (!isResponseOk(response)) {
      throw new ResponseError(response)
    }

    return response
  }

  /**
   * Create standardized error result from query operation exceptions.
   * Internal error handling for non-throwing query API methods.
   */
  #createQueryErrorResult<T>(e: unknown): SocketSdkGenericResult<T> {
    if (e instanceof SyntaxError) {
      // Try to get response text from enhanced error, fall back to regex pattern for compatibility.
      const enhancedError = e as SyntaxError & {
        originalResponse?: string | undefined
      }
      /* c8 ignore next - Defensive empty string fallback for originalResponse. */
      let responseText = enhancedError.originalResponse || ''

      /* c8 ignore next 5 - Empty response text fallback check for JSON parsing errors without originalResponse. */
      if (!responseText) {
        const match = e.message.match(/Invalid JSON response:\n([\s\S]*?)\n→/)
        responseText = match?.[1] || ''
      }

      /* c8 ignore next - Defensive empty string fallback when slice returns empty. */
      const preview = responseText.slice(0, 100) || ''
      return {
        cause: `Please report this. JSON.parse threw an error over the following response: \`${preview.trim()}${responseText.length > 100 ? '...' : ''}\``,
        data: undefined,
        error: 'Server returned invalid JSON',
        status: 0,
        success: false,
      }
    }

    /* c8 ignore start - Defensive error stringification fallback branches for edge cases. */
    const errStr = e ? String(e).trim() : ''
    return {
      cause: errStr || UNKNOWN_ERROR,
      data: undefined,
      error: 'API request failed',
      status: 0,
      success: false,
    }
    /* c8 ignore stop */
  }

  /**
   * Extract text content from HTTP response stream.
   * Internal method with size limits to prevent memory exhaustion.
   */
  async #getResponseText(response: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = []
    let size = 0
    // 50MB limit to prevent out-of-memory errors from large responses.
    const MAX = 50 * 1024 * 1024
    for await (const chunk of response) {
      size += chunk.length
      /* c8 ignore next 3 - MAX size limit protection for edge cases */
      if (size > MAX) {
        throw new Error('Response body exceeds maximum size limit')
      }
      chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString('utf8')
  }

  /**
   * Handle API error responses and convert to standardized error result.
   * Internal error handling with status code analysis and message formatting.
   */
  async #handleApiError<T extends SocketSdkOperations>(
    error: unknown,
  ): Promise<SocketSdkErrorResult<T>> {
    if (!(error instanceof ResponseError)) {
      throw new Error('Unexpected Socket API error', {
        cause: error,
      })
    }
    const { statusCode } = error.response
    // Throw server errors (5xx) immediately - these are not recoverable client-side.
    if (statusCode && statusCode >= 500) {
      throw new Error(`Socket API server error (${statusCode})`, {
        cause: error,
      })
    }
    // The error payload may give a meaningful hint as to what went wrong.
    const bodyStr = await getErrorResponseBody(error.response)
    // Try to parse the body as JSON, fallback to treating as plain text.
    let body: string | undefined
    try {
      const parsed: {
        error?:
          | { message?: string | undefined; details?: unknown | undefined }
          | undefined
      } = JSON.parse(bodyStr)
      // Client errors (4xx) should return actionable error messages.
      // Extract both message and details from error response for better context.
      if (typeof parsed?.error?.message === 'string') {
        body = parsed.error.message

        // Include details if present for additional error context.
        if (parsed.error.details) {
          const detailsStr: string =
            typeof parsed.error.details === 'string'
              ? parsed.error.details
              : JSON.stringify(parsed.error.details)
          body = `${body} - Details: ${detailsStr}`
        }
      }
    } catch {
      body = bodyStr
    }
    // Build error message that includes the body content if available.
    let errorMessage = error.message ?? UNKNOWN_ERROR
    const trimmedBody = body?.trim()
    if (trimmedBody && !errorMessage.includes(trimmedBody)) {
      // Replace generic status message with actual error body if present,
      // otherwise append the body to the error message.
      const statusMessage = error.response?.statusMessage
      if (statusMessage && errorMessage.includes(statusMessage)) {
        errorMessage = errorMessage.replace(statusMessage, trimmedBody)
      } else {
        /* c8 ignore next 2 - edge case where statusMessage is undefined or not in error message. */
        errorMessage = `${errorMessage}: ${trimmedBody}`
      }
    }
    return {
      cause: body,
      data: undefined,
      error: errorMessage,
      /* c8 ignore next - fallback for missing status code in edge cases. */
      status: statusCode ?? 0,
      success: false,
    } as SocketSdkErrorResult<T>
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
   * Handle query API response data based on requested response type.
   * Internal method for processing different response formats (json, text, response).
   */
  async #handleQueryResponseData<T>(
    response: IncomingMessage,
    responseType: CustomResponseType,
  ): Promise<T> {
    if (responseType === 'response') {
      return response as T
    }

    if (responseType === 'text') {
      return (await this.#getResponseText(response)) as T
    }

    if (responseType === 'json') {
      return (await getResponseJson(response)) as T
    }

    return response as T
  }

  /**
   * Fetch package analysis data for multiple packages in a single batch request.
   * Returns all results at once after processing is complete.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async batchPackageFetch(
    componentsObj: { components: Array<{ purl: string }> },
    queryParams?: QueryParams | undefined,
  ): Promise<BatchPackageFetchResultType> {
    let res: IncomingMessage | undefined
    try {
      res = await this.#createBatchPurlRequest(componentsObj, queryParams)
    } catch (e) {
      return await this.#handleApiError<'batchPackageFetch'>(e)
    }
    // Validate response before processing.
    /* c8 ignore next 3 - Defensive check, response should always be defined after successful request */
    if (!res) {
      throw new Error('Failed to get response from batch PURL request')
    }
    // Parse the newline delimited JSON response.
    const rli = readline.createInterface({
      input: res,
      crlfDelay: Number.POSITIVE_INFINITY,
      signal: abortSignal,
    })
    const isPublicToken = this.#apiToken === SOCKET_PUBLIC_API_TOKEN
    const results: SocketArtifact[] = []
    for await (const line of rli) {
      const trimmed = line.trim()
      const artifact = trimmed
        ? (jsonParse(line, { throws: false }) as SocketArtifact)
        : /* c8 ignore next - Empty line handling in batch parsing. */ null
      if (isObjectObject(artifact)) {
        results.push(
          isPublicToken
            ? /* c8 ignore start - Public token artifact reshaping for policy compliance. */
              reshapeArtifactForPublicPolicy(
                artifact!,
                false,
                queryParams?.['actions'] as string,
              )
            : /* c8 ignore stop */
              artifact!,
        )
      }
    }
    const compact = urlSearchParamAsBoolean(
      getOwn(queryParams, 'compact') as string | null | undefined,
    )
    return this.#handleApiSuccess<'batchPackageFetch'>(
      compact ? (results as CompactSocketArtifact[]) : results,
    )
  }

  /**
   * Stream package analysis data for multiple packages with chunked processing and concurrency control.
   * Returns results as they become available via async generator.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async *batchPackageStream(
    componentsObj: { components: Array<{ purl: string }> },
    options?: BatchPackageStreamOptions | undefined,
  ): AsyncGenerator<BatchPackageFetchResultType> {
    const {
      chunkSize = 100,
      concurrencyLimit = 10,
      queryParams,
    } = {
      __proto__: null,
      ...options,
    } as BatchPackageStreamOptions

    type GeneratorStep = {
      generator: AsyncGenerator<BatchPackageFetchResultType>
      iteratorResult: IteratorResult<BatchPackageFetchResultType>
    }
    type GeneratorEntry = {
      generator: AsyncGenerator<BatchPackageFetchResultType>
      promise: Promise<GeneratorStep>
    }

    // The createBatchPurlGenerator method will add 2 'abort' event listeners to
    // abortSignal so we multiply the concurrencyLimit by 2.
    const neededMaxListeners = concurrencyLimit * 2
    // Increase abortSignal max listeners count to avoid Node's MaxListenersExceededWarning.
    const oldAbortSignalMaxListeners = events.getMaxListeners(abortSignal)
    let abortSignalMaxListeners = oldAbortSignalMaxListeners
    /* c8 ignore start - EventTarget max listeners adjustment for high concurrency batch operations, difficult to test reliably. */
    if (oldAbortSignalMaxListeners < neededMaxListeners) {
      abortSignalMaxListeners = oldAbortSignalMaxListeners + neededMaxListeners
      events.setMaxListeners(abortSignalMaxListeners, abortSignal)
    }
    /* c8 ignore stop */
    const { components } = componentsObj
    const { length: componentsCount } = components
    const running: GeneratorEntry[] = []
    let index = 0
    const enqueueGen = () => {
      if (index >= componentsCount) {
        // No more work to do.
        return
      }
      const generator = this.#createBatchPurlGenerator(
        {
          // Chunk components.
          components: components.slice(index, index + chunkSize),
        },
        queryParams,
      )
      continueGen(generator)
      index += chunkSize
    }
    const continueGen = (
      generator: AsyncGenerator<BatchPackageFetchResultType>,
    ) => {
      const {
        promise,
        reject: rejectFn,
        resolve: resolveFn,
      } = promiseWithResolvers<GeneratorStep>()
      running.push({
        generator,
        promise,
      })
      void generator
        .next()
        .then(
          iteratorResult => resolveFn({ generator, iteratorResult }),
          rejectFn,
        )
    }
    // Start initial batch of generators.
    while (running.length < concurrencyLimit && index < componentsCount) {
      enqueueGen()
    }
    while (running.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      const { generator, iteratorResult }: GeneratorStep = await Promise.race(
        running.map(entry => entry.promise),
      )
      // Remove generator with safe index lookup.
      const index = running.findIndex(entry => entry.generator === generator)
      /* c8 ignore next 3 - Defensive check for concurrent generator cleanup edge case. */
      if (index === -1) {
        continue
      }
      running.splice(index, 1)
      // Yield the value if one is given, even when done:true.
      if (iteratorResult.value) {
        yield iteratorResult.value
      }
      if (iteratorResult.done) {
        // Start a new generator if available.
        enqueueGen()
      } else {
        // Keep fetching values from this generator.
        continueGen(generator)
      }
    }
    // Reset abortSignal max listeners count.
    /* c8 ignore start - Reset EventTarget max listeners to original value after batch operations. */
    if (abortSignalMaxListeners > oldAbortSignalMaxListeners) {
      events.setMaxListeners(oldAbortSignalMaxListeners, abortSignal)
    }
    /* c8 ignore stop */
  }

  /**
   * Create a snapshot of project dependencies by uploading manifest files.
   * Analyzes dependency files to generate a comprehensive security report.
   *
   * @throws {Error} When server returns 5xx status codes
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
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createUploadRequest(
              this.#baseUrl,
              `dependencies/upload?${queryToSearchParams(queryParams)}`,
              createRequestBodyForFilepaths(absFilepaths, basePath),
              this.#reqOptions,
            ),
          ),
      )
      return this.#handleApiSuccess<'createDependenciesSnapshot'>(data)
    } catch (e) {
      return await this.#handleApiError<'createDependenciesSnapshot'>(e)
    }
  }

  /**
   * Create a diff scan from two full scan IDs.
   * Compares two existing full scans to identify changes.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async createOrgDiffScanFromIds(
    orgSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'createOrgDiffScanFromIds'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/diff-scans?${queryToSearchParams(queryParams)}`,
          {},
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'createOrgDiffScanFromIds'>(data)
    } catch (e) {
      return await this.#handleApiError<'createOrgDiffScanFromIds'>(e)
    }
  }

  /**
   * Create a comprehensive security scan for an organization.
   * Uploads project files and initiates full security analysis.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async createOrgFullScan(
    orgSlug: string,
    filepaths: string[],
    options?: CreateOrgFullScanOptions | undefined,
  ): Promise<SocketSdkResult<'CreateOrgFullScan'>> {
    const { pathsRelativeTo = '.', queryParams } = {
      __proto__: null,
      ...options,
    } as CreateOrgFullScanOptions
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)
    try {
      const data = await getResponseJson(
        await createUploadRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans?${queryToSearchParams(queryParams)}`,
          createRequestBodyForFilepaths(absFilepaths, basePath),
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'CreateOrgFullScan'>(data)
    } catch (e) {
      return await this.#handleApiError<'CreateOrgFullScan'>(e)
    }
  }

  /**
   * Create a new repository in an organization.
   * Registers a repository for monitoring and security scanning.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async createOrgRepo(
    orgSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'createOrgRepo'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos`,
          queryParams,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'createOrgRepo'>(data)
    } catch (e) {
      return await this.#handleApiError<'createOrgRepo'>(e)
    }
  }

  /**
   * Create a new repository label for an organization.
   * Adds label for repository categorization and management.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async createOrgRepoLabel(
    orgSlug: string,
    repoSlug: string,
    labelData: QueryParams,
  ): Promise<SocketSdkResult<'createOrgRepoLabel'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}/labels`,
          labelData,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'createOrgRepoLabel'>(data)
    } catch (e) {
      return await this.#handleApiError<'createOrgRepoLabel'>(e)
    }
  }

  /**
   * Create a security scan by uploading project files.
   * Analyzes uploaded files for security vulnerabilities and policy violations.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async createScanFromFilepaths(
    filepaths: string[],
    options?: CreateScanFromFilepathsOptions | undefined,
  ): Promise<SocketSdkResult<'createReport'>> {
    const { issueRules, pathsRelativeTo = '.' } = {
      __proto__: null,
      ...options,
    } as CreateScanFromFilepathsOptions
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)
    try {
      const data = await getResponseJson(
        await createUploadRequest(
          this.#baseUrl,
          'report/upload',
          [
            ...createRequestBodyForFilepaths(absFilepaths, basePath),
            /* c8 ignore next 3 - Optional issueRules parameter edge case. */
            ...(issueRules
              ? createRequestBodyForJson(issueRules, 'issueRules')
              : []),
          ],
          {
            ...this.#reqOptions,
            method: 'PUT',
          },
        ),
        /* c8 ignore next 3 - Success path return statement requires complex file upload mocking with authentication. */
      )
      return this.#handleApiSuccess<'createReport'>(data)
    } catch (e) {
      return await this.#handleApiError<'createReport'>(e)
    }
  }

  /**
   * Delete a diff scan from an organization.
   * Permanently removes diff scan data and results.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async deleteOrgDiffScan(
    orgSlug: string,
    diffScanId: string,
  ): Promise<SocketSdkResult<'deleteOrgDiffScan'>> {
    try {
      const data = await getResponseJson(
        await createDeleteRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/diff-scans/${encodeURIComponent(diffScanId)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'deleteOrgDiffScan'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgDiffScan'>(e)
    }
  }

  /**
   * Delete a full scan from an organization.
   * Permanently removes scan data and results.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async deleteOrgFullScan(
    orgSlug: string,
    fullScanId: string,
  ): Promise<SocketSdkResult<'deleteOrgFullScan'>> {
    try {
      const data = await getResponseJson(
        await createDeleteRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'deleteOrgFullScan'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgFullScan'>(e)
    }
  }

  /**
   * Delete a repository from an organization.
   * Removes repository monitoring and associated scan data.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async deleteOrgRepo(
    orgSlug: string,
    repoSlug: string,
  ): Promise<SocketSdkResult<'deleteOrgRepo'>> {
    try {
      const data = await getResponseJson(
        await createDeleteRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'deleteOrgRepo'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgRepo'>(e)
    }
  }

  /**
   * Delete a repository label from an organization.
   * Removes label and associated configuration.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async deleteOrgRepoLabel(
    orgSlug: string,
    repoSlug: string,
    labelSlug: string,
  ): Promise<SocketSdkResult<'deleteOrgRepoLabel'>> {
    try {
      const data = await getResponseJson(
        await createDeleteRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}/labels/${encodeURIComponent(labelSlug)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'deleteOrgRepoLabel'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgRepoLabel'>(e)
    }
  }

  /**
   * Delete a scan report permanently.
   * Removes scan data and analysis results from the system.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async deleteReport(
    reportId: string,
  ): Promise<SocketSdkResult<'deleteReport'>> {
    try {
      const data = await getResponseJson(
        await createDeleteRequest(
          this.#baseUrl,
          `report/delete/${encodeURIComponent(reportId)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'deleteReport'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteReport'>(e)
    }
  }

  /**
   * Export scan results in CycloneDX SBOM format.
   * Returns Software Bill of Materials compliant with CycloneDX standard.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async exportCDX(
    orgSlug: string,
    fullScanId: string,
  ): Promise<SocketSdkResult<'exportCDX'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}/sbom/export/cdx`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'exportCDX'>(data)
    } catch (e) {
      return await this.#handleApiError<'exportCDX'>(e)
    }
  }

  /**
   * Export scan results in SPDX SBOM format.
   * Returns Software Bill of Materials compliant with SPDX standard.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async exportSPDX(
    orgSlug: string,
    fullScanId: string,
  ): Promise<SocketSdkResult<'exportSPDX'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}/sbom/export/spdx`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'exportSPDX'>(data)
    } catch (e) {
      return await this.#handleApiError<'exportSPDX'>(e)
    }
  }

  /**
   * Execute a raw GET request to any API endpoint with configurable response type.
   * Supports both throwing (default) and non-throwing modes.
   * @param urlPath - API endpoint path (e.g., 'organizations')
   * @param options - Request options including responseType and throws behavior
   * @returns Raw response, parsed data, or SocketSdkGenericResult based on options
   */
  async getApi<T = IncomingMessage>(
    urlPath: string,
    options?: GetOptions | undefined,
  ): Promise<T | SocketSdkGenericResult<T>> {
    const { responseType = 'response', throws = true } = {
      __proto__: null,
      ...options,
    } as GetOptions

    try {
      const response = await createGetRequest(
        this.#baseUrl,
        urlPath,
        this.#reqOptions,
      )
      // Check for HTTP error status codes first.
      if (!isResponseOk(response)) {
        if (throws) {
          throw new ResponseError(response)
        }
        const errorResult = await this.#handleApiError<never>(
          new ResponseError(response),
        )
        return {
          cause: errorResult.cause,
          data: undefined,
          error: errorResult.error,
          status: errorResult.status,
          success: false,
        }
      }

      const data = await this.#handleQueryResponseData<T>(
        response,
        responseType,
      )

      if (throws) {
        return data as T
      }

      return {
        cause: undefined,
        data,
        error: undefined,
        /* c8 ignore next - Defensive fallback: response.statusCode is always defined in Node.js http/https */
        status: response.statusCode ?? 200,
        success: true,
      }
    } catch (e) {
      if (throws) {
        throw e
      }

      /* c8 ignore start - Defensive fallback: ResponseError in catch block handled in try block (lines 897-910) */
      if (e instanceof ResponseError) {
        // Re-use existing error handling logic from the SDK
        const errorResult = await this.#handleApiError<never>(e)
        return {
          cause: errorResult.cause,
          data: undefined,
          error: errorResult.error,
          status: errorResult.status,
          success: false,
        }
      }
      /* c8 ignore stop */

      /* c8 ignore next - Fallback error handling for non-ResponseError cases in getApi. */
      return this.#createQueryErrorResult<T>(e)
    }
  }

  /**
   * Get list of API tokens for an organization.
   * Returns organization API tokens with metadata and permissions.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getAPITokens(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getAPITokens'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/tokens`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getAPITokens'>(data)
    } catch (e) {
      return await this.#handleApiError<'getAPITokens'>(e)
    }
  }

  /**
   * Retrieve audit log events for an organization.
   * Returns chronological log of security and administrative actions.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getAuditLogEvents(
    orgSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'getAuditLogEvents'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/audit-log?${queryToSearchParams(queryParams)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getAuditLogEvents'>(data)
    } catch (e) {
      return await this.#handleApiError<'getAuditLogEvents'>(e)
    }
  }

  /**
   * Get details for a specific diff scan.
   * Returns comparison between two full scans with artifact changes.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getDiffScanById(
    orgSlug: string,
    diffScanId: string,
  ): Promise<SocketSdkResult<'getDiffScanById'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/diff-scans/${encodeURIComponent(diffScanId)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getDiffScanById'>(data)
    } catch (e) {
      return await this.#handleApiError<'getDiffScanById'>(e)
    }
  }

  /**
   * Retrieve the enabled entitlements for an organization.
   *
   * This method fetches the organization's entitlements and filters for only* the enabled ones, returning their keys. Entitlements represent Socket
   * Products that the organization has access to use.
   */
  async getEnabledEntitlements(orgSlug: string): Promise<string[]> {
    const data = await getResponseJson(
      await createGetRequest(
        this.#baseUrl,
        `orgs/${encodeURIComponent(orgSlug)}/entitlements`,
        this.#reqOptions,
      ),
    )

    // Extract enabled products from the response.
    const items = (data as EntitlementsResponse)?.items || []
    return items
      .filter((item: Entitlement) => item && item.enabled === true && item.key)
      .map((item: Entitlement) => item.key)
  }

  /**
   * Retrieve all entitlements for an organization.
   *
   * This method fetches all entitlements (both enabled and disabled) for
   * an organization, returning the complete list with their status.
   */
  async getEntitlements(orgSlug: string): Promise<Entitlement[]> {
    const data = await getResponseJson(
      await createGetRequest(
        this.#baseUrl,
        `orgs/${encodeURIComponent(orgSlug)}/entitlements`,
        this.#reqOptions,
      ),
    )

    return (data as EntitlementsResponse)?.items || []
  }

  /**
   * Get security issues for a specific npm package and version.
   * Returns detailed vulnerability and security alert information.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getIssuesByNpmPackage(
    pkgName: string,
    version: string,
  ): Promise<SocketSdkResult<'getIssuesByNPMPackage'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `npm/${encodeURIComponent(pkgName)}/${encodeURIComponent(version)}/issues`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getIssuesByNPMPackage'>(data)
    } catch (e) {
      return await this.#handleApiError<'getIssuesByNPMPackage'>(e)
    }
  }

  /**
   * Get analytics data for organization usage patterns and security metrics.
   * Returns statistical analysis for specified time period.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgAnalytics(
    time: string,
  ): Promise<SocketSdkResult<'getOrgAnalytics'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `analytics/org/${encodeURIComponent(time)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgAnalytics'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgAnalytics'>(e)
    }
  }

  /**
   * List all organizations accessible to the current user.
   * Returns organization details and access permissions.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrganizations(): Promise<SocketSdkResult<'getOrganizations'>> {
    try {
      const data = await this.#executeWithRetry(
        async () =>
          await getResponseJson(
            await createGetRequest(
              this.#baseUrl,
              'organizations',
              this.#reqOptions,
            ),
          ),
      )
      return this.#handleApiSuccess<'getOrganizations'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrganizations'>(e)
    }
  }

  /**
   * Get complete full scan results in memory.
   * Returns entire scan data as JSON for programmatic processing.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgFullScanBuffered(
    orgSlug: string,
    fullScanId: string,
  ): Promise<SocketSdkResult<'getOrgFullScan'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgFullScan'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgFullScan'>(e)
    }
  }

  /**
   * List all full scans for an organization.
   * Returns paginated list of scan metadata and status.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgFullScanList(
    orgSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'getOrgFullScanList'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans?${queryToSearchParams(queryParams)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgFullScanList'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgFullScanList'>(e)
    }
  }

  /**
   * Get metadata for a specific full scan.
   * Returns scan configuration, status, and summary information.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgFullScanMetadata(
    orgSlug: string,
    fullScanId: string,
  ): Promise<SocketSdkResult<'getOrgFullScanMetadata'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}/metadata`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgFullScanMetadata'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgFullScanMetadata'>(e)
    }
  }

  /**
   * Get organization's license policy configuration.* Returns allowed, restricted, and monitored license types.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgLicensePolicy(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getOrgLicensePolicy'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/settings/license-policy`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgLicensePolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgLicensePolicy'>(e)
    }
  }

  /**
   * Get details for a specific organization repository.
   * Returns repository configuration, monitoring status, and metadata.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgRepo(
    orgSlug: string,
    repoSlug: string,
  ): Promise<SocketSdkResult<'getOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const repoSlugParam = encodeURIComponent(repoSlug)

    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${orgSlugParam}/repos/${repoSlugParam}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgRepo'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgRepo'>(e)
    }
  }

  /**
   * Get details for a specific repository label.
   * Returns label configuration and metadata.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgRepoLabel(
    orgSlug: string,
    repoSlug: string,
    labelSlug: string,
  ): Promise<SocketSdkResult<'getOrgRepoLabel'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}/labels/${encodeURIComponent(labelSlug)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgRepoLabel'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgRepoLabel'>(e)
    }
  }

  /**
   * Get list of repository labels for an organization.
   * Returns all labels configured for repository management.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgRepoLabelList(
    orgSlug: string,
    repoSlug: string,
  ): Promise<SocketSdkResult<'getOrgRepoLabelList'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}/labels`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgRepoLabelList'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgRepoLabelList'>(e)
    }
  }

  /**
   * List all repositories in an organization.
   * Returns paginated list of repository metadata and status.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgRepoList(
    orgSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'getOrgRepoList'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos?${queryToSearchParams(queryParams)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgRepoList'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgRepoList'>(e)
    }
  }

  /**
   * Get organization's security policy configuration.* Returns alert rules, severity thresholds, and enforcement settings.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgSecurityPolicy(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getOrgSecurityPolicy'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/settings/security-policy`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgSecurityPolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgSecurityPolicy'>(e)
    }
  }

  /**
   * Get organization triage settings and status.
   * Returns alert triage configuration and current state.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getOrgTriage(
    orgSlug: string,
  ): Promise<SocketSdkResult<'getOrgTriage'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/triage`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrgTriage'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgTriage'>(e)
    }
  }

  /**
   * Get current API quota usage and limits.
   * Returns remaining requests, rate limits, and quota reset times.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getQuota(): Promise<SocketSdkResult<'getQuota'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(this.#baseUrl, 'quota', this.#reqOptions),
      )
      return this.#handleApiSuccess<'getQuota'>(data)
    } catch (e) {
      return await this.#handleApiError<'getQuota'>(e)
    }
  }

  /**
   * Get analytics data for a specific repository.
   * Returns security metrics, dependency trends, and vulnerability statistics.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getRepoAnalytics(
    repo: string,
    time: string,
  ): Promise<SocketSdkResult<'getRepoAnalytics'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `analytics/repo/${encodeURIComponent(repo)}/${encodeURIComponent(time)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getRepoAnalytics'>(data)
    } catch (e) {
      return await this.#handleApiError<'getRepoAnalytics'>(e)
    }
  }

  /**
   * Get detailed results for a specific scan.
   * Returns complete scan analysis including vulnerabilities and alerts.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getScan(id: string): Promise<SocketSdkResult<'getReport'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `report/view/${encodeURIComponent(id)}`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getReport'>(data)
    } catch (e) {
      return await this.#handleApiError<'getReport'>(e)
    }
  }

  /**
   * List all scans accessible to the current user.
   * Returns paginated list of scan metadata and status.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getScanList(): Promise<SocketSdkResult<'getReportList'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(this.#baseUrl, 'report/list', this.#reqOptions),
        'GET',
      )
      return this.#handleApiSuccess<'getReportList'>(data)
    } catch (e) {
      return await this.#handleApiError<'getReportList'>(e)
    }
  }

  /**
   * Get security score for a specific npm package and version.
   * Returns numerical security rating and scoring breakdown.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getScoreByNpmPackage(
    pkgName: string,
    version: string,
  ): Promise<SocketSdkResult<'getScoreByNPMPackage'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `npm/${encodeURIComponent(pkgName)}/${encodeURIComponent(version)}/score`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getScoreByNPMPackage'>(data)
    } catch (e) {
      return await this.#handleApiError<'getScoreByNPMPackage'>(e)
    }
  }

  /**
   * Get list of file types and formats supported for scanning.
   * Returns supported manifest files, lockfiles, and configuration formats.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async getSupportedScanFiles(): Promise<
    SocketSdkResult<'getReportSupportedFiles'>
  > {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          'report/supported',
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getReportSupportedFiles'>(data)
    } catch (e) {
      return await this.#handleApiError<'getReportSupportedFiles'>(e)
    }
  }

  /**
   * List all diff scans for an organization.
   * Returns paginated list of diff scan metadata and status.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async listOrgDiffScans(
    orgSlug: string,
  ): Promise<SocketSdkResult<'listOrgDiffScans'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/diff-scans`,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'listOrgDiffScans'>(data)
    } catch (e) {
      return await this.#handleApiError<'listOrgDiffScans'>(e)
    }
  }

  /**
   * Create a new API token for an organization.
   * Generates API token with specified scopes and metadata.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async postAPIToken(
    orgSlug: string,
    tokenData: QueryParams,
  ): Promise<SocketSdkResult<'postAPIToken'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/tokens`,
          tokenData,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'postAPIToken'>(data)
    } catch (e) {
      return await this.#handleApiError<'postAPIToken'>(e)
    }
  }

  /**
   * Revoke an API token for an organization.
   * Permanently disables the token and removes access.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async postAPITokensRevoke(
    orgSlug: string,
    tokenId: string,
  ): Promise<SocketSdkResult<'postAPITokensRevoke'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/tokens/${encodeURIComponent(tokenId)}/revoke`,
          {},
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'postAPITokensRevoke'>(data)
    } catch (e) {
      return await this.#handleApiError<'postAPITokensRevoke'>(e)
    }
  }

  /**
   * Rotate an API token for an organization.
   * Generates new token value while preserving token metadata.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async postAPITokensRotate(
    orgSlug: string,
    tokenId: string,
  ): Promise<SocketSdkResult<'postAPITokensRotate'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/tokens/${encodeURIComponent(tokenId)}/rotate`,
          {},
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'postAPITokensRotate'>(data)
    } catch (e) {
      return await this.#handleApiError<'postAPITokensRotate'>(e)
    }
  }

  /**
   * Update an existing API token for an organization.
   * Modifies token metadata, scopes, or other properties.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async postAPITokenUpdate(
    orgSlug: string,
    tokenId: string,
    updateData: QueryParams,
  ): Promise<SocketSdkResult<'postAPITokenUpdate'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/tokens/${encodeURIComponent(tokenId)}/update`,
          updateData,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'postAPITokenUpdate'>(data)
    } catch (e) {
      return await this.#handleApiError<'postAPITokenUpdate'>(e)
    }
  }

  /**
   * Update user or organization settings.
   * Configures preferences, notifications, and security policies.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async postSettings(
    selectors: Array<{ organization?: string | undefined }>,
  ): Promise<SocketSdkResult<'postSettings'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          'settings',
          { json: selectors },
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'postSettings'>(data)
    } catch (e) {
      return await this.#handleApiError<'postSettings'>(e)
    }
  }

  /**
   * Search for dependencies across monitored projects.
   * Returns matching packages with security information and usage patterns.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async searchDependencies(
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'searchDependencies'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          'dependencies/search',
          queryParams,
          this.#reqOptions,
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
   * @param urlPath - API endpoint path (e.g., 'organizations')
   * @param options - Request options including method, body, and throws behavior
   * @returns Parsed JSON response or SocketSdkGenericResult based on options
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

    try {
      // Route to appropriate HTTP method handler (POST or PUT).
      const response = await createRequestWithJson(
        method,
        this.#baseUrl,
        urlPath,
        body,
        this.#reqOptions,
      )

      const data = (await getResponseJson(response)) as T

      if (throws) {
        return data
      }

      return {
        cause: undefined,
        data,
        error: undefined,
        /* c8 ignore next - Defensive fallback: response.statusCode is always defined in Node.js http/https */
        status: response.statusCode ?? 200,
        success: true,
      }
    } catch (e) {
      if (throws) {
        throw e
      }

      /* c8 ignore start - Defensive fallback: ResponseError in catch block handled in try block (lines 1686-1695) */
      if (e instanceof ResponseError) {
        // Re-use existing error handling logic from the SDK
        const errorResult = await this.#handleApiError<never>(e)
        return {
          cause: errorResult.cause,
          data: undefined,
          error: errorResult.error,
          status: errorResult.status,
          success: false,
        }
      }
      /* c8 ignore stop */

      /* c8 ignore start - Defensive error stringification fallback branches for sendApi edge cases. */
      const errStr = e ? String(e).trim() : ''
      return {
        cause: errStr || UNKNOWN_ERROR,
        data: undefined,
        error: 'API request failed',
        status: 0,
        success: false,
      }
      /* c8 ignore stop */
    }
  }

  /**
   * Stream a full scan's results to file or stdout.* Provides efficient streaming for large scan datasets.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async streamOrgFullScan(
    orgSlug: string,
    fullScanId: string,
    options?: StreamOrgFullScanOptions | undefined,
  ): Promise<SocketSdkResult<'getOrgFullScan'>> {
    const { output } = {
      __proto__: null,
      ...options,
    } as StreamOrgFullScanOptions
    try {
      const req = getHttpModule(this.#baseUrl)
        .request(
          `${this.#baseUrl}orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}`,
          {
            method: 'GET',
            ...this.#reqOptions,
          },
        )
        .end()
      const res = await getResponse(req)

      // Check for HTTP error status codes.
      if (!isResponseOk(res)) {
        throw new ResponseError(res)
      }

      if (typeof output === 'string') {
        // Stream to file with error handling.
        const writeStream = createWriteStream(output)
        res.pipe(writeStream)
        /* c8 ignore next 4 - Write stream error handler, difficult to test reliably */
        writeStream.on('error', error => {
          throw new Error(`Failed to write to file: ${output}`, {
            cause: error,
          })
        })
      } else if (output === true) {
        // Stream to stdout with error handling.
        res.pipe(process.stdout)
        /* c8 ignore next 3 - Stdout error handler, difficult to test reliably */
        process.stdout.on('error', error => {
          throw new Error('Failed to write to stdout', { cause: error })
        })
      }

      // If output is false or undefined, just return the response without streaming
      return this.#handleApiSuccess<'getOrgFullScan'>(res)
    } catch (e) {
      return await this.#handleApiError<'getOrgFullScan'>(e)
    }
  }

  /**
   * Stream patches for artifacts in a scan report.
   *
   * This method streams all available patches for artifacts in a scan.
   * Free tier users will only receive free patches.
   *
   * Note: This method returns a ReadableStream for processing large datasets.
   */
  async streamPatchesFromScan(
    orgSlug: string,
    scanId: string,
  ): Promise<ReadableStream<ArtifactPatches>> {
    const response = await createGetRequest(
      this.#baseUrl,
      `orgs/${encodeURIComponent(orgSlug)}/patches/scan/${encodeURIComponent(scanId)}`,
      this.#reqOptions,
    )

    // Check for HTTP error status codes.
    if (!isResponseOk(response)) {
      throw new ResponseError(response, 'GET Request failed')
    }

    // The response itself is the readable stream for NDJSON data
    // Convert the Node.js readable stream to a Web ReadableStream
    return new ReadableStream<ArtifactPatches>({
      start(controller) {
        response.on('data', (chunk: Buffer) => {
          // Parse NDJSON chunks line by line
          const lines = chunk
            .toString()
            .split('\n')
            .filter(line => line.trim())
          for (const line of lines) {
            try {
              const data = JSON.parse(line) as ArtifactPatches
              controller.enqueue(data)
            } catch (e) {
              // Log parse errors for debugging invalid NDJSON lines.
              debugLog('streamPatchesFromScan', `Failed to parse line: ${e}`)
            }
          }
        })

        response.on('end', () => {
          controller.close()
        })

        response.on('error', error => {
          /* c8 ignore next - Streaming error handler, difficult to test reliably. */
          controller.error(error)
        })
      },
    })
  }

  /**
   * Update alert triage status for an organization.
   * Modifies alert resolution status and triage decisions.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async updateOrgAlertTriage(
    orgSlug: string,
    alertId: string,
    triageData: QueryParams,
  ): Promise<SocketSdkResult<'updateOrgAlertTriage'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'PUT',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/triage/${encodeURIComponent(alertId)}`,
          triageData,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'updateOrgAlertTriage'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgAlertTriage'>(e)
    }
  }

  /**
   * Update organization's license policy configuration.* Modifies allowed, restricted, and monitored license types.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async updateOrgLicensePolicy(
    orgSlug: string,
    policyData: QueryParams,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'updateOrgLicensePolicy'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/settings/license-policy?${queryToSearchParams(queryParams)}`,
          policyData,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'updateOrgLicensePolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgLicensePolicy'>(e)
    }
  }

  /**
   * Update configuration for an organization repository.
   * Modifies monitoring settings, branch configuration, and scan preferences.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async updateOrgRepo(
    orgSlug: string,
    repoSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'updateOrgRepo'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}`,
          queryParams,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'updateOrgRepo'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgRepo'>(e)
    }
  }

  /**
   * Update a repository label for an organization.
   * Modifies label properties and configuration.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async updateOrgRepoLabel(
    orgSlug: string,
    repoSlug: string,
    labelSlug: string,
    labelData: QueryParams,
  ): Promise<SocketSdkResult<'updateOrgRepoLabel'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'PUT',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}/labels/${encodeURIComponent(labelSlug)}`,
          labelData,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'updateOrgRepoLabel'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgRepoLabel'>(e)
    }
  }

  /**
   * Update organization's security policy configuration.* Modifies alert rules, severity thresholds, and enforcement settings.
   *
   * @throws {Error} When server returns 5xx status codes
   */
  async updateOrgSecurityPolicy(
    orgSlug: string,
    policyData: QueryParams,
  ): Promise<SocketSdkResult<'updateOrgSecurityPolicy'>> {
    try {
      const data = await getResponseJson(
        await createRequestWithJson(
          'POST',
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/settings/security-policy`,
          policyData,
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'updateOrgSecurityPolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgSecurityPolicy'>(e)
    }
  }

  /**
   * Upload manifest files for dependency analysis.
   * Processes package files to create dependency snapshots and security analysis.
   *
   * @throws {Error} When server returns 5xx status codes
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
    try {
      const data = await getResponseJson(
        await createUploadRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/upload-manifest-files`,
          createRequestBodyForFilepaths(absFilepaths, basePath),
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<never>(
        data,
      ) as unknown as UploadManifestFilesReturnType
    } catch (e) {
      /* c8 ignore start - Error handling in uploadManifestFiles method for edge cases. */
      return (await this.#handleApiError<never>(
        e,
      )) as unknown as UploadManifestFilesError
      /* c8 ignore stop */
    }
  }

  /**
   * View detailed information about a specific patch by its UUID.
   *
   * This method retrieves comprehensive patch details including files,
   * vulnerabilities, description, license, and tier information.
   */
  async viewPatch(orgSlug: string, uuid: string): Promise<PatchViewResponse> {
    const data = await getResponseJson(
      await createGetRequest(
        this.#baseUrl,
        `orgs/${encodeURIComponent(orgSlug)}/patches/view/${encodeURIComponent(uuid)}`,
        this.#reqOptions,
      ),
    )

    return data as PatchViewResponse
  }
}

// Optional live heap trace.
/* c8 ignore start - optional debug logging for heap monitoring */
if (isDebugNs('heap')) {
  const used = process.memoryUsage()
  debugLog('heap', `heap used: ${Math.round(used.heapUsed / 1024 / 1024)}MB`)
}
/* c8 ignore stop - end debug logging */
