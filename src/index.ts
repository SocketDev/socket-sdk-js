import { createWriteStream } from 'node:fs'
import path from 'node:path'
import stream from 'node:stream/promises'

import { Blob, FormData } from 'formdata-node'
import { fileFromPath } from 'formdata-node/file-from-path'
// eslint-disable-next-line import-x/no-named-as-default
import got, { HTTPError } from 'got'
import { ErrorWithCause } from 'pony-cause'

import type { operations } from '../types/api'
import type { OpErrorType, OpReturnType } from '../types/api-helpers'
import type {
  Got,
  Agents as GotAgent,
  ExtendOptions as GotExtendOptions
} from 'got'
import type { Readable } from 'node:stream'

type SocketSdkOperations = keyof operations
type SocketSdkReturnType<T extends SocketSdkOperations> = OpReturnType<
  operations[T]
>
type SocketSdkErrorType<T extends SocketSdkOperations> = OpErrorType<
  operations[T]
>
type SocketSdkResultType<T extends SocketSdkOperations> =
  | SocketSdkReturnType<T>
  | SocketSdkErrorType<T>

interface SocketSdkOptions {
  agent?: GotAgent | undefined
  baseUrl?: string | undefined
  userAgent?: string | undefined
}

function ensureObject(value: unknown): value is Record<string, unknown> {
  return !!(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * Package.json data to base the User-Agent on
 */
function createUserAgentFromPkgJson(pkgData: {
  name: string
  version: string
  homepage?: string
}): string {
  const { homepage } = pkgData
  return (
    `${pkgData.name.replace('@', '').replace('/', '-')}/${pkgData.version}` +
    (homepage ? ` (${homepage})` : '')
  )
}

class SocketSdk {
  #client?: Got
  readonly #gotOptions: GotExtendOptions

  /**
   * @throws {SocketSdkAuthError}
   */
  constructor(apiKey: string, options?: SocketSdkOptions | undefined) {
    const {
      agent,
      baseUrl = 'https://api.socket.dev/v0/',
      userAgent
    } = { __proto__: null, ...options } as SocketSdkOptions

    this.#gotOptions = {
      prefixUrl: baseUrl,
      retry: { limit: 0 },
      username: apiKey,
      // See https://github.com/sindresorhus/got/blob/main/documentation/2-options.md#enableunixsockets
      enableUnixSockets: false,
      headers: {
        'user-agent': `${userAgent ? `${userAgent} ` : ''}${createUserAgentFromPkgJson(require(path.join(__dirname, '../../package.json')))}`
      },
      ...(agent ? { agent } : {})
    }
  }

  #getApiErrorDescription(err: HTTPError): Record<string, unknown> {
    let rawBody: unknown

    try {
      rawBody = JSON.parse(err.response.body as string)
    } catch (cause) {
      throw new ErrorWithCause('Could not parse API error response', { cause })
    }

    const errorDescription = ensureObject(rawBody)
      ? rawBody['error']
      : undefined

    if (!ensureObject(errorDescription)) {
      throw new Error('Invalid body on API error response')
    }

    return errorDescription
  }

  #getClient(): Got {
    if (!this.#client) {
      this.#client = got.extend(this.#gotOptions)
    }
    return this.#client
  }

  #handleApiError<T extends SocketSdkOperations>(
    err: unknown
  ): SocketSdkErrorType<T> {
    if (!(err instanceof HTTPError)) {
      throw new ErrorWithCause('Unexpected error when calling API', {
        cause: err
      })
    }

    if (err.response.statusCode >= 500) {
      throw new ErrorWithCause('API returned an error', { cause: err })
    }

    // First convert to unknown, then to the specific error type
    const errorResponse = {
      success: false as const,
      status: err.response.statusCode,
      error: this.#getApiErrorDescription(err)
    }

    return errorResponse as unknown as SocketSdkErrorType<T>
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
    queryParams: Record<string, string>,
    components: { components: Array<{ purl: string }> }
  ): Promise<SocketSdkResultType<'batchPackageFetch'>> {
    const formattedQueryParam = new URLSearchParams(queryParams)

    try {
      const response = await this.#getClient().post(
        `purl?${formattedQueryParam}`,
        { json: components }
      )

      // Parse the ndjson response
      const resp_json: Array<Record<string, unknown>> = []
      const ndjson = response.body.split('\n')
      ndjson.map(o => o && resp_json.push(JSON.parse(o)))

      return this.#handleApiSuccess<'batchPackageFetch'>(resp_json)
    } catch (err) {
      return this.#handleApiError<'batchPackageFetch'>(err)
    }
  }

  async createDependenciesSnapshot(
    params: Record<string, string>,
    filepaths: string[],
    pathsRelativeTo: string = '.'
  ): Promise<SocketSdkResultType<'createDependenciesSnapshot'>> {
    const basePath = path.join(process.cwd(), pathsRelativeTo)
    const absFilepaths = filepaths.map(filePath =>
      path.join(basePath, filePath)
    )
    const formattedQueryParams = new URLSearchParams(params)

    const body = new FormData()

    const files = await Promise.all(
      absFilepaths.map(absFilepath => fileFromPath(absFilepath))
    )

    for (let i = 0, length = files.length; i < length; i++) {
      const absFilepath = absFilepaths[i]
      if (absFilepath) {
        const relFilepath = path.relative(basePath, absFilepath)
        body.set(relFilepath, files[i])
      }
    }

    try {
      const data = await this.#getClient()
        .post(`dependencies/upload?${formattedQueryParams}`, { body })
        .json()
      return this.#handleApiSuccess<'createDependenciesSnapshot'>(data)
    } catch (err) {
      return this.#handleApiError<'createDependenciesSnapshot'>(err)
    }
  }

  async createOrgFullScan(
    orgSlug: string,
    queryParams: Record<string, string>,
    filepaths: string[],
    pathsRelativeTo: string = '.'
  ): Promise<SocketSdkResultType<'CreateOrgFullScan'>> {
    const basePath = path.join(process.cwd(), pathsRelativeTo)
    const absFilepaths = filepaths.map(filePath =>
      path.join(basePath, filePath)
    )
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParams = new URLSearchParams(queryParams)

    const body = new FormData()

    const files = await Promise.all(
      absFilepaths.map(absFilepath => fileFromPath(absFilepath))
    )

    for (let i = 0, length = files.length; i < length; i++) {
      const absFilepath = absFilepaths[i]
      if (absFilepath) {
        const relFilepath = path.relative(basePath, absFilepath)
        body.set(relFilepath, files[i])
      }
    }

    try {
      const data = await this.#getClient()
        .post(`orgs/${orgSlugParam}/full-scans?${formattedQueryParams}`, {
          body
        })
        .json()
      return this.#handleApiSuccess<'CreateOrgFullScan'>(data)
    } catch (err) {
      return this.#handleApiError<'CreateOrgFullScan'>(err)
    }
  }

  async createOrgRepo(
    orgSlug: string,
    params: Record<string, string>
  ): Promise<SocketSdkResultType<'createOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const data = await this.#getClient()
        .post(`orgs/${orgSlugParam}/repos`, { json: params })
        .json()
      return this.#handleApiSuccess<'createOrgRepo'>(data)
    } catch (err) {
      return this.#handleApiError<'createOrgRepo'>(err)
    }
  }

  async createReportFromFilepaths(
    filepaths: string[],
    pathsRelativeTo: string = '.',
    issueRules?: Record<string, boolean>
  ): Promise<SocketSdkResultType<'createReport'>> {
    const basePath = path.join(process.cwd(), pathsRelativeTo)
    const absFilepaths = filepaths.map(filePath =>
      path.join(basePath, filePath)
    )

    const body = new FormData()

    if (issueRules) {
      const issueRulesBlob = new Blob([JSON.stringify(issueRules)], {
        type: 'application/json'
      })
      body.set('issueRules', issueRulesBlob, 'issueRules')
    }

    const files = await Promise.all(
      absFilepaths.map(absFilepath => fileFromPath(absFilepath))
    )

    for (let i = 0, length = files.length; i < length; i++) {
      const absFilepath = absFilepaths[i]
      if (absFilepath) {
        const relFilepath = path.relative(basePath, absFilepath)
        body.set(relFilepath, files[i])
      }
    }

    try {
      const data = await this.#getClient().put('report/upload', { body }).json()
      return this.#handleApiSuccess<'createReport'>(data)
    } catch (err) {
      return this.#handleApiError<'createReport'>(err)
    }
  }

  async deleteOrgFullScan(
    orgSlug: string,
    fullScanId: string
  ): Promise<SocketSdkResultType<'deleteOrgFullScan'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const fullScanIdParam = encodeURIComponent(fullScanId)

    try {
      const data = await this.#getClient()
        .delete(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}`)
        .json()
      return this.#handleApiSuccess<'deleteOrgFullScan'>(data)
    } catch (err) {
      return this.#handleApiError<'deleteOrgFullScan'>(err)
    }
  }

  async deleteOrgRepo(
    orgSlug: string,
    repoSlug: string
  ): Promise<SocketSdkResultType<'deleteOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const repoSlugParam = encodeURIComponent(repoSlug)

    try {
      const data = await this.#getClient()
        .delete(`orgs/${orgSlugParam}/repos/${repoSlugParam}`)
        .json()
      return this.#handleApiSuccess<'deleteOrgRepo'>(data)
    } catch (err) {
      return this.#handleApiError<'deleteOrgRepo'>(err)
    }
  }

  async getAuditLogEvents(
    orgSlug: string,
    queryParams: Record<string, string>
  ): Promise<SocketSdkResultType<'getAuditLogEvents'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParam = new URLSearchParams(queryParams)

    try {
      const data = await this.#getClient()
        .get(`orgs/${orgSlugParam}/audit-log?${formattedQueryParam}`)
        .json()
      return this.#handleApiSuccess<'getAuditLogEvents'>(data)
    } catch (err) {
      return this.#handleApiError<'getAuditLogEvents'>(err)
    }
  }

  async getIssuesByNPMPackage(
    pkgName: string,
    version: string
  ): Promise<SocketSdkResultType<'getIssuesByNPMPackage'>> {
    const pkgParam = encodeURIComponent(pkgName)
    const versionParam = encodeURIComponent(version)

    try {
      const data = await this.#getClient()
        .get(`npm/${pkgParam}/${versionParam}/issues`)
        .json()
      return this.#handleApiSuccess<'getIssuesByNPMPackage'>(data)
    } catch (err) {
      return this.#handleApiError<'getIssuesByNPMPackage'>(err)
    }
  }

  async getOrgAnalytics(
    time: string
  ): Promise<SocketSdkResultType<'getOrgAnalytics'>> {
    const timeParam = encodeURIComponent(time)

    try {
      const data = await this.#getClient()
        .get(`analytics/org/${timeParam}`)
        .json()
      return this.#handleApiSuccess<'getOrgAnalytics'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgAnalytics'>(err)
    }
  }

  async getOrganizations(): Promise<SocketSdkResultType<'getOrganizations'>> {
    try {
      const data = await this.#getClient().get('organizations').json()
      return this.#handleApiSuccess<'getOrganizations'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrganizations'>(err)
    }
  }

  async getOrgFullScan(
    orgSlug: string,
    fullScanId: string,
    file?: string
  ): Promise<SocketSdkResultType<'getOrgFullScan'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const fullScanIdParam = encodeURIComponent(fullScanId)
    try {
      let readStream: Readable | undefined
      if (file) {
        await stream.pipeline(
          this.#getClient().stream(
            `orgs/${orgSlugParam}/full-scans/${fullScanIdParam}`
          ),
          createWriteStream(file)
        )
      } else {
        readStream = this.#getClient()
          .stream(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}`)
          .pipe(process.stdout)
      }
      return this.#handleApiSuccess<'getOrgFullScan'>(readStream)
    } catch (err) {
      return this.#handleApiError<'getOrgFullScan'>(err)
    }
  }

  async getOrgFullScanList(
    orgSlug: string,
    queryParams: Record<string, string>
  ): Promise<SocketSdkResultType<'getOrgFullScanList'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParams = new URLSearchParams(queryParams)

    try {
      const data = await this.#getClient()
        .get(`orgs/${orgSlugParam}/full-scans?${formattedQueryParams}`)
        .json()
      return this.#handleApiSuccess<'getOrgFullScanList'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgFullScanList'>(err)
    }
  }

  async getOrgFullScanMetadata(
    orgSlug: string,
    fullScanId: string
  ): Promise<SocketSdkResultType<'getOrgFullScanMetadata'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const fullScanIdParam = encodeURIComponent(fullScanId)

    try {
      const data = await this.#getClient()
        .get(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}/metadata`)
        .json()
      return this.#handleApiSuccess<'getOrgFullScanMetadata'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgFullScanMetadata'>(err)
    }
  }

  async getOrgLicensePolicy(
    orgSlug: string
  ): Promise<SocketSdkResultType<'getOrgLicensePolicy'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const data = await this.#getClient()
        .get(`orgs/${orgSlugParam}/settings/license-policy`)
        .json()
      return this.#handleApiSuccess<'getOrgLicensePolicy'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgLicensePolicy'>(err)
    }
  }

  async getOrgRepo(
    orgSlug: string,
    repoSlug: string
  ): Promise<SocketSdkResultType<'getOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const repoSlugParam = encodeURIComponent(repoSlug)

    try {
      const data = await this.#getClient()
        .get(`orgs/${orgSlugParam}/repos/${repoSlugParam}`)
        .json()
      return this.#handleApiSuccess<'getOrgRepo'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgRepo'>(err)
    }
  }

  async getOrgRepoList(
    orgSlug: string,
    queryParams: Record<string, string>
  ): Promise<SocketSdkResultType<'getOrgRepoList'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParam = new URLSearchParams(queryParams)

    try {
      const data = await this.#getClient()
        .get(`orgs/${orgSlugParam}/repos?${formattedQueryParam}`)
        .json()
      return this.#handleApiSuccess<'getOrgRepoList'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgRepoList'>(err)
    }
  }

  async getOrgSecurityPolicy(
    orgSlug: string
  ): Promise<SocketSdkResultType<'getOrgSecurityPolicy'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const data = await this.#getClient()
        .get(`orgs/${orgSlugParam}/settings/security-policy`)
        .json()
      return this.#handleApiSuccess<'getOrgSecurityPolicy'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgSecurityPolicy'>(err)
    }
  }

  async getQuota(): Promise<SocketSdkResultType<'getQuota'>> {
    try {
      const data = await this.#getClient().get('quota').json()
      return this.#handleApiSuccess<'getQuota'>(data)
    } catch (err) {
      return this.#handleApiError<'getQuota'>(err)
    }
  }

  async getRepoAnalytics(
    repo: string,
    time: string
  ): Promise<SocketSdkResultType<'getRepoAnalytics'>> {
    const timeParam = encodeURIComponent(time)
    const repoParam = encodeURIComponent(repo)

    try {
      const data = await this.#getClient()
        .get(`analytics/repo/${repoParam}/${timeParam}`)
        .json()
      return this.#handleApiSuccess<'getRepoAnalytics'>(data)
    } catch (err) {
      return this.#handleApiError<'getRepoAnalytics'>(err)
    }
  }

  async getReport(id: string): Promise<SocketSdkResultType<'getReport'>> {
    const idParam = encodeURIComponent(id)

    try {
      const data = await this.#getClient().get(`report/view/${idParam}`).json()
      return this.#handleApiSuccess<'getReport'>(data)
    } catch (err) {
      return this.#handleApiError<'getReport'>(err)
    }
  }

  async getReportList(): Promise<SocketSdkResultType<'getReportList'>> {
    try {
      const data = await this.#getClient().get('report/list').json()
      return this.#handleApiSuccess<'getReportList'>(data)
    } catch (err) {
      return this.#handleApiError<'getReportList'>(err)
    }
  }

  async getReportSupportedFiles(): Promise<
    SocketSdkResultType<'getReportSupportedFiles'>
  > {
    try {
      const data = await this.#getClient().get('report/supported').json()
      return this.#handleApiSuccess<'getReportSupportedFiles'>(data)
    } catch (err) {
      return this.#handleApiError<'getReportSupportedFiles'>(err)
    }
  }

  async getScoreByNPMPackage(
    pkgName: string,
    version: string
  ): Promise<SocketSdkResultType<'getScoreByNPMPackage'>> {
    const pkgParam = encodeURIComponent(pkgName)
    const versionParam = encodeURIComponent(version)

    try {
      const data = await this.#getClient()
        .get(`npm/${pkgParam}/${versionParam}/score`)
        .json()
      return this.#handleApiSuccess<'getScoreByNPMPackage'>(data)
    } catch (err) {
      return this.#handleApiError<'getScoreByNPMPackage'>(err)
    }
  }

  async postSettings(
    selectors: Array<{ organization?: string }>
  ): Promise<SocketSdkResultType<'postSettings'>> {
    try {
      const data = await this.#getClient()
        .post('settings', { json: selectors })
        .json()
      return this.#handleApiSuccess<'postSettings'>(data)
    } catch (err) {
      return this.#handleApiError<'postSettings'>(err)
    }
  }

  async searchDependencies(
    params: Record<string, number>
  ): Promise<SocketSdkResultType<'searchDependencies'>> {
    try {
      const data = await this.#getClient()
        .post('dependencies/search', { json: params })
        .json()
      return this.#handleApiSuccess<'searchDependencies'>(data)
    } catch (err) {
      return this.#handleApiError<'searchDependencies'>(err)
    }
  }

  async updateOrgRepo(
    orgSlug: string,
    repoSlug: string,
    params: Record<string, string>
  ): Promise<SocketSdkResultType<'updateOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const data = await this.#getClient()
        .post(`orgs/${orgSlugParam}/repos/${repoSlug}`, { json: params })
        .json()
      return this.#handleApiSuccess<'updateOrgRepo'>(data)
    } catch (err) {
      return this.#handleApiError<'updateOrgRepo'>(err)
    }
  }
}

console.log(Object.getOwnPropertyDescriptors(SocketSdk.prototype))
// Add alias to preserve backwards compatibility.
Object.defineProperty(SocketSdk.prototype, 'createReportFromFilePaths', {
  __proto__: null,
  configurable: true,
  enumerable: false,
  value: SocketSdk.prototype.createReportFromFilepaths,
  writable: true
} as PropertyDescriptor)

export { type SocketSdkOptions, createUserAgentFromPkgJson, SocketSdk }
