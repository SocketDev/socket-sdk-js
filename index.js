'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')

const { ErrorWithCause } = require('pony-cause')

const pkg = require('./package.json')

/** @typedef {keyof import('./types/api').operations} SocketSdkOperations */

/**
 * @template {SocketSdkOperations} T
 * @typedef {import('./types/api-helpers').OpReturnType<import('./types/api').operations[T]>} SocketSdkReturnType
 */

/**
 * @template {SocketSdkOperations} T
 * @typedef {import('./types/api-helpers').OpErrorType<import('./types/api').operations[T]>} SocketSdkErrorType
 */

/**
 * @template {SocketSdkOperations} T
 * @typedef {SocketSdkReturnType<T> | SocketSdkErrorType<T>} SocketSdkResultType
 */

/**
 * @typedef SocketSdkOptions
 * @property {import('got').Agents} [agent]
 * @property {string} [baseUrl]
 * @property {string} [userAgent]
 */

class SocketSdk {
   /** @type {import('got').Got|undefined} */
  #client

  /** @type {typeof import('got').HTTPError|undefined} */
  #HTTPError

  /** @type {import('got').ExtendOptions} */
  #gotOptions

  /**
   * @param {string} apiKey
   * @param {SocketSdkOptions} options
   * @throws {SocketSdkAuthError}
   */
  constructor (apiKey, options = {}) {
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

  /**
   * @returns {Promise<import('got').Got>}
   */
  async #getClient () {
    if (!this.#client) {
      const {
        default: got,
        HTTPError,
      } = await import('got')

      this.#HTTPError = HTTPError
      this.#client = got.extend(this.#gotOptions)
    }

    return this.#client
  }

  /**
   * @param {string[]} filePaths
   * @param {string} pathsRelativeTo
   * @param {{ [key: string]: boolean }} [issueRules]
   * @returns {Promise<SocketSdkResultType<'createReport'>>}
   */
   async createReportFromFilePaths (filePaths, pathsRelativeTo = '.', issueRules) {
    const basePath = path.resolve(process.cwd(), pathsRelativeTo)
    const absoluteFilePaths = filePaths.map(filePath => path.resolve(basePath, filePath))

    const [
      { FormData, Blob },
      { fileFromPath },
      client
    ] = await Promise.all([
      import('formdata-node'),
      import('formdata-node/file-from-path'),
      this.#getClient(),
    ])

    const body = new FormData()

    if (issueRules) {
      const issueRulesBlob = new Blob([JSON.stringify(issueRules)], { type: 'application/json' })
      body.set('issueRules', issueRulesBlob, 'issueRules')
    }

    const files = await Promise.all(absoluteFilePaths.map(absoluteFilePath => fileFromPath(absoluteFilePath)))

    for (let i = 0, length = files.length; i < length; i++) {
      const absoluteFilePath = absoluteFilePaths[i]
      if (absoluteFilePath) {
        const relativeFilePath = path.relative(basePath, absoluteFilePath)
        body.set(relativeFilePath, files[i])
      }
    }

    try {
      const data = await client.put('report/upload', { body }).json()

      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'createReport'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} pkgName
   * @param {string} version
   * @returns {Promise<SocketSdkResultType<'getScoreByNPMPackage'>>}
   */
  async getScoreByNPMPackage (pkgName, version) {
    const pkgParam = encodeURIComponent(pkgName)
    const versionParam = encodeURIComponent(version)

    try {
      const client = await this.#getClient()
      const data = await client.get(`npm/${pkgParam}/${versionParam}/score`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getScoreByNPMPackage'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} pkgName
   * @param {string} version
   * @returns {Promise<SocketSdkResultType<'getIssuesByNPMPackage'>>}
   */
  async getIssuesByNPMPackage (pkgName, version) {
    const pkgParam = encodeURIComponent(pkgName)
    const versionParam = encodeURIComponent(version)

    try {
      const client = await this.#getClient()
      const data = await client.get(`npm/${pkgParam}/${versionParam}/issues`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getIssuesByNPMPackage'>} */ (this.#handleApiError(err))
    }
  }

  /** @returns {Promise<SocketSdkResultType<'getReportList'>>} */
  async getReportList () {
    try {
      const client = await this.#getClient()
      const data = await client.get('report/list').json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getReportList'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} id
   * @returns {Promise<SocketSdkResultType<'getReport'>>}
   */
  async getReport (id) {
    const idParam = encodeURIComponent(id)

    try {
      const client = await this.#getClient()
      const data = await client.get(`report/view/${idParam}`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getReport'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @returns {Promise<SocketSdkResultType<'getReportSupportedFiles'>>}
   */
  async getReportSupportedFiles () {
    try {
      const client = await this.#getClient()
      const data = await client.get('report/supported').json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getReportSupportedFiles'>} */ (this.#handleApiError(err))
    }
  }

  /** @returns {Promise<SocketSdkResultType<'getQuota'>>} */
  async getQuota () {
    try {
      const client = await this.#getClient()
      const data = await client.get('quota').json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getQuota'>} */ (this.#handleApiError(err))
    }
  }

  /** @returns {Promise<SocketSdkResultType<'getOrganizations'>>} */
  async getOrganizations () {
    try {
      const client = await this.#getClient()
      const data = await client.get('organizations').json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getQuota'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} time
   * @returns {Promise<SocketSdkResultType<'getOrgAnalytics'>>}
   */
  async getOrgAnalytics (time) {
    const timeParam = encodeURIComponent(time)

    try {
      const client = await this.#getClient()
      const data = await client.get(`analytics/org/${timeParam}`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getOrgAnalytics'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} repo
   * @param {string} time
   * @returns {Promise<SocketSdkResultType<'getRepoAnalytics'>>}
   */
  async getRepoAnalytics (repo, time) {
    const timeParam = encodeURIComponent(time)
    const repoParam = encodeURIComponent(repo)

    try {
      const client = await this.#getClient()
      const data = await client.get(`analytics/repo/${repoParam}/${timeParam}`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getRepoAnalytics'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} orgSlug
   * @param {{[key: string]: any }} queryParams
   * @returns {Promise<SocketSdkResultType<'getOrgFullScanList'>>}
   */
    async getOrgFullScanList (orgSlug, queryParams) {
      const orgSlugParam = encodeURIComponent(orgSlug)
      const formattedQueryParams = new URLSearchParams(queryParams)

      try {
        const client = await this.#getClient()
        const data = await client.get(`orgs/${orgSlugParam}/full-scans?${formattedQueryParams}`).json()
        return { success: true, status: 200, data }
      } catch (err) {
        return /** @type {SocketSdkErrorType<'getOrgFullScanList'>} */ (this.#handleApiError(err))
      }
    }

  /**
   * @param {string} orgSlug
   * @param {string} fullScanId
   * @param {string | undefined} file
   * @returns {Promise<SocketSdkResultType<'getOrgFullScan'>>}
   */
    async getOrgFullScan (orgSlug, fullScanId, file) {
      const orgSlugParam = encodeURIComponent(orgSlug)
      const fullScanIdParam = encodeURIComponent(fullScanId)
      try {
        const client = await this.#getClient()
        let readStream
        if (file) {
          readStream = await pipeline(
            client.stream(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}`),
            fs.createWriteStream(file)
          )
        } else {
          readStream = await client.stream(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}`).pipe(process.stdout)
        }
        return { success: true, status: 200, data: readStream }
      } catch (err) {
        return /** @type {SocketSdkErrorType<'getOrgFullScan'>} */ (this.#handleApiError(err))
      }
    }

  /**
   * @param {string} orgSlug
   * @param {string} fullScanId
   * @returns {Promise<SocketSdkResultType<'getOrgFullScanMetadata'>>}
   */
    async getOrgFullScanMetadata (orgSlug, fullScanId) {
      const orgSlugParam = encodeURIComponent(orgSlug)
      const fullScanIdParam = encodeURIComponent(fullScanId)

      try {
        const client = await this.#getClient()
        const data = await client.get(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}/metadata`).json()
        return { success: true, status: 200, data }
      } catch (err) {
        return /** @type {SocketSdkErrorType<'getOrgFullScanMetadata'>} */ (this.#handleApiError(err))
      }
    }

  /**
   * @param {string} orgSlug
   * @param {string} fullScanId
   * @returns {Promise<SocketSdkResultType<'deleteOrgFullScan'>>}
   */
    async deleteOrgFullScan (orgSlug, fullScanId) {
      const orgSlugParam = encodeURIComponent(orgSlug)
      const fullScanIdParam = encodeURIComponent(fullScanId)

      try {
        const client = await this.#getClient()
        const data = await client.delete(`orgs/${orgSlugParam}/full-scans/${fullScanIdParam}`).json()
        return { success: true, status: 200, data }
      } catch (err) {
        return /** @type {SocketSdkErrorType<'deleteOrgFullScan'>} */ (this.#handleApiError(err))
      }
    }

  /**
   * @param {string} orgSlug
   * @param {{[key: string]: any }} queryParams
   * @param {string[]} filePaths
   * @param {string} pathsRelativeTo
   * @returns {Promise<SocketSdkResultType<'CreateOrgFullScan'>>}
   */
   async createOrgFullScan (orgSlug, queryParams, filePaths, pathsRelativeTo = '.') {
    const basePath = path.resolve(process.cwd(), pathsRelativeTo)
    const absoluteFilePaths = filePaths.map(filePath => path.resolve(basePath, filePath))
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParams = new URLSearchParams(queryParams)

    const [
      { FormData },
      { fileFromPath },
      client
    ] = await Promise.all([
      import('formdata-node'),
      import('formdata-node/file-from-path'),
      this.#getClient(),
    ])

    const body = new FormData()

    const files = await Promise.all(absoluteFilePaths.map(absoluteFilePath => fileFromPath(absoluteFilePath)))

    for (let i = 0, length = files.length; i < length; i++) {
      const absoluteFilePath = absoluteFilePaths[i]
      if (absoluteFilePath) {
        const relativeFilePath = path.relative(basePath, absoluteFilePath)
        body.set(relativeFilePath, files[i])
      }
    }

    try {
      const data = await client.post(`orgs/${orgSlugParam}/full-scans?${formattedQueryParams}`, { body }).json()

      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'CreateOrgFullScan'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} orgSlug
   * @param {{[key: string]: any }} queryParams
   * @returns {Promise<SocketSdkResultType<'getAuditLogEvents'>>}
   */
    async getAuditLogEvents (orgSlug, queryParams) {
      const orgSlugParam = encodeURIComponent(orgSlug)
      const formattedQueryParam = new URLSearchParams(queryParams)

      try {
        const client = await this.#getClient()
        const data = await client.get(`orgs/${orgSlugParam}/audit-log?${formattedQueryParam}`).json()
        return { success: true, status: 200, data }
      } catch (err) {
        return /** @type {SocketSdkErrorType<'getAuditLogEvents'>} */ (this.#handleApiError(err))
      }
    }

  /**
   * @param {string} orgSlug
   * @param {string} repoSlug
   * @returns {Promise<SocketSdkResultType<'getOrgRepo'>>}
   */
  async getOrgRepo (orgSlug, repoSlug) {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const repoSlugParam = encodeURIComponent(repoSlug)

    try {
      const client = await this.#getClient()
      const data = await client.get(`orgs/${orgSlugParam}/repos/${repoSlugParam}`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getOrgRepo'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} orgSlug
   * @param {string} repoSlug
   * @returns {Promise<SocketSdkResultType<'deleteOrgRepo'>>}
   */
    async deleteOrgRepo (orgSlug, repoSlug) {
      const orgSlugParam = encodeURIComponent(orgSlug)
      const repoSlugParam = encodeURIComponent(repoSlug)

      try {
        const client = await this.#getClient()
        const data = await client.delete(`orgs/${orgSlugParam}/repos/${repoSlugParam}`).json()
        return { success: true, status: 200, data }
      } catch (err) {
        return /** @type {SocketSdkErrorType<'deleteOrgRepo'>} */ (this.#handleApiError(err))
      }
    }

  /**
   * @param {string} orgSlug
   * @param {{[key: string]: any }} queryParams
   * @returns {Promise<SocketSdkResultType<'getOrgRepoList'>>}
   */
  async getOrgRepoList (orgSlug, queryParams) {
    const orgSlugParam = encodeURIComponent(orgSlug)
    const formattedQueryParam = new URLSearchParams(queryParams)

    try {
      const client = await this.#getClient()
      const data = await client.get(`orgs/${orgSlugParam}/repos?${formattedQueryParam}`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getOrgRepoList'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} orgSlug
   * @param {{[key: string]: any }} params
   * @returns {Promise<SocketSdkResultType<'createOrgRepo'>>}
   */
  async createOrgRepo (orgSlug, params) {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const client = await this.#getClient()
      const data = await client.post(`orgs/${orgSlugParam}/repos`, { json: params }).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'createOrgRepo'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} orgSlug
   * @param {string} repoSlug
   * @param {{[key: string]: any }} params
   * @returns {Promise<SocketSdkResultType<'updateOrgRepo'>>}
   */
  async updateOrgRepo (orgSlug, repoSlug, params) {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const client = await this.#getClient()
      const data = await client.post(`orgs/${orgSlugParam}/repos/${repoSlug}`, { json: params }).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'updateOrgRepo'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {{[key: string]: string }} queryParams
   * @param {{components: {purl: string}[] }} components
   * @returns {Promise<SocketSdkResultType<'batchPackageFetch'>>}
   */
    async batchPackageFetch (queryParams, components) {
      const formattedQueryParam = new URLSearchParams(queryParams)

      try {
        const client = await this.#getClient()
        const data = await client.post(`purl?${formattedQueryParam}`, { json: components })

        // Parse the ndjson response
        const /** @type {{[key: string]: any}[]} */ resp_json = []
        const ndjson = data.body.split('\n')
        ndjson.map(o => o && resp_json.push(JSON.parse(o)))

        return { success: true, status: 200, data: resp_json }
      } catch (err) {
        return /** @type {SocketSdkErrorType<'batchPackageFetch'>} */ (this.#handleApiError(err))
      }
    }

  /**
   * @param {{[key: string]: number }} params
   * @returns {Promise<SocketSdkResultType<'searchDependencies'>>}
   */
    async searchDependencies (params) {
      try {
        const client = await this.#getClient()
        const data = await client.post('dependencies/search', { json: params }).json()
        return { success: true, status: 200, data }
      } catch (err) {
        return /** @type {SocketSdkErrorType<'searchDependencies'>} */ (this.#handleApiError(err))
      }
    }

  /**
   * @param {{[key: string]: string }} params
   * @param {string[]} filePaths
   * @param {string} pathsRelativeTo
   * @returns {Promise<SocketSdkResultType<'createDependenciesSnapshot'>>}
   */
    async createDependenciesSnapshot (params, filePaths, pathsRelativeTo = '.') {
      const basePath = path.resolve(process.cwd(), pathsRelativeTo)
      const absoluteFilePaths = filePaths.map(filePath => path.resolve(basePath, filePath))
      const formattedQueryParams = new URLSearchParams(params)

      const [
        { FormData },
        { fileFromPath },
        client
      ] = await Promise.all([
        import('formdata-node'),
        import('formdata-node/file-from-path'),
        this.#getClient(),
      ])

      const body = new FormData()

      const files = await Promise.all(absoluteFilePaths.map(absoluteFilePath => fileFromPath(absoluteFilePath)))

      for (let i = 0, length = files.length; i < length; i++) {
        const absoluteFilePath = absoluteFilePaths[i]
        if (absoluteFilePath) {
          const relativeFilePath = path.relative(basePath, absoluteFilePath)
          body.set(relativeFilePath, files[i])
        }
      }

      try {
        const data = await client.post(`dependencies/upload?${formattedQueryParams}`, { body }).json()

        return { success: true, status: 200, data }
      } catch (err) {
        return /** @type {SocketSdkErrorType<'createDependenciesSnapshot'>} */ (this.#handleApiError(err))
      }
    }

  /**
   * @param {Array<{ organization?: string }>} selectors
   * @returns {Promise<SocketSdkResultType<'postSettings'>>}
   */
  async postSettings (selectors) {
    try {
      const client = await this.#getClient()
      const data = await client.post('settings', {
        json: selectors
      }).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'postSettings'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {string} orgSlug
   * @returns {Promise<SocketSdkResultType<'getOrgSecurityPolicy'>>}
   */
  async getOrgSecurityPolicy (orgSlug) {
    const orgSlugParam = encodeURIComponent(orgSlug)

    try {
      const client = await this.#getClient()
      const data = await client.get(`orgs/${orgSlugParam}/settings/security-policy`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getOrgSecurityPolicy'>} */ (this.#handleApiError(err))
    }
  }

  /**
   * @param {unknown} err
   * @returns {{ success: false, status: number, error: Record<string,unknown> }}
   */
  #handleApiError (err) {
    if (this.#HTTPError && err instanceof this.#HTTPError) {
      if (err.response.statusCode >= 500) {
        throw new ErrorWithCause('API returned an error', { cause: err })
      }

      return {
        success: false,
        status: err.response.statusCode,
        error: this.#getApiErrorDescription(err)
      }
    }

    throw new ErrorWithCause('Unexpected error when calling API', { cause: err })
  }

  /**
   * @param {import('got').HTTPError} err
   * @returns {Record<string,unknown>}
   */
  #getApiErrorDescription (err) {
    /** @type {unknown} */
    let rawBody

    try {
      rawBody = JSON.parse(/** @type {string} */ (err.response.body))
    } catch (cause) {
      throw new ErrorWithCause('Could not parse API error response', { cause })
    }

    const errorDescription = ensureObject(rawBody) ? rawBody['error'] : undefined

    if (!ensureObject(errorDescription)) {
      throw new Error('Invalid body on API error response')
    }

    return errorDescription
  }
}

/**
 * @param {unknown} value
 * @returns {value is { [key: string]: unknown }}
 */
function ensureObject (value) {
  return !!(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * @param {{ name: string, version: string, homepage?: string }} pkgData Package.json data to base the User-Agent on
 * @returns {string}
 */
function createUserAgentFromPkgJson (pkgData) {
  return `${pkgData.name.replace('@', '').replace('/', '-')}/${pkgData.version}` + (pkgData.homepage ? ` (${pkgData.homepage})` : '')
}

module.exports = {
  createUserAgentFromPkgJson,
  SocketSdk,
}
