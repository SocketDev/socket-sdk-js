import { createWriteStream } from 'node:fs'
import { resolve, relative } from 'node:path'
import { pipeline } from 'node:stream/promises'

import { FormData, Blob } from 'formdata-node'
import { fileFromPath } from 'formdata-node/file-from-path'
import got, { HTTPError } from 'got'
import { ErrorWithCause } from 'pony-cause'

import pkg from '../package.json'

import type { operations } from '../types/api'
import type { OpReturnType, OpErrorType } from '../types/api-helpers'
import type { Got, Agents, ExtendOptions } from 'got'
import type { Readable } from 'node:stream'

type SocketSdkOperations = keyof operations
type SocketSdkReturnType<T extends SocketSdkOperations> = OpReturnType<operations[T]>
type SocketSdkErrorType<T extends SocketSdkOperations> = OpErrorType<operations[T]>
type SocketSdkResultType<T extends SocketSdkOperations> = SocketSdkReturnType<T> | SocketSdkErrorType<T>

interface SocketSdkOptions {
  agent?: Agents
  baseUrl?: string
  userAgent?: string
}

class SocketSdk {
  #client?: Got
  readonly #gotOptions: ExtendOptions

  /**
   * @throws {SocketSdkAuthError}
   */
  constructor (apiKey: string, options: SocketSdkOptions = {}) {
    const {
      agent,
      baseUrl = 'https://api.socket.dev/v0/',
      userAgent,
    } = options

    this.#gotOptions = {
      prefixUrl: baseUrl,
      retry: { limit: 0 },
      username: apiKey,
      enableUnixSockets: false, // See https://github.com/sindresorhus/got/blob/main/documentation/2-options.md#enableunixsockets
      headers: {
        'user-agent': (userAgent ? userAgent + ' ' : '') + createUserAgentFromPkgJson(pkg),
      },
      ...(agent ? { agent } : {}),
    }
  }

  #getClient (): Got {
    if (!this.#client) {
      this.#client = got.extend(this.#gotOptions)
    }
    return this.#client
  }

  async createReportFromFilePaths (
    filePaths: Array<string>,
    pathsRelativeTo: string = '.',
    issueRules?: Record<string, boolean>
  ): Promise<SocketSdkResultType<'createReport'>> {
    const basePath = resolve(process.cwd(), pathsRelativeTo)
    const absoluteFilePaths = filePaths.map(filePath => resolve(basePath, filePath))

    const body = new FormData()

    if (issueRules) {
      const issueRulesBlob = new Blob([JSON.stringify(issueRules)], { type: 'application/json' })
      body.set('issueRules', issueRulesBlob, 'issueRules')
    }

    const files = await Promise.all(absoluteFilePaths.map(absoluteFilePath => fileFromPath(absoluteFilePath)))

    for (let i = 0, length = files.length; i < length; i++) {
      const absoluteFilePath = absoluteFilePaths[i]
      if (absoluteFilePath) {
        const relativeFilePath = relative(basePath, absoluteFilePath)
        body.set(relativeFilePath, files[i])
      }
    }

    try {
      const data = await this.#getClient().put('report/upload', { body }).json()
      return this.#handleApiSuccess<'createReport'>(data)
    } catch (err) {
      return this.#handleApiError<'createReport'>(err)
    }
  }

  async getScoreByNPMPackage (
    pkgName: string,
    version: string
  ): Promise<SocketSdkResultType<'getScoreByNPMPackage'>> {
    const pkgParam = encodeURIComponent(pkgName)
    const versionParam = encodeURIComponent(version)

    try {
      const data = await this.#getClient().get(`npm/${pkgParam}/${versionParam}/score`).json()
      return this.#handleApiSuccess<'getScoreByNPMPackage'>(data)
    } catch (err) {
      return this.#handleApiError<'getScoreByNPMPackage'>(err)
    }
  }

  async getIssuesByNPMPackage (
    pkgName: string,
    version: string
  ): Promise<SocketSdkResultType<'getIssuesByNPMPackage'>> {
    const pkgParam = encodeURIComponent(pkgName)
    const versionParam = encodeURIComponent(version)

    try {
      const data = await this.#getClient().get(`npm/${pkgParam}/${versionParam}/issues`).json()
      return this.#handleApiSuccess<'getIssuesByNPMPackage'>(data)
    } catch (err) {
      return this.#handleApiError<'getIssuesByNPMPackage'>(err)
    }
  }

  async getReportList (): Promise<SocketSdkResultType<'getReportList'>> {
    try {
      const data = await this.#getClient().get('report/list').json()
      return this.#handleApiSuccess<'getReportList'>(data)
    } catch (err) {
      return this.#handleApiError<'getReportList'>(err)
    }
  }

  async getReport (id: string): Promise<SocketSdkResultType<'getReport'>> {
    const idParam = encodeURIComponent(id)

    try {
      const data = await this.#getClient().get(`report/view/${idParam}`).json()
      return this.#handleApiSuccess<'getReport'>(data)
    } catch (err) {
      return this.#handleApiError<'getReport'>(err)
    }
  }

  async getReportSupportedFiles (): Promise<SocketSdkResultType<'getReportSupportedFiles'>> {
    try {
      const data = await this.#getClient().get('report/supported').json()
      return this.#handleApiSuccess<'getReportSupportedFiles'>(data)
    } catch (err) {
      return this.#handleApiError<'getReportSupportedFiles'>(err)
    }
  }

  async getQuota (): Promise<SocketSdkResultType<'getQuota'>> {
    try {
      const data = await this.#getClient().get('quota').json()
      return this.#handleApiSuccess<'getQuota'>(data)
    } catch (err) {
      return this.#handleApiError<'getQuota'>(err)
    }
  }

  async getOrganizations (): Promise<SocketSdkResultType<'getOrganizations'>> {
    try {
      const data = await this.#getClient().get('organizations').json()
      return this.#handleApiSuccess<'getOrganizations'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrganizations'>(err)
    }
  }

  async getOrgAnalytics (time: string): Promise<SocketSdkResultType<'getOrgAnalytics'>> {
    const timeParam = encodeURIComponent(time)

    try {
      const data = await this.#getClient().get(`analytics/org/${timeParam}`).json()
      return this.#handleApiSuccess<'getOrgAnalytics'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgAnalytics'>(err)
    }
  }

  async getRepoAnalytics (
    repo: string,
    time: string
  ): Promise<SocketSdkResultType<'getRepoAnalytics'>> {
    const timeParam = encodeURIComponent(time)
    const repoParam = encodeURIComponent(repo)

    try {
      const data = await this.#getClient().get(`analytics/repo/${repoParam}/${timeParam}`).json()
      return this.#handleApiSuccess<'getRepoAnalytics'>(data)
    } catch (err) {
      return this.#handleApiError<'getRepoAnalytics'>(err)
    }
  }

  async getOrgFullScanList (
    orgSlug: string,
    queryParams: Record<string, string>
  ): Promise<SocketSdkResultType<'getOrgFullScanList'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParams = new URLSearchParams(queryParams)

    try {
      const data = await this.#getClient().get(`orgs/${orgSlugParam}/full-scans?${formattedQueryParams}`).json()
      return this.#handleApiSuccess<'getOrgFullScanList'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgFullScanList'>(err)
    }
  }

  async getOrgFullScan (
    orgSlug: string,
    fullScanId: string,
    file?: string
  ): Promise<SocketSdkResultType<'getOrgFullScan'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const fullScanIdParam = encodeURIComponent(fullScanId)
    try {
      let readStream: Readable | undefined
      if (file) {
        await pipeline(
          this.#getClient().stream(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}`),
          createWriteStream(file)
        )
      } else {
        readStream = this.#getClient().stream(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}`).pipe(process.stdout)
      }
      return this.#handleApiSuccess<'getOrgFullScan'>(readStream)
    } catch (err) {
      return this.#handleApiError<'getOrgFullScan'>(err)
    }
  }

  async getOrgFullScanMetadata (
    orgSlug: string,
    fullScanId: string
  ): Promise<SocketSdkResultType<'getOrgFullScanMetadata'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const fullScanIdParam = encodeURIComponent(fullScanId)

    try {
      const data = await this.#getClient().get(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}/metadata`).json()
      return this.#handleApiSuccess<'getOrgFullScanMetadata'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgFullScanMetadata'>(err)
    }
  }

  async deleteOrgFullScan (
    orgSlug: string,
    fullScanId: string
  ): Promise<SocketSdkResultType<'deleteOrgFullScan'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const fullScanIdParam = encodeURIComponent(fullScanId)

    try {
      const data = await this.#getClient().delete(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}`).json()
      return this.#handleApiSuccess<'deleteOrgFullScan'>(data)
    } catch (err) {
      return this.#handleApiError<'deleteOrgFullScan'>(err)
    }
  }

  async createOrgFullScan (
    orgSlug: string,
    queryParams: Record<string, string>,
    filePaths: Array<string>,
    pathsRelativeTo: string = '.'
  ): Promise<SocketSdkResultType<'CreateOrgFullScan'>> {
    const basePath = resolve(process.cwd(), pathsRelativeTo)
    const absoluteFilePaths = filePaths.map(filePath => resolve(basePath, filePath))
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParams = new URLSearchParams(queryParams)

    const body = new FormData()

    const files = await Promise.all(absoluteFilePaths.map(absoluteFilePath => fileFromPath(absoluteFilePath)))

    for (let i = 0, length = files.length; i < length; i++) {
      const absoluteFilePath = absoluteFilePaths[i]
      if (absoluteFilePath) {
        const relativeFilePath = relative(basePath, absoluteFilePath)
        body.set(relativeFilePath, files[i])
      }
    }

    try {
      const data = await this.#getClient().post(`orgs/${orgSlugParam}/full-scans?${formattedQueryParams}`, { body }).json()
      return this.#handleApiSuccess<'CreateOrgFullScan'>(data)
    } catch (err) {
      return this.#handleApiError<'CreateOrgFullScan'>(err)
    }
  }

  async getAuditLogEvents (
    orgSlug: string,
    queryParams: Record<string, string>
  ): Promise<SocketSdkResultType<'getAuditLogEvents'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParam = new URLSearchParams(queryParams)

    try {
      const data = await this.#getClient().get(`orgs/${orgSlugParam}/audit-log?${formattedQueryParam}`).json()
      return this.#handleApiSuccess<'getAuditLogEvents'>(data)
    } catch (err) {
      return this.#handleApiError<'getAuditLogEvents'>(err)
    }
  }

  async getOrgRepo (
    orgSlug: string,
    repoSlug: string
  ): Promise<SocketSdkResultType<'getOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const repoSlugParam = encodeURIComponent(repoSlug)

    try {
      const data = await this.#getClient().get(`orgs/${orgSlugParam}/repos/${repoSlugParam}`).json()
      return this.#handleApiSuccess<'getOrgRepo'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgRepo'>(err)
    }
  }

  async deleteOrgRepo (
    orgSlug: string,
    repoSlug: string
  ): Promise<SocketSdkResultType<'deleteOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const repoSlugParam = encodeURIComponent(repoSlug)

    try {
      const data = await this.#getClient().delete(`orgs/${orgSlugParam}/repos/${repoSlugParam}`).json()
      return this.#handleApiSuccess<'deleteOrgRepo'>(data)
    } catch (err) {
      return this.#handleApiError<'deleteOrgRepo'>(err)
    }
  }

  async getOrgRepoList (
    orgSlug: string,
    queryParams: Record<string, string>
  ): Promise<SocketSdkResultType<'getOrgRepoList'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParam = new URLSearchParams(queryParams)

    try {
      const data = await this.#getClient().get(`orgs/${orgSlugParam}/repos?${formattedQueryParam}`).json()
      return this.#handleApiSuccess<'getOrgRepoList'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgRepoList'>(err)
    }
  }

  async createOrgRepo (
    orgSlug: string,
    params: Record<string, string>
  ): Promise<SocketSdkResultType<'createOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const data = await this.#getClient().post(`orgs/${orgSlugParam}/repos`, { json: params }).json()
      return this.#handleApiSuccess<'createOrgRepo'>(data)
    } catch (err) {
      return this.#handleApiError<'createOrgRepo'>(err)
    }
  }

  async updateOrgRepo (
    orgSlug: string,
    repoSlug: string,
    params: Record<string, string>
  ): Promise<SocketSdkResultType<'updateOrgRepo'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const data = await this.#getClient().post(`orgs/${orgSlugParam}/repos/${repoSlug}`, { json: params }).json()
      return this.#handleApiSuccess<'updateOrgRepo'>(data)
    } catch (err) {
      return this.#handleApiError<'updateOrgRepo'>(err)
    }
  }

  async batchPackageFetch (
    queryParams: Record<string, string>,
    components: { components: Array<{ purl: string }> }
  ): Promise<SocketSdkResultType<'batchPackageFetch'>> {
    const formattedQueryParam = new URLSearchParams(queryParams)

    try {
      const response = await this.#getClient().post(`purl?${formattedQueryParam}`, { json: components })

      // Parse the ndjson response
      const resp_json: Array<Record<string, unknown>> = []
      const ndjson = response.body.split('\n')
      ndjson.map(o => o && resp_json.push(JSON.parse(o)))

      return this.#handleApiSuccess<'batchPackageFetch'>(resp_json)
    } catch (err) {
      return this.#handleApiError<'batchPackageFetch'>(err)
    }
  }

  async searchDependencies (
    params: Record<string, number>
  ): Promise<SocketSdkResultType<'searchDependencies'>> {
    try {
      const data = await this.#getClient().post('dependencies/search', { json: params }).json()
      return this.#handleApiSuccess<'searchDependencies'>(data)
    } catch (err) {
      return this.#handleApiError<'searchDependencies'>(err)
    }
  }

  async createDependenciesSnapshot (
    params: Record<string, string>,
    filePaths: Array<string>,
    pathsRelativeTo: string = '.'
  ): Promise<SocketSdkResultType<'createDependenciesSnapshot'>> {
    const basePath = resolve(process.cwd(), pathsRelativeTo)
    const absoluteFilePaths = filePaths.map(filePath => resolve(basePath, filePath))
    const formattedQueryParams = new URLSearchParams(params)

    const body = new FormData()

    const files = await Promise.all(absoluteFilePaths.map(absoluteFilePath => fileFromPath(absoluteFilePath)))

    for (let i = 0, length = files.length; i < length; i++) {
      const absoluteFilePath = absoluteFilePaths[i]
      if (absoluteFilePath) {
        const relativeFilePath = relative(basePath, absoluteFilePath)
        body.set(relativeFilePath, files[i])
      }
    }

    try {
      const data = await this.#getClient().post(`dependencies/upload?${formattedQueryParams}`, { body }).json()
      return this.#handleApiSuccess<'createDependenciesSnapshot'>(data)
    } catch (err) {
      return this.#handleApiError<'createDependenciesSnapshot'>(err)
    }
  }

  async postSettings (
    selectors: Array<{ organization?: string }>
  ): Promise<SocketSdkResultType<'postSettings'>> {
    try {
      const data = await this.#getClient().post('settings', { json: selectors }).json()
      return this.#handleApiSuccess<'postSettings'>(data)
    } catch (err) {
      return this.#handleApiError<'postSettings'>(err)
    }
  }

  async getOrgSecurityPolicy (
    orgSlug: string
  ): Promise<SocketSdkResultType<'getOrgSecurityPolicy'>> {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const data = await this.#getClient().get(`orgs/${orgSlugParam}/settings/security-policy`).json()
      return this.#handleApiSuccess<'getOrgSecurityPolicy'>(data)
    } catch (err) {
      return this.#handleApiError<'getOrgSecurityPolicy'>(err)
    }
  }

  #handleApiError<T extends SocketSdkOperations>(err: unknown): SocketSdkErrorType<T> {
    if (!(err instanceof HTTPError)) {
      throw new ErrorWithCause('Unexpected error when calling API', { cause: err })
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

  #getApiErrorDescription (err: HTTPError): Record<string, unknown> {
    let rawBody: unknown

    try {
      rawBody = JSON.parse(err.response.body as string)
    } catch (cause) {
      throw new ErrorWithCause('Could not parse API error response', { cause })
    }

    const errorDescription = ensureObject(rawBody) ? rawBody['error'] : undefined

    if (!ensureObject(errorDescription)) {
      throw new Error('Invalid body on API error response')
    }

    return errorDescription
  }

  #handleApiSuccess<T extends SocketSdkOperations>(data: unknown): SocketSdkReturnType<T> {
    return {
      success: true,
      status: 200,
      data: data as SocketSdkReturnType<T>['data']
    } satisfies SocketSdkReturnType<T>
  }
}

function ensureObject (value: unknown): value is Record<string, unknown> {
  return !!(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * Package.json data to base the User-Agent on
 */
function createUserAgentFromPkgJson (pkgData: {
  name: string;
  version: string;
  homepage?: string;
}): string {
  return `${pkgData.name.replace('@', '').replace('/', '-')}/${pkgData.version}` + (pkgData.homepage ? ` (${pkgData.homepage})` : '')
}

export {
  createUserAgentFromPkgJson,
  SocketSdk,
  type SocketSdkOptions,
}
