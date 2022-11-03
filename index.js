import path from 'node:path'

import { FormData } from 'formdata-node'
import { fileFromPath } from 'formdata-node/file-from-path'
import got from 'got'

import { handleApiError } from './lib/helpers.js'

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

export class SocketSdk {
   /** @type {import('got').Got} */
  #client

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

    this.#client = got.extend({
      prefixUrl: baseUrl,
      retry: { limit: 0 },
      username: apiKey,
      ...(agent ? { agent } : {}),
    })
  }

  /**
   * @param {string[]} filePaths
   * @param {string} pathsRelativeTo
   * @returns {Promise<SocketSdkResultType<'createReport'>>}
   */
   async createReportFromFilePaths (filePaths, pathsRelativeTo = '.') {
    const basePath = path.resolve(process.cwd(), pathsRelativeTo)
    const absoluteFilePaths = filePaths.map(filePath => path.resolve(basePath, filePath))

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
      const data = await this.#client.put('report/upload', { body }).json()

      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'createReport'>} */ (handleApiError(err))
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
      const data = await this.#client.get(`/npm/${pkgParam}/${versionParam}/score`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getScoreByNPMPackage'>} */ (handleApiError(err))
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
      const data = await this.#client.get(`/npm/${pkgParam}/${versionParam}/issues`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getIssuesByNPMPackage'>} */ (handleApiError(err))
    }
  }

  /** @returns {Promise<SocketSdkResultType<'getReportList'>>} */
  async getReportList () {
    try {
      const data = await this.#client.get('/report/list').json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getReportList'>} */ (handleApiError(err))
    }
  }

  /**
   * @param {string} id
   * @returns {Promise<SocketSdkResultType<'getReport'>>}
   */
  async getReport (id) {
    const idParam = encodeURIComponent(id)

    try {
      const data = await this.#client.get(`/report/view/${idParam}`).json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getReport'>} */ (handleApiError(err))
    }
  }

  /** @returns {Promise<SocketSdkResultType<'getQuota'>>} */
  async getQuota () {
    try {
      const data = await this.#client.get('/quota').json()
      return { success: true, status: 200, data }
    } catch (err) {
      return /** @type {SocketSdkErrorType<'getQuota'>} */ (handleApiError(err))
    }
  }
}
