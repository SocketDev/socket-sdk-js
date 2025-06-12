import events from 'node:events'
import { createReadStream, createWriteStream } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import readline from 'node:readline'

import abortSignal from '@socketsecurity/registry/lib/constants/abort-signal'
import { pRetry } from '@socketsecurity/registry/lib/promises'

// @ts-ignore: Avoid TS import attributes error.
import rootPkgJson from '../package.json' with { type: 'json' }

import type { operations } from '../types/api'
import type { OpErrorType, OpReturnType } from '../types/api-helpers'
import type { ReadStream } from 'node:fs'
import type { ClientRequest, IncomingMessage } from 'node:http'
import type { Agent, RequestOptions } from 'node:https'

type BatchPackageFetchResultType = SocketSdkResultType<'batchPackageFetch'>

type BatchPackageStreamOptions = {
  chunkSize: number
  concurrencyLimit: number
}

export type SocketSdkOperations = keyof operations

export type SocketSdkReturnType<T extends SocketSdkOperations> = OpReturnType<
  operations[T]
>

export type SocketSdkErrorType<T extends SocketSdkOperations> = Omit<
  OpErrorType<operations[T]>,
  'error'
> & {
  error: string
  cause?: unknown
}

export type SocketSdkResultType<T extends SocketSdkOperations> =
  | SocketSdkReturnType<T>
  | SocketSdkErrorType<T>

export interface SocketSdkOptions {
  agent?:
    | Agent
    | {
        http?: Agent | undefined
        https?: Agent | undefined
        http2?: Agent | undefined
      }
    | undefined
  baseUrl?: string | undefined
  userAgent?: string | undefined
}

const DEFAULT_USER_AGENT = createUserAgentFromPkgJson(rootPkgJson)

class ResponseError extends Error {
  response: IncomingMessage
  constructor(response: IncomingMessage, message: string = '') {
    const statusCode = response.statusCode ?? 'unknown'
    const statusMessage = response.statusMessage ?? 'No status message'
    super(
      `Socket API ${message || 'Request failed'} (${statusCode}): ${statusMessage}`
    )
    this.name = 'ResponseError'
    this.response = response
    Error.captureStackTrace(this, ResponseError)
  }
}

async function createDeleteRequest(
  baseUrl: string,
  urlPath: string,
  options: RequestOptions
): Promise<IncomingMessage> {
  const req = getHttpModule(baseUrl)
    .request(`${baseUrl}${urlPath}`, {
      method: 'DELETE',
      ...options
    })
    .end()
  return await getResponse(req)
}

async function createGetRequest(
  baseUrl: string,
  urlPath: string,
  options: RequestOptions
): Promise<IncomingMessage> {
  const req = getHttpModule(baseUrl)
    .request(`${baseUrl}${urlPath}`, {
      method: 'GET',
      ...options
    })
    .end()
  return await getResponse(req)
}

async function createPostRequest(
  baseUrl: string,
  urlPath: string,
  postJson: any,
  options: RequestOptions
): Promise<IncomingMessage> {
  const req = getHttpModule(baseUrl)
    .request(`${baseUrl}${urlPath}`, {
      method: 'POST',
      ...options
    })
    .end(JSON.stringify(postJson))
  return await getResponse(req)
}

function createRequestBodyForFilepaths(
  filepaths: string[],
  basePath: string
): Array<string | ReadStream> {
  const requestBody = []
  for (const absPath of filepaths) {
    const relPath = path.relative(basePath, absPath)
    const filename = path.basename(absPath)
    requestBody.push(
      `Content-Disposition: form-data; name="${relPath}"; filename="${filename}"\r\n`,
      `Content-Type: application/octet-stream\r\n\r\n`,
      createReadStream(absPath)
    )
  }
  return requestBody
}

function createRequestBodyForJson(
  jsonData: any,
  basename = 'data.json'
): Array<string | ReadStream> {
  const ext = path.extname(basename)
  const name = path.basename(basename, ext)
  return [
    `Content-Disposition: form-data; name="${name}"; filename="${basename}"\r\n`,
    'Content-Type: application/json\r\n\r\n',
    JSON.stringify(jsonData),
    // New line after file content.
    '\r\n'
  ]
}

async function createUploadRequest(
  baseUrl: string,
  urlPath: string,
  requestBodyNoBoundaries: Array<
    string | ReadStream | Array<string | ReadStream>
  >,
  options: RequestOptions
): Promise<IncomingMessage> {
  // Note: this will create a regular http request and stream in the file content
  //       implicitly. The outgoing buffer is (implicitly) flushed periodically
  //       by node. When this happens first it will send the headers to the server
  //       which may decide to reject the request, immediately send a response and
  //       then cut the connection (EPIPE or ECONNRESET errors may follow while
  //       writing the files).
  //       We have to make sure to guard for sudden reject responses because if we
  //       don't then the file streaming will fail with random errors and it gets
  //       hard to debug what's going on why.
  //       Example : `socket scan create --org badorg` should fail gracefully.

  // eslint-disable-next-line no-async-promise-executor
  return await new Promise(async (pass, fail) => {
    // Generate a unique boundary for multipart encoding.
    const boundary = `NodeMultipartBoundary${Date.now()}`
    const boundarySep = `--${boundary}\r\n`
    const finalBoundary = `--${boundary}--\r\n`
    const requestBody = [
      ...requestBodyNoBoundaries.flatMap(part => [
        boundarySep,
        ...(Array.isArray(part) ? part : [part])
      ]),
      finalBoundary
    ]
    const url = new URL(urlPath, baseUrl)
    const req: ClientRequest = getHttpModule(baseUrl).request(url, {
      method: 'POST',
      ...options,
      headers: {
        ...options?.headers,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      }
    })

    // Send the headers now. If the server would reject this request, it should
    // do so asap. This prevents us from sending more data to it then necessary.
    // If it will reject we could just await the `req.on(response` now but if it
    // accepts the request then the response will not come until after the final
    // file. So we can't await the response at this time. Just proceed, carefully.
    req.flushHeaders()

    // Wait for the response. It may arrive at any point during the request or
    // afterwards. Node will flush the output buffer at some point, initiating
    // the request, and the server can decide to reject the request immediately
    // or at any point later (ike a timeout). We should handle those cases.
    getResponse(req).then(
      res => {
        // Note: this returns the response to the caller to createUploadRequest
        pass(res)
      },
      async err => {
        // Note: this will throw an error for the caller to createUploadRequest
        if (err.response && !isResponseOk(err.response)) {
          fail(new ResponseError(err.response, `${err.method} request failed`))
        }
        fail(err)
      }
    )

    let aborted = false
    req.on('error', _err => {
      aborted = true
    })
    req.on('close', () => {
      aborted = true
    })
    try {
      // Send the request body (headers + files).
      for (const part of requestBody) {
        if (aborted) {
          break
        }
        if (typeof part === 'string') {
          req.write(part)
        } else if (typeof part?.pipe === 'function') {
          part.pipe(req, { end: false })
          // Wait for file streaming to complete.
          // eslint-disable-next-line no-await-in-loop
          await new Promise<void>((resolve, reject) => {
            const cleanup = () => {
              part.off('end', onEnd)
              part.off('error', onError)
            }
            const onEnd = () => {
              cleanup()
              resolve()
            }
            const onError = (e: Error) => {
              cleanup()
              reject(e)
            }
            part.on('end', onEnd)
            part.on('error', onError)
          })
          if (!aborted) {
            // Ensure a new line after file content.
            req.write('\r\n')
          }
        } else {
          throw new TypeError(
            'Socket API - Invalid multipart part, expected string or stream'
          )
        }
      }
    } catch (e) {
      req.destroy(e as Error)
      fail(e)
    } finally {
      if (!aborted) {
        // Close request after writing all data.
        req.end()
      }
    }

    pass(getResponse(req))
  })
}

async function getErrorResponseBody(
  response: IncomingMessage
): Promise<string> {
  const chunks: Buffer[] = []
  response.on('data', (chunk: Buffer) => chunks.push(chunk))
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        response.off('end', onEnd)
        response.off('error', onError)
      }
      const onEnd = () => {
        cleanup()
        resolve()
      }
      const onError = (e: Error) => {
        cleanup()
        reject(e)
      }
      response.on('end', onEnd)
      response.on('error', onError)
    })
    return Buffer.concat(chunks).toString('utf8')
  } catch {
    return '(there was an error reading the body content)'
  }
}

function getHttpModule(baseUrl: string): typeof http | typeof https {
  const { protocol } = new URL(baseUrl)
  return protocol === 'https:' ? https : http
}

async function getResponse(req: ClientRequest): Promise<IncomingMessage> {
  const res = await new Promise<IncomingMessage>((resolve, reject) => {
    const cleanup = () => {
      req.off('response', onResponse)
      req.off('error', onError)
      abortSignal?.removeEventListener('abort', onAbort)
    }
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
    req.on('response', onResponse)
    req.on('error', onError)
    abortSignal?.addEventListener('abort', onAbort)
  })

  if (!isResponseOk(res)) {
    throw new ResponseError(res, `${req.method} request failed`)
  }
  return res
}

async function getResponseJson(
  response: IncomingMessage
): Promise<ReturnType<typeof JSON.parse>> {
  let data = ''
  for await (const chunk of response) {
    data += chunk
  }
  try {
    return JSON.parse(data)
  } catch (e) {
    throw new SyntaxError(
      `Socket API - Invalid JSON response:\n${data}\n→ ${(e as Error)?.message || 'Unknown error'}`,
      { cause: e }
    )
  }
}

function isResponseOk(response: IncomingMessage): boolean {
  const { statusCode } = response
  return (
    typeof statusCode === 'number' && statusCode >= 200 && statusCode <= 299
  )
}

function resolveAbsPaths(
  filepaths: string[],
  pathsRelativeTo?: string
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
  return `${name}/${pkgData.version}${homepage ? ` (${homepage})` : ''}`
}

// https://github.com/sindresorhus/got/blob/v14.4.6/documentation/2-options.md#agent
const agentNames = new Set(['http', 'https', 'http2'])

export class SocketSdk {
  readonly #baseUrl: string
  readonly #reqOptions: RequestOptions

  /**
   * @throws {SocketSdkAuthError}
   */
  constructor(apiToken: string, options?: SocketSdkOptions | undefined) {
    const {
      agent: agentOrObj,
      baseUrl = 'https://api.socket.dev/v0/',
      userAgent
    } = { __proto__: null, ...options } as SocketSdkOptions
    const agentKeys = agentOrObj ? Object.keys(agentOrObj) : []
    const agent = (
      agentKeys.length && agentKeys.every(k => agentNames.has(k))
        ? (agentOrObj as any).https
        : agentOrObj
    ) as Agent | undefined
    this.#baseUrl = baseUrl
    this.#reqOptions = {
      ...(agent ? { agent } : {}),
      headers: {
        Authorization: `Basic ${btoa(`${apiToken}:`)}`,
        'User-Agent': userAgent ?? DEFAULT_USER_AGENT
      },
      signal: abortSignal
    }
  }

  async #createBatchPurlRequest(
    queryParams: Record<string, string> | null | undefined,
    componentsObj: { components: Array<{ purl: string }> }
  ): Promise<IncomingMessage> {
    // Adds the first 'abort' listener to abortSignal.
    const req = getHttpModule(this.#baseUrl)
      .request(
        `${this.#baseUrl}purl?${new URLSearchParams(queryParams ?? '')}`,
        {
          method: 'POST',
          ...this.#reqOptions
        }
      )
      .end(JSON.stringify(componentsObj))
    return await getResponse(req)
  }

  async *#createBatchPurlGenerator(
    queryParams: Record<string, string> | null | undefined,
    componentsObj: { components: Array<{ purl: string }> }
  ): AsyncGenerator<BatchPackageFetchResultType> {
    let res: IncomingMessage | undefined
    try {
      res = await pRetry(
        () => this.#createBatchPurlRequest(queryParams, componentsObj),
        {
          retries: 4
        }
      )
    } catch (e) {
      return await this.#handleApiError<'batchPackageFetch'>(e)
    }
    const rli = readline.createInterface({
      input: res,
      crlfDelay: Infinity,
      signal: abortSignal
    })
    for await (const line of rli) {
      yield this.#handleApiSuccess<'batchPackageFetch'>(JSON.parse(line))
    }
  }

  async #handleApiError<T extends SocketSdkOperations>(
    error: unknown
  ): Promise<SocketSdkErrorType<T>> {
    if (!(error instanceof ResponseError)) {
      throw new Error('Unexpected Socket API error', {
        cause: error
      })
    }
    const statusCode = error.response.statusCode
    if (statusCode! >= 500) {
      throw new Error(`Socket API server error (${statusCode})`, {
        cause: error
      })
    }
    // The error payload may give a meaningful hint as to what went wrong.
    const bodyStr = await getErrorResponseBody(error.response)
    // Try to parse the body as JSON, fallback to treating as plain text.
    let body
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
      success: false as const,
      status: statusCode!,
      error: error.message ?? '',
      cause: body
    } as unknown as SocketSdkErrorType<T>
  }

  #handleApiSuccess<T extends SocketSdkOperations>(
    data: unknown
  ): SocketSdkReturnType<T> {
    return {
      success: true,
      status: 200,
      data: data as SocketSdkReturnType<T>['data']
    } satisfies SocketSdkReturnType<T>
  }

  async batchPackageFetch(
    queryParams: Record<string, string> | null | undefined,
    componentsObj: { components: Array<{ purl: string }> }
  ): Promise<BatchPackageFetchResultType> {
    let res: IncomingMessage | undefined
    try {
      res = await this.#createBatchPurlRequest(queryParams, componentsObj)
    } catch (e) {
      return await this.#handleApiError<'batchPackageFetch'>(e)
    }
    // Parse the newline delimited JSON response.
    const rl = readline.createInterface({
      input: res,
      crlfDelay: Infinity
    })
    const results: Array<Record<string, unknown>> = []
    for await (const line of rl) {
      if (line.trim()) {
        results.push(JSON.parse(line))
      }
    }
    return this.#handleApiSuccess<'batchPackageFetch'>(results)
  }

  async *batchPackageStream(
    queryParams: Record<string, string> | null | undefined,
    componentsObj: { components: Array<{ purl: string }> },
    options?: BatchPackageStreamOptions | undefined
  ): AsyncGenerator<BatchPackageFetchResultType> {
    type GeneratorStep = {
      generator: AsyncGenerator<BatchPackageFetchResultType>
      iteratorResult: IteratorResult<BatchPackageFetchResultType>
    }
    type GeneratorEntry = {
      generator: AsyncGenerator<BatchPackageFetchResultType>
      promise: Promise<GeneratorStep>
    }
    type ResolveFn = (value: GeneratorStep) => void

    const { chunkSize = 500, concurrencyLimit = 10 } = {
      __proto__: null,
      ...options
    } as BatchPackageStreamOptions
    // The createBatchPurlGenerator method will add 2 'abort' event listeners to
    // abortSignal so we multiply the concurrencyLimit by 2.
    const neededMaxListeners = concurrencyLimit * 2
    // Increase abortSignal max listeners count to avoid Node's MaxListenersExceededWarning.
    const oldAbortSignalMaxListeners = events.getMaxListeners(abortSignal)
    let abortSignalMaxListeners = oldAbortSignalMaxListeners
    if (oldAbortSignalMaxListeners < neededMaxListeners) {
      abortSignalMaxListeners = oldAbortSignalMaxListeners + neededMaxListeners
      events.setMaxListeners(abortSignalMaxListeners, abortSignal)
    }
    const { components } = componentsObj
    const { length: componentsCount } = components
    const running: GeneratorEntry[] = []
    let index = 0
    const enqueueGen = () => {
      if (index >= componentsCount) {
        // No more work to do.
        return
      }
      const generator = this.#createBatchPurlGenerator(queryParams, {
        // Chunk components.
        components: components.slice(index, index + chunkSize)
      })
      continueGen(generator)
      index += chunkSize
    }
    const continueGen = (
      generator: AsyncGenerator<BatchPackageFetchResultType>
    ) => {
      let resolveFn: ResolveFn
      running.push({
        generator,
        promise: new Promise<GeneratorStep>(resolve => (resolveFn = resolve))
      })
      void generator
        .next()
        .then(iteratorResult => resolveFn!({ generator, iteratorResult }))
    }
    // Start initial batch of generators.
    while (running.length < concurrencyLimit && index < componentsCount) {
      enqueueGen()
    }
    while (running.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      const { generator, iteratorResult } = await Promise.race(
        running.map(entry => entry.promise)
      )
      // Remove generator.
      running.splice(
        running.findIndex(entry => entry.generator === generator),
        1
      )
      if (iteratorResult.done) {
        // Start a new generator if available.
        enqueueGen()
      } else {
        yield iteratorResult.value
        // Keep fetching values from this generator.
        continueGen(generator)
      }
    }
    // Reset abortSignal max listeners count.
    if (abortSignalMaxListeners > oldAbortSignalMaxListeners) {
      events.setMaxListeners(oldAbortSignalMaxListeners, abortSignal)
    }
  }

  async createDependenciesSnapshot(
    params: Record<string, string>,
    filepaths: string[],
    pathsRelativeTo = '.'
  ): Promise<SocketSdkResultType<'createDependenciesSnapshot'>> {
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)
    try {
      const data = await getResponseJson(
        await createUploadRequest(
          this.#baseUrl,
          `dependencies/upload?${new URLSearchParams(params)}`,
          createRequestBodyForFilepaths(absFilepaths, basePath),
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'createDependenciesSnapshot'>(data)
    } catch (e) {
      return await this.#handleApiError<'createDependenciesSnapshot'>(e)
    }
  }

  async createOrgFullScan(
    orgSlug: string,
    queryParams: Record<string, string> | null | undefined,
    filepaths: string[],
    pathsRelativeTo: string = '.'
  ): Promise<SocketSdkResultType<'CreateOrgFullScan'>> {
    const basePath = resolveBasePath(pathsRelativeTo)
    const absFilepaths = resolveAbsPaths(filepaths, basePath)
    try {
      const data = await getResponseJson(
        await createUploadRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans?${new URLSearchParams(queryParams ?? '')}`,
          createRequestBodyForFilepaths(absFilepaths, basePath),
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'CreateOrgFullScan'>(data)
    } catch (e) {
      return await this.#handleApiError<'CreateOrgFullScan'>(e)
    }
  }

  async createOrgRepo(
    orgSlug: string,
    params: Record<string, string>
  ): Promise<SocketSdkResultType<'createOrgRepo'>> {
    try {
      const data = await getResponseJson(
        await createPostRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos`,
          params,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'createOrgRepo'>(data)
    } catch (e) {
      return await this.#handleApiError<'createOrgRepo'>(e)
    }
  }

  async createReportFromFilepaths(
    filepaths: string[],
    pathsRelativeTo: string = '.',
    issueRules?: Record<string, boolean>
  ): Promise<SocketSdkResultType<'createReport'>> {
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
            : [])
        ],
        {
          ...this.#reqOptions,
          method: 'PUT'
        }
      )
      return this.#handleApiSuccess<'createReport'>(data)
    } catch (e) {
      return await this.#handleApiError<'createReport'>(e)
    }
  }

  // Alias to preserve backwards compatibility.
  async createReportFromFilePaths(
    filepaths: string[],
    pathsRelativeTo: string = '.',
    issueRules?: Record<string, boolean>
  ): Promise<SocketSdkResultType<'createReport'>> {
    return await this.createReportFromFilepaths(
      filepaths,
      pathsRelativeTo,
      issueRules
    )
  }

  async deleteOrgFullScan(
    orgSlug: string,
    fullScanId: string
  ): Promise<SocketSdkResultType<'deleteOrgFullScan'>> {
    try {
      const data = await getResponseJson(
        await createDeleteRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'deleteOrgFullScan'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgFullScan'>(e)
    }
  }

  async deleteOrgRepo(
    orgSlug: string,
    repoSlug: string
  ): Promise<SocketSdkResultType<'deleteOrgRepo'>> {
    try {
      const data = await getResponseJson(
        await createDeleteRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'deleteOrgRepo'>(data)
    } catch (e) {
      return await this.#handleApiError<'deleteOrgRepo'>(e)
    }
  }

  async getAuditLogEvents(
    orgSlug: string,
    queryParams?: Record<string, string> | null | undefined
  ): Promise<SocketSdkResultType<'getAuditLogEvents'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/audit-log?${new URLSearchParams(queryParams ?? '')}`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getAuditLogEvents'>(data)
    } catch (e) {
      return await this.#handleApiError<'getAuditLogEvents'>(e)
    }
  }

  async getIssuesByNPMPackage(
    pkgName: string,
    version: string
  ): Promise<SocketSdkResultType<'getIssuesByNPMPackage'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `npm/${encodeURIComponent(pkgName)}/${encodeURIComponent(version)}/issues`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getIssuesByNPMPackage'>(data)
    } catch (e) {
      return await this.#handleApiError<'getIssuesByNPMPackage'>(e)
    }
  }

  async getOrgAnalytics(
    time: string
  ): Promise<SocketSdkResultType<'getOrgAnalytics'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `analytics/org/${encodeURIComponent(time)}`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getOrgAnalytics'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgAnalytics'>(e)
    }
  }

  async getOrganizations(): Promise<SocketSdkResultType<'getOrganizations'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(this.#baseUrl, 'organizations', this.#reqOptions)
      )
      return this.#handleApiSuccess<'getOrganizations'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrganizations'>(e)
    }
  }

  async getOrgFullScan(
    orgSlug: string,
    fullScanId: string,
    file?: string
  ): Promise<SocketSdkResultType<'getOrgFullScan'>> {
    try {
      const req = getHttpModule(this.#baseUrl)
        .request(
          `${this.#baseUrl}orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}`,
          {
            method: 'GET',
            ...this.#reqOptions
          }
        )
        .end()
      const res = await getResponse(req)
      if (file) {
        res.pipe(createWriteStream(file))
      } else {
        res.pipe(process.stdout)
      }
      return this.#handleApiSuccess<'getOrgFullScan'>(res)
    } catch (e) {
      return await this.#handleApiError<'getOrgFullScan'>(e)
    }
  }

  async getOrgFullScanList(
    orgSlug: string,
    queryParams?: Record<string, string> | null | undefined
  ): Promise<SocketSdkResultType<'getOrgFullScanList'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans?${new URLSearchParams(queryParams ?? '')}`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getOrgFullScanList'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgFullScanList'>(e)
    }
  }

  async getOrgFullScanMetadata(
    orgSlug: string,
    fullScanId: string
  ): Promise<SocketSdkResultType<'getOrgFullScanMetadata'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}/metadata`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getOrgFullScanMetadata'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgFullScanMetadata'>(e)
    }
  }

  async getOrgLicensePolicy(
    orgSlug: string
  ): Promise<SocketSdkResultType<'getOrgLicensePolicy'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/settings/license-policy`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getOrgLicensePolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgLicensePolicy'>(e)
    }
  }

  async getOrgRepo(
    orgSlug: string,
    repoSlug: string
  ): Promise<SocketSdkResultType<'getOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const repoSlugParam = encodeURIComponent(repoSlug)

    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${orgSlugParam}/repos/${repoSlugParam}`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getOrgRepo'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgRepo'>(e)
    }
  }

  async getOrgRepoList(
    orgSlug: string,
    queryParams?: Record<string, string> | null | undefined
  ): Promise<SocketSdkResultType<'getOrgRepoList'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos?${new URLSearchParams(queryParams ?? '')}`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getOrgRepoList'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgRepoList'>(e)
    }
  }

  async getOrgSecurityPolicy(
    orgSlug: string
  ): Promise<SocketSdkResultType<'getOrgSecurityPolicy'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/settings/security-policy`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getOrgSecurityPolicy'>(data)
    } catch (e) {
      return await this.#handleApiError<'getOrgSecurityPolicy'>(e)
    }
  }

  async getQuota(): Promise<SocketSdkResultType<'getQuota'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(this.#baseUrl, 'quota', this.#reqOptions)
      )
      return this.#handleApiSuccess<'getQuota'>(data)
    } catch (e) {
      return await this.#handleApiError<'getQuota'>(e)
    }
  }

  async getRepoAnalytics(
    repo: string,
    time: string
  ): Promise<SocketSdkResultType<'getRepoAnalytics'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `analytics/repo/${encodeURIComponent(repo)}/${encodeURIComponent(time)}`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getRepoAnalytics'>(data)
    } catch (e) {
      return await this.#handleApiError<'getRepoAnalytics'>(e)
    }
  }

  async getReport(id: string): Promise<SocketSdkResultType<'getReport'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `report/view/${encodeURIComponent(id)}`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getReport'>(data)
    } catch (e) {
      return await this.#handleApiError<'getReport'>(e)
    }
  }

  async getReportList(): Promise<SocketSdkResultType<'getReportList'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(this.#baseUrl, 'report/list', this.#reqOptions)
      )
      return this.#handleApiSuccess<'getReportList'>(data)
    } catch (e) {
      return await this.#handleApiError<'getReportList'>(e)
    }
  }

  async getReportSupportedFiles(): Promise<
    SocketSdkResultType<'getReportSupportedFiles'>
  > {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          'report/supported',
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getReportSupportedFiles'>(data)
    } catch (e) {
      return await this.#handleApiError<'getReportSupportedFiles'>(e)
    }
  }

  async getScoreByNPMPackage(
    pkgName: string,
    version: string
  ): Promise<SocketSdkResultType<'getScoreByNPMPackage'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(
          this.#baseUrl,
          `npm/${encodeURIComponent(pkgName)}/${encodeURIComponent(version)}/score`,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'getScoreByNPMPackage'>(data)
    } catch (e) {
      return await this.#handleApiError<'getScoreByNPMPackage'>(e)
    }
  }

  async postSettings(
    selectors: Array<{ organization?: string }>
  ): Promise<SocketSdkResultType<'postSettings'>> {
    try {
      const data = await getResponseJson(
        await createPostRequest(
          this.#baseUrl,
          'settings',
          { json: selectors },
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'postSettings'>(data)
    } catch (e) {
      return await this.#handleApiError<'postSettings'>(e)
    }
  }

  async searchDependencies(
    params: Record<string, number>
  ): Promise<SocketSdkResultType<'searchDependencies'>> {
    try {
      const data = await getResponseJson(
        await createPostRequest(
          this.#baseUrl,
          'dependencies/search',
          params,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'searchDependencies'>(data)
    } catch (e) {
      return await this.#handleApiError<'searchDependencies'>(e)
    }
  }

  async updateOrgRepo(
    orgSlug: string,
    repoSlug: string,
    params: Record<string, string>
  ): Promise<SocketSdkResultType<'updateOrgRepo'>> {
    try {
      const data = await getResponseJson(
        await createPostRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/repos/${encodeURIComponent(repoSlug)}`,
          params,
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'updateOrgRepo'>(data)
    } catch (e) {
      return await this.#handleApiError<'updateOrgRepo'>(e)
    }
  }
}
