import { debugLog } from '@socketsecurity/lib/debug/output'
import { isError } from '@socketsecurity/lib/errors/predicates'
import { httpRequest } from '@socketsecurity/lib/http-request'
import { parseJson } from '@socketsecurity/lib/json/parse'
import { perfTimer } from '@socketsecurity/lib/perf/timer'
import { DateNow } from '@socketsecurity/lib/primordials/date'
import { SetCtor } from '@socketsecurity/lib/primordials/map-set'
import { StringPrototypeTrim } from '@socketsecurity/lib/primordials/string'

import {
  MAX_RESPONSE_SIZE,
  publicPolicy as defaultPublicPolicy,
} from './constants.mts'
import { sanitizeHeaders } from './utils/header-sanitization.mts'

import type {
  RequestOptions,
  RequestOptionsWithHooks,
  SendMethod,
  SocketArtifactAlert,
  SocketArtifactWithExtras,
} from './types.mts'
import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'
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
  const startTime = DateNow()
  const url = `${baseUrl}${urlPath}`
  const method = 'DELETE'
  const { hooks, ...rawOpts } = {
    __proto__: null,
    ...options,
  } as unknown as RequestOptionsWithHooks
  const opts = { __proto__: null, ...rawOpts } as unknown as RequestOptions

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
        duration: DateNow() - startTime,
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeHeaders(response.headers),
      })
    }

    return response
  } catch (e) {
    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: DateNow() - startTime,
        error: e as Error,
      })
    }

    throw e
  }
}

/**
 * GET options. `stream` resolves as soon as the response headers arrive and
 * leaves the body unread on `rawResponse`, so a caller can consume records as
 * they land instead of holding the whole body in memory. `maxResponseSize`
 * cannot be enforced without reading the body, so it is skipped in stream mode
 * and the caller owns the read budget.
 */
export type GetRequestOptions = RequestOptionsWithHooks & {
  stream?: boolean | undefined
}

export async function createGetRequest(
  baseUrl: string,
  urlPath: string,
  options?: GetRequestOptions | undefined,
): Promise<HttpResponse> {
  const startTime = DateNow()
  const url = `${baseUrl}${urlPath}`
  const method = 'GET'
  const stopTimer = perfTimer('http:get', { urlPath })
  const { hooks, stream, ...rawOpts } = {
    __proto__: null,
    ...options,
  } as unknown as GetRequestOptions
  const opts = { __proto__: null, ...rawOpts } as unknown as RequestOptions

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
      ...(stream ? { stream: true } : { maxResponseSize: MAX_RESPONSE_SIZE }),
    })
    stopTimer({ statusCode: response.status })

    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: DateNow() - startTime,
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeHeaders(response.headers),
      })
    }

    return response
  } catch (e) {
    stopTimer({ error: true })

    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: DateNow() - startTime,
        error: e as Error,
      })
    }

    throw e
  }
}

export async function createRequestWithJson(
  method: SendMethod,
  baseUrl: string,
  urlPath: string,
  json: unknown,
  options?: RequestOptionsWithHooks | undefined,
): Promise<HttpResponse> {
  const startTime = DateNow()
  const url = `${baseUrl}${urlPath}`
  const stopTimer = perfTimer(`http:${method.toLowerCase()}`, {
    urlPath,
  })
  const { hooks, ...rawOpts } = {
    __proto__: null,
    ...options,
  } as unknown as RequestOptionsWithHooks
  const opts = { __proto__: null, ...rawOpts } as unknown as RequestOptions
  const body = JSON.stringify(json)
  const headers = {
    // opts.headers is the SDK's HeadersRecord (a plain object); the
    // readonly string[] arm the analyzer sees comes from node's
    // RequestOptions union and is never constructed here.
    // oxlint-disable-next-line typescript/no-misused-spread -- plain object
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
        duration: DateNow() - startTime,
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeHeaders(response.headers),
      })
    }

    return response
  } catch (e) {
    stopTimer({ error: true })

    if (hooks?.onResponse) {
      hooks.onResponse({
        method,
        url,
        duration: DateNow() - startTime,
        error: e as Error,
      })
    }

    throw e
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
      const responseJson = parseJson(responseBody)
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
  } catch (e) {
    stopTimer({ error: true })
    throw e
  }
}

export function isResponseOk(response: HttpResponse): boolean {
  return response.ok
}

export interface ReshapeArtifactOptions {
  actions?: string | undefined
  isAuthenticated: boolean
  policy?: Map<string, string> | undefined
}

// Non-sensitive deep-link routing hints public consumers (e.g. the web
// extension popover's packageLink builder) read off a batch artifact to
// construct correct socket.dev URLs for non-npm ecosystems (Maven
// classifier/ext, PyPI artifactId, RubyGems platform, Go path). They are not
// part of the generated OpenAPI SocketArtifact schema, so they are typed
// locally (all optional) and the public reshape copies each one explicitly,
// only when present, instead of dropping them.
export interface ArtifactDeepLinkQualifiers {
  artifactId?: string | undefined
  classifier?: string | undefined
  ext?: string | undefined
  params?: Record<string, string> | undefined
  path?: string | undefined
  platform?: string | undefined
  section?: string | undefined
}

export function pickPresentDeepLinkFields(
  artifact: SocketArtifactWithExtras & ArtifactDeepLinkQualifiers,
): ArtifactDeepLinkQualifiers {
  return {
    ...(artifact.artifactId !== undefined
      ? { artifactId: artifact.artifactId }
      : {}),
    ...(artifact.classifier !== undefined
      ? { classifier: artifact.classifier }
      : {}),
    ...(artifact.ext !== undefined ? { ext: artifact.ext } : {}),
    ...(artifact.params !== undefined ? { params: artifact.params } : {}),
    ...(artifact.path !== undefined ? { path: artifact.path } : {}),
    ...(artifact.platform !== undefined ? { platform: artifact.platform } : {}),
    ...(artifact.section !== undefined ? { section: artifact.section } : {}),
  }
}

export function reshapeArtifactForPublicPolicy<
  T extends Record<string, unknown>,
>(data: T, options: ReshapeArtifactOptions): T {
  const { actions, isAuthenticated, policy } = {
    __proto__: null,
    ...options,
  } as typeof options
  if (!isAuthenticated) {
    const allowedActions =
      actions !== undefined && StringPrototypeTrim(actions)
        ? new SetCtor(actions.split(','))
        : undefined
    const resolvedPolicy = policy ?? defaultPublicPolicy

    const reshapeArtifact = (artifact: SocketArtifactWithExtras) => ({
      // Deep-link qualifier fields (artifactId, classifier, ext, params, path,
      // platform, section) are non-sensitive routing hints public consumers use
      // to build correct socket.dev links for non-npm ecosystems. Copy only the
      // ones actually present so the reshaped shape stays minimal.
      ...pickPresentDeepLinkFields(artifact),
      // Preserve the caller's echoed-back request PURL. It is the
      // request->response correlation key batch consumers use to map replies
      // back to the purl they asked for, and it is not sensitive (the caller
      // supplied it), so it must survive the public reshape.
      inputPurl: artifact.inputPurl,
      // namespace + score are non-sensitive package identity/health fields
      // the public consumer (webext popover) needs to render: `namespace`
      // completes the coordinate for scoped/grouped packages (npm @scope,
      // Maven groupId) and `score` drives the score bar. The public policy
      // (alert low-severity + action filtering below) is unaffected — these
      // are per-object fields, not the alert set.
      namespace: artifact.namespace,
      name: artifact.name,
      version: artifact.version,
      size: artifact.size,
      author: artifact.author,
      type: artifact.type,
      score: artifact.score,
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
