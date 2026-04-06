import http from 'node:http'
import https from 'node:https'

import { debugLog } from '@socketsecurity/lib/debug'
import { httpRequest } from '@socketsecurity/lib/http-request'
import { jsonParse } from '@socketsecurity/lib/json/parse'
import { perfTimer } from '@socketsecurity/lib/performance'

import {
  MAX_RESPONSE_SIZE,
  publicPolicy as defaultPublicPolicy,
} from './constants'
import { sanitizeHeaders } from './utils/header-sanitization'

import type {
  RequestOptions,
  RequestOptionsWithHooks,
  SendMethod,
  SocketArtifactAlert,
  SocketArtifactWithExtras,
} from './types'
import type { HttpResponse } from '@socketsecurity/lib/http-request'
import type { JsonValue } from '@socketsecurity/lib/json/types'
import type { ClientRequest, IncomingMessage } from 'node:http'

export class ResponseError extends Error {
  response: HttpResponse
  url?: string | undefined

  constructor(response: HttpResponse, message = '', url?: string | undefined) {
    /* c8 ignore next 2 - status and statusText may be undefined in edge cases */
    const statusCode = response.status ?? 'unknown'
    const statusMessage = response.statusText || 'No status message'
    super(
      /* c8 ignore next - fallback empty message if not provided */
      `Socket API ${message || 'Request failed'} (${statusCode}): ${statusMessage}`,
    )
    this.name = 'ResponseError'
    this.response = response
    this.url = url
    Error.captureStackTrace(this, ResponseError)
  }
}

export async function createDeleteRequest(
  baseUrl: string,
  urlPath: string,
  options?: RequestOptionsWithHooks | undefined,
): Promise<HttpResponse> {
  const startTime = Date.now()
  const url = `${baseUrl}${urlPath}`
  const method = 'DELETE'
  const { hooks, ...rawOpts } = {
    __proto__: null,
    ...options,
  } as any as RequestOptionsWithHooks
  const opts = { __proto__: null, ...rawOpts } as any as RequestOptions

  hooks?.onRequest?.({
    method,
    url,
    headers: sanitizeHeaders(opts.headers),
    timeout: opts.timeout,
  })

  try {
    const response = await httpRequest(url, {
      method,
      headers: opts.headers as Record<string, string>,
      timeout: opts.timeout,
      maxResponseSize: MAX_RESPONSE_SIZE,
    })

    hooks?.onResponse?.({
      method,
      url,
      duration: Date.now() - startTime,
      status: response.status,
      statusText: response.statusText,
      headers: sanitizeHeaders(response.headers),
    })

    return response
  } catch (error) {
    hooks?.onResponse?.({
      method,
      url,
      duration: Date.now() - startTime,
      error: error as Error,
    })

    throw error
  }
}

export async function createGetRequest(
  baseUrl: string,
  urlPath: string,
  options?: RequestOptionsWithHooks | undefined,
): Promise<HttpResponse> {
  const startTime = Date.now()
  const url = `${baseUrl}${urlPath}`
  const method = 'GET'
  const stopTimer = perfTimer('http:get', { urlPath })
  const { hooks, ...rawOpts } = {
    __proto__: null,
    ...options,
  } as any as RequestOptionsWithHooks
  const opts = { __proto__: null, ...rawOpts } as any as RequestOptions

  hooks?.onRequest?.({
    method,
    url,
    headers: sanitizeHeaders(opts.headers),
    timeout: opts.timeout,
  })

  try {
    const response = await httpRequest(url, {
      method,
      headers: opts.headers as Record<string, string>,
      timeout: opts.timeout,
      maxResponseSize: MAX_RESPONSE_SIZE,
    })
    stopTimer({ statusCode: response.status })

    hooks?.onResponse?.({
      method,
      url,
      duration: Date.now() - startTime,
      status: response.status,
      statusText: response.statusText,
      headers: sanitizeHeaders(response.headers),
    })

    return response
  } catch (error) {
    stopTimer({ error: true })

    hooks?.onResponse?.({
      method,
      url,
      duration: Date.now() - startTime,
      error: error as Error,
    })

    throw error
  }
}

export async function createRequestWithJson(
  method: SendMethod,
  baseUrl: string,
  urlPath: string,
  json: unknown,
  options?: RequestOptionsWithHooks | undefined,
): Promise<HttpResponse> {
  const startTime = Date.now()
  const url = `${baseUrl}${urlPath}`
  const stopTimer = perfTimer(`http:${method.toLowerCase()}`, {
    urlPath,
  })
  const { hooks, ...rawOpts } = {
    __proto__: null,
    ...options,
  } as any as RequestOptionsWithHooks
  const opts = { __proto__: null, ...rawOpts } as any as RequestOptions
  const body = JSON.stringify(json)
  const headers = {
    ...opts.headers,
    'Content-Type': 'application/json',
  } as Record<string, string>

  hooks?.onRequest?.({
    method,
    url,
    headers: sanitizeHeaders(headers),
    timeout: opts.timeout,
  })

  try {
    const response = await httpRequest(url, {
      method,
      body,
      headers,
      timeout: opts.timeout,
      maxResponseSize: MAX_RESPONSE_SIZE,
    })
    stopTimer({ statusCode: response.status })

    hooks?.onResponse?.({
      method,
      url,
      duration: Date.now() - startTime,
      status: response.status,
      statusText: response.statusText,
      headers: sanitizeHeaders(response.headers),
    })

    return response
  } catch (error) {
    stopTimer({ error: true })

    hooks?.onResponse?.({
      method,
      url,
      duration: Date.now() - startTime,
      error: error as Error,
    })

    throw error
  }
}

export async function getErrorResponseBody(
  response: HttpResponse,
): Promise<string> {
  return response.text()
}

export function getHttpModule(url: string): typeof http | typeof https {
  return url.startsWith('https:') ? https : http
}

export async function getResponse(
  req: ClientRequest,
): Promise<IncomingMessage> {
  return await new Promise((resolve, reject) => {
    let timedOut = false
    req.on('response', (response: IncomingMessage) => {
      /* c8 ignore next 3 - Race condition where response arrives after timeout. */
      if (timedOut) {
        return
      }
      resolve(response)
    })
    req.on('timeout', () => {
      timedOut = true
      req.destroy()
      const method = (req as any).method || 'REQUEST'
      const path = (req as any).path || 'unknown'
      const timeout = (req as any).timeout || 'configured timeout'
      const message = [
        `${method} request timed out after ${timeout}ms: ${path}`,
        '→ The Socket API did not respond in time.',
        '→ Try: Increase timeout option or check network connectivity.',
        '→ If problem persists, Socket API may be experiencing issues.',
      ].join('\n')
      reject(new Error(message))
    })
    req.on('error', e => {
      if (!timedOut) {
        const err = e as NodeJS.ErrnoException
        const method = (req as any).method || 'REQUEST'
        const path = (req as any).path || 'unknown'
        let message = `${method} request failed: ${path}`

        if (err.code === 'ECONNREFUSED') {
          message += [
            '',
            '→ Connection refused. Socket API server is unreachable.',
            '→ Check: Network connectivity and firewall settings.',
            '→ Verify: Base URL is correct (default: https://api.socket.dev)',
          ].join('\n')
        } else if (err.code === 'ENOTFOUND') {
          message += [
            '',
            '→ DNS lookup failed. Cannot resolve hostname.',
            '→ Check: Internet connection and DNS settings.',
            '→ Verify: Base URL hostname is correct.',
          ].join('\n')
        } else if (err.code === 'ETIMEDOUT') {
          message += [
            '',
            '→ Connection timed out. Network or server issue.',
            '→ Try: Check network connectivity and retry.',
            '→ If using proxy, verify proxy configuration.',
          ].join('\n')
        } else if (err.code === 'ECONNRESET') {
          message += [
            '',
            '→ Connection reset by server. Possible network interruption.',
            '→ Try: Retry the request. Enable retries option if not set.',
          ].join('\n')
        } else if (err.code === 'EPIPE') {
          message += [
            '',
            '→ Broken pipe. Server closed connection unexpectedly.',
            '→ Possible: Authentication issue or server error.',
            '→ Check: API token is valid and has required permissions.',
          ].join('\n')
        } else if (
          err.code === 'CERT_HAS_EXPIRED' ||
          err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
        ) {
          message += [
            '',
            '→ SSL/TLS certificate error.',
            '→ Check: System time and date are correct.',
            '→ Try: Update CA certificates on your system.',
          ].join('\n')
        } else if (err.code) {
          message += `\n→ Error code: ${err.code}`
        }

        const enhancedError = new Error(message, { cause: e })
        reject(enhancedError)
      }
    })
  })
}

export async function getResponseJson(
  response: HttpResponse,
  method?: string | undefined,
  url?: string | undefined,
): Promise<JsonValue | undefined> {
  const stopTimer = perfTimer('http:parse-json')
  try {
    if (!isResponseOk(response)) {
      throw new ResponseError(
        response,
        method ? `${method} Request failed` : undefined,
        url,
      )
    }
    const responseBody = response.text()

    if (responseBody === '') {
      debugLog('API response: empty response treated as {}')
      stopTimer({ success: true })
      return {}
    }

    try {
      const responseJson = jsonParse(responseBody)
      debugLog('API response:', responseJson)
      stopTimer({ success: true })
      return responseJson
    } catch (e) {
      stopTimer({ error: true })
      if (e instanceof SyntaxError) {
        const contentType = response.headers['content-type']
        const preview =
          responseBody.length > 200
            ? `${responseBody.slice(0, 200)}...`
            : responseBody
        const messageParts = [
          'Socket API returned invalid JSON response',
          `→ Response preview: ${preview}`,
          `→ Parse error: ${e.message}`,
        ]

        if (contentType && !contentType.includes('application/json')) {
          messageParts.push(
            `→ Unexpected Content-Type: ${contentType} (expected application/json)`,
            '→ The API may have returned an error page instead of JSON.',
          )
        } else if (responseBody.startsWith('<')) {
          messageParts.push(
            '→ Response appears to be HTML, not JSON.',
            '→ This may indicate an API endpoint error or network interception.',
          )
          /* c8 ignore next 3 - Empty responses are handled before JSON parsing, making this branch unreachable */
        } else if (responseBody.length === 0) {
          messageParts.push('→ Response body is empty when JSON was expected.')
        } else if (
          responseBody.includes('502 Bad Gateway') ||
          responseBody.includes('503 Service')
        ) {
          messageParts.push(
            '→ Response indicates a server error.',
            '→ The Socket API may be temporarily unavailable.',
          )
        }

        const enhancedError = new Error(messageParts.join('\n'), {
          cause: e,
        }) as SyntaxError & {
          originalResponse?: string | undefined
        }
        enhancedError.name = 'SyntaxError'
        enhancedError.originalResponse = responseBody
        Object.setPrototypeOf(enhancedError, SyntaxError.prototype)
        throw enhancedError
      }
      /* c8 ignore start - Error instanceof check and unknown error handling for JSON parsing edge cases. */
      if (e instanceof Error) {
        throw e
      }
      const unknownError = new Error('Unknown JSON parsing error', {
        cause: e,
      }) as SyntaxError & {
        originalResponse?: string | undefined
      }
      unknownError.name = 'SyntaxError'
      unknownError.originalResponse = responseBody
      Object.setPrototypeOf(unknownError, SyntaxError.prototype)
      throw unknownError
      /* c8 ignore stop */
    }
  } catch (error) {
    stopTimer({ error: true })
    throw error
  }
}

export function isResponseOk(response: HttpResponse): boolean {
  return response.ok
}

export function reshapeArtifactForPublicPolicy<
  T extends Record<string, unknown>,
>(
  data: T,
  isAuthenticated: boolean,
  actions?: string | undefined,
  policy?: Map<string, string> | undefined,
): T {
  if (!isAuthenticated) {
    const allowedActions = actions?.trim() ? actions.split(',') : undefined
    const resolvedPolicy = policy ?? defaultPublicPolicy

    const reshapeArtifact = (artifact: SocketArtifactWithExtras) => ({
      name: artifact.name,
      version: artifact.version,
      size: artifact.size,
      author: artifact.author,
      type: artifact.type,
      supplyChainRisk: artifact.supplyChainRisk,
      scorecards: artifact.scorecards,
      topLevelAncestors: artifact.topLevelAncestors,
      alerts: artifact.alerts
        ?.filter((alert: SocketArtifactAlert) => {
          const action = resolvedPolicy.get(alert.type)
          if (alert.severity === 'low') {
            return false
          }
          if (allowedActions && action && !allowedActions.includes(action)) {
            return false
          }
          return true
        })
        .map((alert: SocketArtifactAlert) => ({
          action: resolvedPolicy.get(alert.type),
          key: alert.key,
          severity: alert.severity,
          type: alert.type,
        })),
    })

    if (data['artifacts']) {
      const artifacts = data['artifacts']
      return {
        ...data,
        artifacts: Array.isArray(artifacts)
          ? artifacts.map(reshapeArtifact)
          : artifacts,
      }
    }
    if (data['alerts']) {
      return reshapeArtifact(
        data as unknown as SocketArtifactWithExtras,
      ) as unknown as T
    }
  }
  return data
}
