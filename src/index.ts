import events from 'node:events'
import { createReadStream, createWriteStream } from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import readline from 'node:readline'

import abortSignal from '@socketsecurity/registry/lib/constants/abort-signal'

// @ts-ignore
import rootPkgJson from '../package.json' with { type: 'json' }

import type { operations } from '../types/api'
import type { OpErrorType, OpReturnType } from '../types/api-helpers'
import type { ReadStream } from 'node:fs'
import type { IncomingMessage } from 'node:http'
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

const defaultUserAgent = createUserAgentFromPkgJson(rootPkgJson)

class ResponseError extends Error {
  response: IncomingMessage
  constructor(response: IncomingMessage, message: string) {
    super(`${message}: ${response.statusCode} - ${response.statusMessage}`)
    this.response = response
  }
}

async function createDeleteRequest(
  baseUrl: string,
  urlPath: string,
  options: RequestOptions
): Promise<IncomingMessage> {
  const req = https.request(`${baseUrl}${urlPath}`, {
    method: 'DELETE',
    ...options
  })
  const { 0: res } = (await events.once(req, 'response')) as [IncomingMessage]
  if (!isResponseOk(res)) {
    throw new ResponseError(res, 'Delete request failed')
  }
  return res
}

async function createGetRequest(
  baseUrl: string,
  urlPath: string,
  options: RequestOptions
): Promise<IncomingMessage> {
  const req = https
    .request(`${baseUrl}${urlPath}`, {
      method: 'GET',
      ...options
    })
    .end()
  const { 0: res } = (await events.once(req, 'response')) as [IncomingMessage]
  if (!isResponseOk(res)) {
    throw new ResponseError(res, 'Get request failed')
  }
  return res
}

async function createPostRequest(
  baseUrl: string,
  urlPath: string,
  postJson: any,
  options: RequestOptions
): Promise<IncomingMessage> {
  const req = https
    .request(`${baseUrl}${urlPath}`, {
      method: 'POST',
      ...options
    })
    .end(JSON.stringify(postJson))
  const { 0: res } = (await events.once(req, 'response')) as [IncomingMessage]
  if (!isResponseOk(res)) {
    throw new ResponseError(res, 'Post request failed')
  }
  return res
}

function createRequestBodyForFilepaths(
  filepaths: string[]
): Array<string | ReadStream> {
  const requestBody = []
  for (const p of filepaths) {
    // Multipart header for each file.
    requestBody.push(
      `Content-Disposition: form-data; name="file"; filename="${path.basename(p)}"\n`,
      `Content-Type: application/octet-stream\n\n`,
      createReadStream(p),
      // New line after file content.
      '\n'
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
    `Content-Disposition: form-data; name="${name}"; filename="${basename}"\n`,
    'Content-Type: application/json\n\n',
    JSON.stringify(jsonData),
    // New line after file content.
    '\n'
  ]
}

async function createUploadRequest(
  baseUrl: string,
  urlPath: string,
  requestBodyNoBoundaries: Array<string | ReadStream>,
  options: RequestOptions
): Promise<IncomingMessage> {
  // Generate a unique boundary for multipart encoding.
  const boundary = `----NodeMultipartBoundary${Date.now()}`
  const boundarySep = `--${boundary}\n`
  // Create request body as a stream.
  const requestBody = [
    ...(requestBodyNoBoundaries.length
      ? requestBodyNoBoundaries.flatMap(e => [boundarySep, e])
      : [boundarySep]),
    `--${boundary}--\n`
  ]
  const req = https.request(`${baseUrl}${urlPath}`, {
    method: 'POST',
    ...options,
    headers: {
      ...options?.headers,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    }
  })
  // Send the request body (headers + files).
  for (const part of requestBody) {
    if (typeof part === 'string') {
      req.write(part)
    } else {
      part.pipe(req, { end: false })
      // Wait for file streaming to complete.
      // eslint-disable-next-line no-await-in-loop
      await events.once(part, 'end')
      // Ensure a new line after file content.
      req.write('\n')
    }
  }
  // Close request after writing all data.
  req.end()

  const { 0: res } = (await events.once(req, 'response')) as [IncomingMessage]
  if (!isResponseOk(res)) {
    throw new ResponseError(res, 'Upload failed')
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
  } catch {
    throw new Error(`Invalid JSON response: ${data}`)
  }
}

function isResponseOk(response: IncomingMessage): boolean {
  const { statusCode } = response
  return (
    typeof statusCode === 'number' && statusCode >= 200 && statusCode <= 299
  )
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
        'User-Agent': `${userAgent ? `${userAgent} ` : ''}${defaultUserAgent}`
      },
      signal: abortSignal
    }
  }

  async #createBatchPurlRequest(
    queryParams: Record<string, string> | null | undefined,
    componentsObj: { components: Array<{ purl: string }> }
  ): Promise<IncomingMessage> {
    // Adds the first 'abort' listener to abortSignal.
    const req = https
      .request(
        `${this.#baseUrl}purl?${new URLSearchParams(queryParams ?? '')}`,
        {
          method: 'POST',
          ...this.#reqOptions
        }
      )
      .end(JSON.stringify(componentsObj))
    // Adds the second 'abort' listener to abortSignal.
    const { 0: res } = (await events.once(req, 'response', {
      signal: abortSignal
    })) as [IncomingMessage]
    if (!isResponseOk(res)) {
      throw new ResponseError(res, 'Batch purl request failed')
    }
    return res
  }

  async *#createBatchPurlGenerator(
    queryParams: Record<string, string> | null | undefined,
    componentsObj: { components: Array<{ purl: string }> }
  ): AsyncGenerator<BatchPackageFetchResultType> {
    let res: IncomingMessage | undefined
    try {
      res = await this.#createBatchPurlRequest(queryParams, componentsObj)
    } catch (e) {
      return this.#handleApiError<'batchPackageFetch'>(e)
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

  #handleApiError<T extends SocketSdkOperations>(
    error: unknown
  ): SocketSdkErrorType<T> {
    if (!(error instanceof ResponseError)) {
      throw new Error('Unexpected error when calling API', {
        cause: error
      })
    }
    const statusCode = error.response.statusCode
    if (statusCode! >= 500) {
      throw new Error('API returned an error', { cause: error })
    }
    return {
      success: false as const,
      status: statusCode!,
      error: error.message ?? ''
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
      return this.#handleApiError<'batchPackageFetch'>(e)
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

    const { chunkSize = 5, concurrencyLimit = 10 } = {
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
    const basePath = path.join(process.cwd(), pathsRelativeTo)
    const absFilepaths = filepaths.map(p => path.join(basePath, p))
    try {
      const data = await getResponseJson(
        await createUploadRequest(
          this.#baseUrl,
          `dependencies/upload?${new URLSearchParams(params)}`,
          createRequestBodyForFilepaths(absFilepaths),
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'createDependenciesSnapshot'>(data)
    } catch (e) {
      return this.#handleApiError<'createDependenciesSnapshot'>(e)
    }
  }

  async createOrgFullScan(
    orgSlug: string,
    queryParams: Record<string, string> | null | undefined,
    filepaths: string[],
    pathsRelativeTo: string = '.'
  ): Promise<SocketSdkResultType<'CreateOrgFullScan'>> {
    const basePath = path.join(process.cwd(), pathsRelativeTo)
    const absFilepaths = filepaths.map(p => path.join(basePath, p))
    try {
      const data = await getResponseJson(
        await createUploadRequest(
          this.#baseUrl,
          `orgs/${encodeURIComponent(orgSlug)}/full-scans?${new URLSearchParams(queryParams ?? '')}`,
          createRequestBodyForFilepaths(absFilepaths),
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'CreateOrgFullScan'>(data)
    } catch (e) {
      return this.#handleApiError<'CreateOrgFullScan'>(e)
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
          { json: params },
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'createOrgRepo'>(data)
    } catch (e) {
      return this.#handleApiError<'createOrgRepo'>(e)
    }
  }

  async createReportFromFilepaths(
    filepaths: string[],
    pathsRelativeTo: string = '.',
    issueRules?: Record<string, boolean>
  ): Promise<SocketSdkResultType<'createReport'>> {
    const basePath = path.join(process.cwd(), pathsRelativeTo)
    const absFilepaths = filepaths.map(p => path.join(basePath, p))
    try {
      const data = await createUploadRequest(
        this.#baseUrl,
        'report/upload',
        [
          ...createRequestBodyForFilepaths(absFilepaths),
          ...(issueRules
            ? createRequestBodyForJson(issueRules, 'issueRules.json')
            : [])
        ],
        {
          ...this.#reqOptions,
          method: 'PUT'
        }
      )
      return this.#handleApiSuccess<'createReport'>(data)
    } catch (e) {
      return this.#handleApiError<'createReport'>(e)
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
      return this.#handleApiError<'deleteOrgFullScan'>(e)
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
      return this.#handleApiError<'deleteOrgRepo'>(e)
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
      return this.#handleApiError<'getAuditLogEvents'>(e)
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
      return this.#handleApiError<'getIssuesByNPMPackage'>(e)
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
      return this.#handleApiError<'getOrgAnalytics'>(e)
    }
  }

  async getOrganizations(): Promise<SocketSdkResultType<'getOrganizations'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(this.#baseUrl, 'organizations', this.#reqOptions)
      )
      return this.#handleApiSuccess<'getOrganizations'>(data)
    } catch (e) {
      return this.#handleApiError<'getOrganizations'>(e)
    }
  }

  async getOrgFullScan(
    orgSlug: string,
    fullScanId: string,
    file?: string
  ): Promise<SocketSdkResultType<'getOrgFullScan'>> {
    try {
      const req = https.request(
        `${this.#baseUrl}orgs/${encodeURIComponent(orgSlug)}/full-scans/${encodeURIComponent(fullScanId)}`,
        {
          method: 'GET',
          ...this.#reqOptions
        }
      )
      const { 0: res } = await events.once(req, 'response')
      if (!isResponseOk(res)) {
        throw new ResponseError(res, 'Get request failed')
      }
      if (file) {
        res.pipe(createWriteStream(file))
      } else {
        res.pipe(process.stdout)
      }
      return this.#handleApiSuccess<'getOrgFullScan'>(res)
    } catch (e) {
      return this.#handleApiError<'getOrgFullScan'>(e)
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
      return this.#handleApiError<'getOrgFullScanList'>(e)
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
      return this.#handleApiError<'getOrgFullScanMetadata'>(e)
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
      return this.#handleApiError<'getOrgLicensePolicy'>(e)
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
      return this.#handleApiError<'getOrgRepo'>(e)
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
      return this.#handleApiError<'getOrgRepoList'>(e)
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
      return this.#handleApiError<'getOrgSecurityPolicy'>(e)
    }
  }

  async getQuota(): Promise<SocketSdkResultType<'getQuota'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(this.#baseUrl, 'quota', this.#reqOptions)
      )
      return this.#handleApiSuccess<'getQuota'>(data)
    } catch (e) {
      return this.#handleApiError<'getQuota'>(e)
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
      return this.#handleApiError<'getRepoAnalytics'>(e)
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
      return this.#handleApiError<'getReport'>(e)
    }
  }

  async getReportList(): Promise<SocketSdkResultType<'getReportList'>> {
    try {
      const data = await getResponseJson(
        await createGetRequest(this.#baseUrl, 'report/list', this.#reqOptions)
      )
      return this.#handleApiSuccess<'getReportList'>(data)
    } catch (e) {
      return this.#handleApiError<'getReportList'>(e)
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
      return this.#handleApiError<'getReportSupportedFiles'>(e)
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
      return this.#handleApiError<'getScoreByNPMPackage'>(e)
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
      return this.#handleApiError<'postSettings'>(e)
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
          { json: params },
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'searchDependencies'>(data)
    } catch (e) {
      return this.#handleApiError<'searchDependencies'>(e)
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
          { json: params },
          this.#reqOptions
        )
      )
      return this.#handleApiSuccess<'updateOrgRepo'>(data)
    } catch (e) {
      return this.#handleApiError<'updateOrgRepo'>(e)
    }
  }
}
