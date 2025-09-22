import events from 'node:events'
import { createReadStream, createWriteStream } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import readline from 'node:readline'
import { Readable } from 'node:stream'

import abortSignal from '@socketsecurity/registry/lib/constants/abort-signal'
import SOCKET_PUBLIC_API_TOKEN from '@socketsecurity/registry/lib/constants/socket-public-api-token'
import { debugLog, isDebug } from '@socketsecurity/registry/lib/debug'
import { jsonParse } from '@socketsecurity/registry/lib/json'
import { getOwn, isObjectObject } from '@socketsecurity/registry/lib/objects'
import { pRetry } from '@socketsecurity/registry/lib/promises'
import {
  parseUrl,
  urlSearchParamAsArray,
  urlSearchParamAsBoolean,
} from '@socketsecurity/registry/lib/url'

// Import attributes are only supported when the '--module' option is set to
// 'esnext', 'node18', 'node20', 'nodenext', or 'preserve'.
// @ts-ignore: Avoid TS import attributes error.
import rootPkgJson from '../package.json' with { type: 'json' }

import type { components, operations } from '../types/api'
import type { OpErrorType, OpReturnType } from '../types/api-helpers'
import type { Remap } from '@socketsecurity/registry/lib/objects'
import type { ClientHttp2Session } from 'http2-wrapper'
import type { ReadStream } from 'node:fs'
import type {
  ClientRequest,
  Agent as HttpAgent,
  RequestOptions as HttpRequestOptions,
  IncomingMessage,
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

export type Agent = HttpsAgent | HttpAgent | ClientHttp2Session

export type BatchPackageFetchResultType = SocketSdkResult<'batchPackageFetch'>

export type BatchPackageStreamOptions = {
  chunkSize?: number | undefined
  concurrencyLimit?: number | undefined
  queryParams?: QueryParams | undefined
}

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

export type SocketArtifact = Remap<
  Omit<components['schemas']['SocketArtifact'], 'alerts'> & {
    alerts?: SocketArtifactAlert[]
  }
>

export type SocketArtifactAlert = Remap<
  Omit<components['schemas']['SocketAlert'], 'action' | 'props' | 'type'> & {
    type: ALERT_TYPE
    action?: ALERT_ACTION
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

const DEFAULT_USER_AGENT = createUserAgentFromPkgJson(rootPkgJson)

// Public security policy.
const publicPolicy = new Map<ALERT_TYPE, ALERT_ACTION>([
  // error (1):
  ['malware', 'error'],
  // warn (7):
  ['criticalCVE', 'warn'],
  ['didYouMean', 'warn'],
  ['gitDependency', 'warn'],
  ['httpDependency', 'warn'],
  ['licenseSpdxDisj', 'warn'],
  ['obfuscatedFile', 'warn'],
  ['troll', 'warn'],
  // monitor (7):
  ['deprecated', 'monitor'],
  ['mediumCVE', 'monitor'],
  ['mildCVE', 'monitor'],
  ['shrinkwrap', 'monitor'],
  ['telemetry', 'monitor'],
  ['unpopularPackage', 'monitor'],
  ['unstableOwnership', 'monitor'],
  // ignore (85):
  ['ambiguousClassifier', 'ignore'],
  ['badEncoding', 'ignore'],
  ['badSemver', 'ignore'],
  ['badSemverDependency', 'ignore'],
  ['bidi', 'ignore'],
  ['binScriptConfusion', 'ignore'],
  ['chromeContentScript', 'ignore'],
  ['chromeHostPermission', 'ignore'],
  ['chromePermission', 'ignore'],
  ['chromeWildcardHostPermission', 'ignore'],
  ['chronoAnomaly', 'ignore'],
  ['compromisedSSHKey', 'ignore'],
  ['copyleftLicense', 'ignore'],
  ['cve', 'ignore'],
  ['debugAccess', 'ignore'],
  ['deprecatedLicense', 'ignore'],
  ['deprecatedException', 'ignore'],
  ['dynamicRequire', 'ignore'],
  ['emptyPackage', 'ignore'],
  ['envVars', 'ignore'],
  ['explicitlyUnlicensedItem', 'ignore'],
  ['extraneousDependency', 'ignore'],
  ['fileDependency', 'ignore'],
  ['filesystemAccess', 'ignore'],
  ['floatingDependency', 'ignore'],
  ['gitHubDependency', 'ignore'],
  ['gptAnomaly', 'ignore'],
  ['gptDidYouMean', 'ignore'],
  ['gptMalware', 'ignore'],
  ['gptSecurity', 'ignore'],
  ['hasNativeCode', 'ignore'],
  ['highEntropyStrings', 'ignore'],
  ['homoglyphs', 'ignore'],
  ['installScripts', 'ignore'],
  ['invalidPackageJSON', 'ignore'],
  ['invisibleChars', 'ignore'],
  ['licenseChange', 'ignore'],
  ['licenseException', 'ignore'],
  ['longStrings', 'ignore'],
  ['majorRefactor', 'ignore'],
  ['manifestConfusion', 'ignore'],
  ['minifiedFile', 'ignore'],
  ['miscLicenseIssues', 'ignore'],
  ['missingAuthor', 'ignore'],
  ['missingDependency', 'ignore'],
  ['missingLicense', 'ignore'],
  ['missingTarball', 'ignore'],
  ['mixedLicense', 'ignore'],
  ['modifiedException', 'ignore'],
  ['modifiedLicense', 'ignore'],
  ['networkAccess', 'ignore'],
  ['newAuthor', 'ignore'],
  ['noAuthorData', 'ignore'],
  ['noBugTracker', 'ignore'],
  ['noLicenseFound', 'ignore'],
  ['noREADME', 'ignore'],
  ['noRepository', 'ignore'],
  ['noTests', 'ignore'],
  ['noV1', 'ignore'],
  ['noWebsite', 'ignore'],
  ['nonOSILicense', 'ignore'],
  ['nonSPDXLicense', 'ignore'],
  ['nonpermissiveLicense', 'ignore'],
  ['notice', 'ignore'],
  ['obfuscatedRequire', 'ignore'],
  ['peerDependency', 'ignore'],
  ['potentialVulnerability', 'ignore'],
  ['semverAnomaly', 'ignore'],
  ['shellAccess', 'ignore'],
  ['shellScriptOverride', 'ignore'],
  ['socketUpgradeAvailable', 'ignore'],
  ['suspiciousStarActivity', 'ignore'],
  ['suspiciousString', 'ignore'],
  ['trivialPackage', 'ignore'],
  ['typeModuleCompatibility', 'ignore'],
  ['uncaughtOptionalDependency', 'ignore'],
  ['unclearLicense', 'ignore'],
  ['unidentifiedLicense', 'ignore'],
  ['unmaintained', 'ignore'],
  ['unpublished', 'ignore'],
  ['unresolvedRequire', 'ignore'],
  ['unsafeCopyright', 'ignore'],
  ['unusedDependency', 'ignore'],
  ['urlStrings', 'ignore'],
  ['usesEval', 'ignore'],
  ['zeroWidth', 'ignore'],
])

class ResponseError extends Error {
  response: IncomingMessage
  constructor(response: IncomingMessage, message: string = '') {
    /* c8 ignore next 2 - statusCode and statusMessage may be undefined in edge cases */
    const statusCode = response.statusCode ?? 'unknown'
    const statusMessage = response.statusMessage ?? 'No status message'
    super(
      /* c8 ignore next - fallback empty message if not provided */
      `Socket API ${message || 'Request failed'} (${statusCode}): ${statusMessage}`,
    )
    this.name = 'ResponseError'
    this.response = response
    Error.captureStackTrace(this, ResponseError)
  }
}

async function createDeleteRequest(
  baseUrl: string,
  urlPath: string,
  options: RequestOptions,
): Promise<IncomingMessage> {
  const req = getHttpModule(baseUrl)
    .request(`${baseUrl}${urlPath}`, {
      method: 'DELETE',
      ...options,
    })
    .end()
  return await getResponse(req)
}

async function createGetRequest(
  baseUrl: string,
  urlPath: string,
  options: RequestOptions,
): Promise<IncomingMessage> {
  const req = getHttpModule(baseUrl)
    .request(`${baseUrl}${urlPath}`, {
      method: 'GET',
      ...options,
    })
    .end()
  return await getResponse(req)
}

async function createPostRequest(
  baseUrl: string,
  urlPath: string,
  postJson: any,
  options: RequestOptions,
): Promise<IncomingMessage> {
  const req = getHttpModule(baseUrl)
    .request(`${baseUrl}${urlPath}`, {
      method: 'POST',
      ...options,
    })
    .end(JSON.stringify(postJson))
  return await getResponse(req)
}

// Exported for testing.
export function createRequestBodyForFilepaths(
  filepaths: string[],
  basePath: string,
): Array<Array<string | ReadStream>> {
  const requestBody = []
  for (const absPath of filepaths) {
    const relPath = path.relative(basePath, absPath)
    const filename = path.basename(absPath)
    requestBody.push([
      `Content-Disposition: form-data; name="${relPath}"; filename="${filename}"\r\n`,
      `Content-Type: application/octet-stream\r\n\r\n`,
      createReadStream(absPath, { highWaterMark: 1024 * 1024 }),
    ])
  }
  return requestBody
}

function createRequestBodyForJson(
  jsonData: any,
  basename = 'data.json',
): Array<string | Readable> {
  const ext = path.extname(basename)
  const name = path.basename(basename, ext)
  return [
    `Content-Disposition: form-data; name="${name}"; filename="${basename}"\r\n` +
      `Content-Type: application/json\r\n\r\n`,
    Readable.from(JSON.stringify(jsonData), { highWaterMark: 1024 * 1024 }),
    '\r\n',
  ]
}

async function createUploadRequest(
  baseUrl: string,
  urlPath: string,
  requestBodyNoBoundaries: Array<string | Readable | Array<string | Readable>>,
  options: RequestOptions,
): Promise<IncomingMessage> {
  // This function constructs and sends a multipart/form-data HTTP POST request
  // where each part is streamed to the server. It supports string payloads
  // and readable streams (e.g., large file uploads).

  // The body is streamed manually with proper backpressure support to avoid
  // overwhelming Node.js memory (i.e., avoiding out-of-memory crashes for large inputs).

  // We call `flushHeaders()` early to ensure headers are sent before body transmission
  // begins. If the server rejects the request (e.g., bad org or auth), it will likely
  // respond immediately. We listen for that response while still streaming the body.
  //
  // This protects against cases where the server closes the connection (EPIPE/ECONNRESET)
  // mid-stream, which would otherwise cause hard-to-diagnose failures during file upload.
  //
  // Example failure this mitigates: `socket scan create --org badorg`

  // eslint-disable-next-line no-async-promise-executor
  return await new Promise(async (pass, fail) => {
    const boundary = `NodeMultipartBoundary${Date.now()}`
    const boundarySep = `--${boundary}\r\n`
    const finalBoundary = `--${boundary}--\r\n`

    const requestBody = [
      ...requestBodyNoBoundaries.flatMap(part => [
        boundarySep,
        ...(Array.isArray(part) ? part : [part]),
      ]),
      finalBoundary,
    ]

    const url = new URL(urlPath, baseUrl)
    const req: ClientRequest = getHttpModule(baseUrl).request(url, {
      method: 'POST',
      ...options,
      headers: {
        ...(options as HttpsRequestOptions)?.headers,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    })

    // Send headers early to prompt server validation (auth, URL, quota, etc.).
    req.flushHeaders()

    // Concurrently wait for response while we stream body.
    getResponse(req).then(pass, fail)

    let aborted = false
    req.on('error', () => (aborted = true))
    req.on('close', () => (aborted = true))

    try {
      for (const part of requestBody) {
        /* c8 ignore next 3 - aborted state is difficult to test reliably */
        if (aborted) {
          break
        }
        if (typeof part === 'string') {
          /* c8 ignore next 5 - backpressure handling requires specific stream conditions */
          if (!req.write(part)) {
            // Wait for 'drain' if backpressure is signaled.
            // eslint-disable-next-line no-await-in-loop
            await events.once(req, 'drain')
          }
        } else if (typeof part?.pipe === 'function') {
          // Stream data chunk-by-chunk with backpressure support.
          const stream = part as Readable
          // eslint-disable-next-line no-await-in-loop
          for await (const chunk of stream) {
            /* c8 ignore next 3 - aborted state during streaming is difficult to test reliably */
            if (aborted) {
              break
            }
            /* c8 ignore next 3 - backpressure handling requires specific stream conditions */
            if (!req.write(chunk)) {
              await events.once(req, 'drain')
            }
          }
          // Ensure trailing CRLF after file part.
          /* c8 ignore next 4 - trailing CRLF backpressure handling is edge case */
          if (!aborted && !req.write('\r\n')) {
            // eslint-disable-next-line no-await-in-loop
            await events.once(req, 'drain')
          }
          // Cleanup stream to free memory buffers.
          if (typeof part.destroy === 'function') {
            part.destroy()
          }
          /* c8 ignore next 3 - defensive check for non-string/stream types */
        } else {
          throw new TypeError('Expected string or stream')
        }
      }
    } catch (e) {
      req.destroy(e as Error)
      fail(e)
    } finally {
      if (!aborted) {
        req.end()
      }
    }
  })
}

function desc(value: any) {
  return {
    __proto__: null,
    configurable: true,
    value,
    writable: true,
  } as PropertyDescriptor
}

async function getErrorResponseBody(
  response: IncomingMessage,
): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  const MAX = 5 * 1024 * 1024
  return await new Promise<string>((resolve, reject) => {
    const cleanup = () => {
      response.off('end', onEnd)
      response.off('error', onError)
      response.off('data', onData)
    }
    const onData = (chunk: Buffer) => {
      size += chunk.length
      /* c8 ignore next 4 - MAX size limit protection for edge cases */
      if (size > MAX) {
        response.destroy()
        cleanup()
        reject(new Error('Response body too large'))
      } else {
        chunks.push(chunk)
      }
    }
    const onEnd = () => {
      cleanup()
      resolve(Buffer.concat(chunks).toString('utf8'))
    }
    /* c8 ignore next 4 - error handling for rare stream failures */
    const onError = (e: unknown) => {
      cleanup()
      reject(e)
    }
    response.on('data', onData)
    response.on('end', onEnd)
    response.on('error', onError)
  })
}

function getHttpModule(url: string): typeof http | typeof https {
  const urlObj = parseUrl(url)
  return urlObj?.protocol === 'http:' ? http : https
}

async function getResponse(req: ClientRequest): Promise<IncomingMessage> {
  const res = await new Promise<IncomingMessage>((resolve, reject) => {
    const cleanup = () => {
      req.off('response', onResponse)
      req.off('error', onError)
      req.off('timeout', onTimeout)
      abortSignal?.removeEventListener('abort', onAbort)
    }
    /* c8 ignore next 5 - abort signal handling for external cancellation */
    const onAbort = () => {
      cleanup()
      req.destroy()
      reject(new Error('Request aborted by signal'))
    }
    const onError = (e: Error) => {
      cleanup()
      reject(e)
    }
    const onResponse = (res: IncomingMessage) => {
      cleanup()
      resolve(res)
    }
    const onTimeout = () => {
      cleanup()
      req.destroy()
      reject(new Error('Request timeout'))
    }
    req.on('response', onResponse)
    req.on('error', onError)
    req.on('timeout', onTimeout)
    abortSignal?.addEventListener('abort', onAbort)
  })

  if (!isResponseOk(res)) {
    throw new ResponseError(res, `${req.method} request failed`)
  }
  return res
}

async function getResponseJson(response: IncomingMessage) {
  const chunks = []
  let size = 0
  const MAX = 50 * 1024 * 1024
  for await (const chunk of response) {
    size += chunk.length
    /* c8 ignore next 3 - MAX size limit protection for edge cases */
    if (size > MAX) {
      throw new Error('JSON body too large')
    }
    chunks.push(chunk)
  }
  const data = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(data)
  } catch (e) {
    const message = (e as Error)?.['message'] || 'Unknown error'
    throw new SyntaxError(
      `Socket API - Invalid JSON response:\n${data}\n→ ${message}`,
      { cause: e },
    )
  }
}

function isResponseOk(response: IncomingMessage): boolean {
  const { statusCode } = response
  return (
    typeof statusCode === 'number' && statusCode >= 200 && statusCode <= 299
  )
}

function promiseWithResolvers<T>(): ReturnType<
  typeof Promise.withResolvers<T>
> {
  /* c8 ignore next 3 - polyfill for older Node versions without Promise.withResolvers */
  if (Promise.withResolvers) {
    return Promise.withResolvers<T>()
  }

  /* c8 ignore next 7 - polyfill implementation for older Node versions */
  const obj = {} as ReturnType<typeof Promise.withResolvers<T>>
  obj.promise = new Promise<T>((resolver, reject) => {
    obj.resolve = resolver
    obj.reject = reject
  })
  return obj
}

function queryToSearchParams(
  init?:
    | URLSearchParams
    | string
    | QueryParams
    | Iterable<[string, any]>
    | ReadonlyArray<[string, any]>
    | null
    | undefined,
): URLSearchParams {
  const params = new URLSearchParams(init ?? '')
  const normalized = { __proto__: null } as unknown as QueryParams
  const entries: Iterable<[string, any]> = params.entries()
  for (const entry of entries) {
    let key = entry[0]
    const value = entry[1]
    if (key === 'defaultBranch') {
      /* c8 ignore next - query parameter normalization for API compatibility */
      key = 'default_branch'
    } else if (key === 'perPage') {
      /* c8 ignore next 2 - query parameter normalization for API compatibility */
      key = 'per_page'
    }
    /* c8 ignore next - skip undefined/null values in params */
    if (value || value === 0) {
      normalized[key] = value
    }
  }
  return new URLSearchParams(normalized)
}

function reshapeArtifactForPublicPolicy<
  T extends SocketArtifact | CompactSocketArtifact,
>(artifact: T, queryParams?: QueryParams | undefined): T {
  const alerts = artifact.alerts as SocketArtifactAlert[]
  if (Array.isArray(alerts)) {
    const allowedActions = urlSearchParamAsArray(getOwn(queryParams, 'actions'))
    const filteredAlerts = []
    const shouldFilterByAction = allowedActions.length > 0
    for (const alert of alerts) {
      if (isObjectObject(alert)) {
        const publicAction = publicPolicy.get(alert.type)
        /* c8 ignore next - fallback to existing alert.action if publicAction not found */
        const alertAction = publicAction ?? (alert.action as ALERT_ACTION)
        /* c8 ignore next - filtering logic based on allowed actions */
        if (shouldFilterByAction && !allowedActions.includes(alertAction)) {
          /* c8 ignore next 2 - continue when action not in allowed list */
          continue
        }
        if (publicAction) {
          alert.action = publicAction
        }
        filteredAlerts.push(alert)
      }
    }
    artifact.alerts = filteredAlerts
  }
  return artifact
}

function resolveAbsPaths(
  filepaths: string[],
  pathsRelativeTo?: string,
): string[] {
  const basePath = resolveBasePath(pathsRelativeTo)
  // Node's path.resolve will process path segments from right to left until
  // it creates a valid absolute path. So if `pathsRelativeTo` is an absolute
  // path, process.cwd() is not used, which is the common expectation. If none
  // of the paths resolve then it defaults to process.cwd().
  return filepaths.map(p => path.resolve(basePath, p))
}

function resolveBasePath(pathsRelativeTo = '.'): string {
  // Node's path.resolve will process path segments from right to left until
  // it creates a valid absolute path. So if `pathsRelativeTo` is an absolute
  // path, process.cwd() is not used, which is the common expectation. If none
  // of the paths resolve then it defaults to process.cwd().
  return path.resolve(process.cwd(), pathsRelativeTo)
}

/**
 * Package.json data to base the User-Agent on
 */
export function createUserAgentFromPkgJson(pkgData: {
  name: string
  version: string
  homepage?: string | undefined
}): string {
  const { homepage } = pkgData
  const name = pkgData.name.replace('@', '').replace('/', '-')
  /* c8 ignore next - homepage URL is optional in package.json */
  return `${name}/${pkgData.version}${homepage ? ` (${homepage})` : ''}`
}

// https://github.com/sindresorhus/got/blob/v14.4.6/documentation/2-options.md#agent
const agentNames = new Set(['http', 'https', 'http2'])

export class SocketSdk {
  readonly #apiToken: string
  readonly #baseUrl: string
  readonly #reqOptions: RequestOptions

  constructor(apiToken: string, options?: SocketSdkOptions | undefined) {
    const {
      agent: agentOrObj,
      baseUrl = 'https://api.socket.dev/v0/',
      timeout,
      userAgent,
    } = { __proto__: null, ...options } as SocketSdkOptions
    const agentKeys = agentOrObj ? Object.keys(agentOrObj) : []
    const agentAsGotOptions = agentOrObj as GotOptions
    const agent = (
      agentKeys.length && agentKeys.every(k => agentNames.has(k))
        ? /* c8 ignore next 3 - Got-style agent options compatibility layer */
          agentAsGotOptions.https ||
          agentAsGotOptions.http ||
          agentAsGotOptions.http2
        : agentOrObj
    ) as Agent | undefined
    this.#apiToken = apiToken
    this.#baseUrl = baseUrl
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
    return await getResponse(req)
  }

  async *#createBatchPurlGenerator(
    componentsObj: { components: Array<{ purl: string }> },
    queryParams?: QueryParams | undefined,
  ): AsyncGenerator<BatchPackageFetchResultType> {
    let res: IncomingMessage | undefined
    try {
      res = await pRetry(
        () => this.#createBatchPurlRequest(componentsObj, queryParams),
        {
          retries: 4,
          onRetryRethrow: true,
          onRetry(_attempt: number, error: unknown) {
            if (!(error instanceof ResponseError)) {
              return
            }
            const { statusCode } = error.response
            if (statusCode === 401 || statusCode === 403) {
              throw error
            }
          },
        },
      )
    } catch (e) {
      return await this.#handleApiError<'batchPackageFetch'>(e)
    }
    // Parse the newline delimited JSON response.
    const rli = readline.createInterface({
      input: res,
      crlfDelay: Infinity,
      signal: abortSignal,
    })
    const isPublicToken = this.#apiToken === SOCKET_PUBLIC_API_TOKEN
    for await (const line of rli) {
      const trimmed = line.trim()
      const artifact = trimmed
        ? (jsonParse(line, { throws: false }) as SocketArtifact)
        : null
      if (isObjectObject(artifact)) {
        yield this.#handleApiSuccess<'batchPackageFetch'>(
          /* c8 ignore next - conditional is always reached, added for clarity */
          isPublicToken
            ? /* c8 ignore next - public token reshaping branch */ reshapeArtifactForPublicPolicy(
                artifact!,
                queryParams,
              )
            : artifact!,
        )
      }
    }
  }

  async #handleApiError<T extends SocketSdkOperations>(
    error: unknown,
  ): Promise<SocketSdkErrorResult<T>> {
    if (!(error instanceof ResponseError)) {
      throw new Error('Unexpected Socket API error', {
        cause: error,
      })
    }
    const { statusCode } = error.response
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
      const parsed = JSON.parse(bodyStr)
      // A 400 should return an actionable message.
      // TODO: Do we care about the body.error.details object?
      if (typeof parsed?.error?.message === 'string') {
        body = parsed.error.message
      }
    } catch {
      body = bodyStr
    }
    return {
      success: false,
      /* c8 ignore next 2 - fallback for missing status code in edge cases */
      status: statusCode ?? 0,
      error: error.message ?? 'Unknown error',
      cause: body,
    } as SocketSdkErrorResult<T>
  }

  #handleApiSuccess<T extends SocketSdkOperations>(
    data: unknown,
  ): SocketSdkSuccessResult<T> {
    return {
      success: true,
      status: 200,
      data: data as SocketSdkSuccessResult<T>['data'],
    } satisfies SocketSdkSuccessResult<T>
  }

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
    // Parse the newline delimited JSON response.
    const rli = readline.createInterface({
      input: res,
      crlfDelay: Infinity,
      signal: abortSignal,
    })
    const isPublicToken = this.#apiToken === SOCKET_PUBLIC_API_TOKEN
    const results: SocketArtifact[] = []
    for await (const line of rli) {
      const trimmed = line.trim()
      const artifact = trimmed
        ? (jsonParse(line, { throws: false }) as SocketArtifact)
        : null
      if (isObjectObject(artifact)) {
        results.push(
          isPublicToken
            ? reshapeArtifactForPublicPolicy(artifact!, queryParams)
            : artifact!,
        )
      }
    }
    const compact = urlSearchParamAsBoolean(getOwn(queryParams, 'compact'))
    return this.#handleApiSuccess<'batchPackageFetch'>(
      compact ? (results as CompactSocketArtifact[]) : results,
    )
  }

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
    /* c8 ignore start - max listeners adjustment for high concurrency scenarios */
    if (oldAbortSignalMaxListeners < neededMaxListeners) {
      abortSignalMaxListeners = oldAbortSignalMaxListeners + neededMaxListeners
      events.setMaxListeners(abortSignalMaxListeners, abortSignal)
    }
    /* c8 ignore stop - end max listeners adjustment */
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
      const { generator, iteratorResult } = await Promise.race(
        running.map(entry => entry.promise),
      )
      // Remove generator.
      running.splice(
        running.findIndex(entry => entry.generator === generator),
        1,
      )
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
    /* c8 ignore start - reset max listeners if they were increased */
    if (abortSignalMaxListeners > oldAbortSignalMaxListeners) {
      events.setMaxListeners(oldAbortSignalMaxListeners, abortSignal)
    }
    /* c8 ignore stop - end max listeners reset */
  }

  async createDependenciesSnapshot(
    filepaths: string[],
    pathsRelativeTo = '.',
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'createDependenciesSnapshot'>> {
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)
    try {
      const data = await getResponseJson(
        await createUploadRequest(
          this.#baseUrl,
          `dependencies/upload?${queryToSearchParams(queryParams)}`,
          createRequestBodyForFilepaths(absFilepaths, basePath),
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'createDependenciesSnapshot'>(data)
    } catch (e) {
      return await this.#handleApiError<'createDependenciesSnapshot'>(e)
    }
  }

  async createOrgFullScan(
    orgSlug: string,
    filepaths: string[],
    pathsRelativeTo: string = '.',
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'CreateOrgFullScan'>> {
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

  async createOrgRepo(
    orgSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'createOrgRepo'>> {
    try {
      const data = await getResponseJson(
        await createPostRequest(
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

  async createScanFromFilepaths(
    filepaths: string[],
    pathsRelativeTo: string = '.',
    issueRules?: Record<string, boolean>,
  ): Promise<SocketSdkResult<'createReport'>> {
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)
    try {
      const data = await createUploadRequest(
        this.#baseUrl,
        'report/upload',
        [
          ...createRequestBodyForFilepaths(absFilepaths, basePath),
          ...(issueRules
            ? createRequestBodyForJson(issueRules, 'issueRules')
            : []),
        ],
        {
          ...this.#reqOptions,
          method: 'PUT',
        },
      )
      return this.#handleApiSuccess<'createReport'>(data)
    } catch (e) {
      return await this.#handleApiError<'createReport'>(e)
    }
  }

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

  async getIssuesByNPMPackage(
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

  async getOrganizations(): Promise<SocketSdkResult<'getOrganizations'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          'organizations',
          this.#reqOptions,
        ),
      )
      return this.#handleApiSuccess<'getOrganizations'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrganizations'>(e)
    }
  }

  async streamOrgFullScan(
    orgSlug: string,
    fullScanId: string,
    output?: string | boolean,
  ): Promise<SocketSdkResult<'getOrgFullScan'>> {
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

      if (typeof output === 'string') {
        // Stream to file
        res.pipe(createWriteStream(output))
      } else if (output === true) {
        // Stream to stdout
        res.pipe(process.stdout)
      }
      // If output is false or undefined, just return the response without streaming

      return this.#handleApiSuccess<'getOrgFullScan'>(res)
    } catch (e) {
      return await this.#handleApiError<'getOrgFullScan'>(e)
    }
  }

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

  async getScanList(): Promise<SocketSdkResult<'getReportList'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(this.#baseUrl, 'report/list', this.#reqOptions),
      )
      return this.#handleApiSuccess<'getReportList'>(data)
    } catch (e) {
      return await this.#handleApiError<'getReportList'>(e)
    }
  }

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

  async postSettings(
    selectors: Array<{ organization?: string }>,
  ): Promise<SocketSdkResult<'postSettings'>> {
    try {
      const data = await getResponseJson(
        await createPostRequest(
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

  async searchDependencies(
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'searchDependencies'>> {
    try {
      const data = await getResponseJson(
        await createPostRequest(
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

  async updateOrgRepo(
    orgSlug: string,
    repoSlug: string,
    queryParams?: QueryParams | undefined,
  ): Promise<SocketSdkResult<'updateOrgRepo'>> {
    try {
      const data = await getResponseJson(
        await createPostRequest(
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

  async uploadManifestFiles(
    orgSlug: string,
    filepaths: string[],
    pathsRelativeTo: string = '.',
  ): Promise<UploadManifestFilesReturnType | UploadManifestFilesError> {
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
      return this.#handleApiSuccess<any>(
        data,
      ) as unknown as UploadManifestFilesReturnType
    } catch (e) {
      return (await this.#handleApiError<any>(
        e,
      )) as unknown as UploadManifestFilesError
    }
  }
}

export interface SocketSdk {
  createReportFromFilepaths: SocketSdk['createScanFromFilepaths']
  createReportFromFilePaths: SocketSdk['createScanFromFilepaths']
  getReport: SocketSdk['getScan']
  getReportList: SocketSdk['getScanList']
  getReportSupportedFiles: SocketSdk['getSupportedScanFiles']
  getScoreByNPMPackage: SocketSdk['getScoreByNpmPackage']
}

// Add aliases.
Object.defineProperties(SocketSdk.prototype, {
  createReportFromFilepaths: desc(SocketSdk.prototype.createScanFromFilepaths),
  createReportFromFilePaths: desc(SocketSdk.prototype.createScanFromFilepaths),
  getReport: desc(SocketSdk.prototype.getScan),
  getReportList: desc(SocketSdk.prototype.getScanList),
  getReportSupportedFiles: desc(SocketSdk.prototype.getSupportedScanFiles),
  getScoreByNPMPackage: desc(SocketSdk.prototype.getScoreByNpmPackage),
})

// Optional live heap trace.
/* c8 ignore start - optional debug logging for heap monitoring */
if (isDebug('heap')) {
  const used = process.memoryUsage()
  debugLog('heap', `heap used: ${Math.round(used.heapUsed / 1024 / 1024)}MB`)
}
/* c8 ignore stop - end debug logging */

// Export private functions for testing
export const testExports = {
  createRequestBodyForFilepaths,
}
