import { debugLog } from '@socketsecurity/lib/debug'
import { isError } from '@socketsecurity/lib/errors'
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

  if (hooks?.onRequest) {
    hooks.onRequest({
      method,
      url,
      headers: sanitizeHeaders(opts.headers),
      timeout: opts.timeout,
    })
  }

  try {
    const response = await httpRequest(url, {
      method,
      headers: opts.headers as Record<string, string>,
      timeout: opts.timeout,
      maxResponseSize: MAX_RESPONSE_SIZE,
    })

    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: Date.now() - startTime,
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeHeaders(response.headers),
      })
    }

    return response
  } catch (error) {
    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: Date.now() - startTime,
        error: error as Error,
      })
    }

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

  if (hooks?.onRequest) {
    hooks.onRequest({
      method,
      url,
      headers: sanitizeHeaders(opts.headers),
      timeout: opts.timeout,
    })
  }

  try {
    const response = await httpRequest(url, {
      method,
      headers: opts.headers as Record<string, string>,
      timeout: opts.timeout,
      maxResponseSize: MAX_RESPONSE_SIZE,
    })
    stopTimer({ statusCode: response.status })

    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: Date.now() - startTime,
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeHeaders(response.headers),
      })
    }

    return response
  } catch (error) {
    stopTimer({ error: true })

    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: Date.now() - startTime,
        error: error as Error,
      })
    }

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

  if (hooks?.onRequest) {
    hooks.onRequest({
      method,
      url,
      headers: sanitizeHeaders(headers),
      timeout: opts.timeout,
    })
  }

  try {
    const response = await httpRequest(url, {
      method,
      body,
      headers,
      timeout: opts.timeout,
      maxResponseSize: MAX_RESPONSE_SIZE,
    })
    stopTimer({ statusCode: response.status })

    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: Date.now() - startTime,
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeHeaders(response.headers),
      })
    }

    return response
  } catch (error) {
    stopTimer({ error: true })

    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: Date.now() - startTime,
        error: error as Error,
      })
    }

    throw error
  }
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
      if (isError(e)) {
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
    const allowedActions = actions?.trim()
      ? new Set(actions.split(','))
      : undefined
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
      alerts: artifact.alerts?.reduce<
        Array<{
          action: string | undefined
          key: string
          severity: string | undefined
          type: string
        }>
      >((acc, alert: SocketArtifactAlert) => {
        if (alert.severity === 'low') {
          return acc
        }
        const action = resolvedPolicy.get(alert.type)
        if (allowedActions && action && !allowedActions.has(action)) {
          return acc
        }
        acc.push({
          action,
          key: alert.key,
          severity: alert.severity,
          type: alert.type,
        })
        return acc
      }, []),
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
