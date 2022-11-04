'use strict'

const path = require('node:path')

const { ErrorWithCause } = require('pony-cause')

/**
 * @template {keyof import('./types/api').operations} T
 * @typedef {import('./types/api-helpers').OpReturnType<import('./types/api').operations[T]>} SocketSdkReturnType
 */

/**
 * @template {keyof import('./types/api').operations} T
 * @typedef {import('./types/api-helpers').OpErrorType<import('./types/api').operations[T]>} SocketSdkErrorType
 */

/**
 * @template {keyof import('./types/api').operations} T
 * @typedef {SocketSdkReturnType<T> | SocketSdkErrorType<T>} SocketSdkResultType
 */

/**
 * @typedef SocketSdkOptions
 * @property {import('got').Agents} [agent]
 * @property {string} [baseUrl]
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
    } = options

    this.#gotOptions = {
      prefixUrl: baseUrl,
      retry: { limit: 0 },
      username: apiKey,
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
   * @returns {Promise<SocketSdkResultType<'createReport'>>}
   */
   async createReportFromFilePaths (filePaths, pathsRelativeTo = '.') {
    const basePath = path.resolve(process.cwd(), pathsRelativeTo)
    const absoluteFilePaths = filePaths.map(filePath => path.resolve(basePath, filePath))

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

module.exports = { SocketSdk }
