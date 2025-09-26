import http from 'node:http'
import https from 'node:https'

import { debugLog } from '@socketsecurity/registry/lib/debug'
import { jsonParse } from '@socketsecurity/registry/lib/json'

import type { RequestOptions, SendMethod } from './types'
import type { ClientRequest, IncomingMessage } from 'node:http'

/**
 * HTTP response error for Socket API requests.
 * Extends Error with response details for debugging failed API calls.
 */
export class ResponseError extends Error {
  response: IncomingMessage

  /**
   * Create a new ResponseError from an HTTP response.
   * Automatically formats error message with status code and message.
   */
  constructor(response: IncomingMessage, message: string = '') {
    /* c8 ignore next 2 - statusCode and statusMessage may be undefined in edge cases */
    const statusCode = response.statusCode ?? 'unknown'
    const statusMessage = response.statusMessage ?? 'No status message'
    super(
      /* c8 ignore next - fallback empty message if not provided */
      `Socket API ${message || 'Request failed'} (${statusCode}): ${statusMessage}`,
    )
    this.name = 'ResponseError'
    this.response = response
    Error.captureStackTrace(this, ResponseError)
  }
}

/**
 * Create and execute an HTTP DELETE request.
 * Returns the response stream for further processing.
 *
 * @throws {Error} When network or timeout errors occur
 */
export async function createDeleteRequest(
  baseUrl: string,
  urlPath: string,
  options: RequestOptions,
): Promise<IncomingMessage> {
  const req = getHttpModule(baseUrl)
    .request(`${baseUrl}${urlPath}`, {
      method: 'DELETE',
      ...options,
    })
    .end()
  return await getResponse(req)
}

/**
 * Create and execute an HTTP GET request.
 * Returns the response stream for further processing.
 *
 * @throws {Error} When network or timeout errors occur
 */
export async function createGetRequest(
  baseUrl: string,
  urlPath: string,
  options: RequestOptions,
): Promise<IncomingMessage> {
  const req = getHttpModule(baseUrl)
    .request(`${baseUrl}${urlPath}`, {
      method: 'GET',
      ...options,
    })
    .end()
  return await getResponse(req)
}

/**
 * Create and execute an HTTP request with JSON payload.
 * Automatically sets appropriate content headers and serializes the body.
 *
 * @throws {Error} When network or timeout errors occur
 */
export async function createRequestWithJson(
  method: SendMethod,
  baseUrl: string,
  urlPath: string,
  json: unknown,
  options: RequestOptions,
): Promise<IncomingMessage> {
  const body = JSON.stringify(json)
  const req = getHttpModule(baseUrl).request(`${baseUrl}${urlPath}`, {
    method,
    ...options,
    headers: {
      ...(options as any)?.headers,
      'Content-Length': Buffer.byteLength(body, 'utf8'),
      'Content-Type': 'application/json',
    },
  })

  req.write(body)
  req.end()

  return await getResponse(req)
}

/**
 * Read the response body from an HTTP error response.
 * Accumulates all chunks into a complete string for error handling.
 *
 * @throws {Error} When stream errors occur during reading
 */
export async function getErrorResponseBody(
  response: IncomingMessage,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    let body = ''
    response.setEncoding('utf8')
    response.on('data', (chunk: string) => (body += chunk))
    response.on('end', () => resolve(body))
    /* c8 ignore next - Extremely rare network or stream error during error response reading. */
    response.on('error', e => reject(e))
  })
}

/**
 * Get the appropriate HTTP module based on URL protocol.
 * Returns http module for http: URLs, https module for https: URLs.
 */
export function getHttpModule(url: string): typeof http | typeof https {
  return url.startsWith('https:') ? https : http
}

/**
 * Wait for and return the HTTP response from a request.
 * Handles timeout and error conditions during request processing.
 *
 * @throws {Error} When request times out or network errors occur
 */
export async function getResponse(
  req: ClientRequest,
): Promise<IncomingMessage> {
  return await new Promise((resolve, reject) => {
    let timedOut = false
    req.on('response', (response: IncomingMessage) => {
      if (timedOut) {
        /* c8 ignore next - Race condition where response arrives after timeout. */
        return
      }
      resolve(response)
    })
    req.on('timeout', () => {
      timedOut = true
      req.destroy()
      reject(new Error('Request timed out'))
    })
    /* c8 ignore start - Network error handling during request. */
    req.on('error', e => {
      if (!timedOut) {
        reject(e)
      }
    })
    /* c8 ignore end */
  })
}

/**
 * Parse HTTP response body as JSON.
 * Validates response status and handles empty responses gracefully.
 *
 * @throws {ResponseError} When response has non-2xx status code
 * @throws {SyntaxError} When response body contains invalid JSON
 */
export async function getResponseJson(
  response: IncomingMessage,
  method?: string,
) {
  if (!isResponseOk(response)) {
    throw new ResponseError(
      response,
      method ? `${method} Request failed` : undefined,
    )
  }
  const responseBody = await getErrorResponseBody(response)

  // Handle truly empty responses (not whitespace) as valid empty objects.
  if (responseBody === '') {
    debugLog('API response: empty response treated as {}')
    return {}
  }

  try {
    const responseJson = jsonParse(responseBody)
    debugLog('API response:', responseJson)
    return responseJson
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Attach the original response text for better error reporting.
      const enhancedError = new Error(
        `Socket API - Invalid JSON response:\n${responseBody}\n→ ${e.message}`,
      ) as SyntaxError & {
        originalResponse?: string
      }
      enhancedError.name = 'SyntaxError'
      enhancedError.originalResponse = responseBody
      Object.setPrototypeOf(enhancedError, SyntaxError.prototype)
      throw enhancedError
    }
    if (e instanceof Error) {
      throw e
    }
    // Handle non-Error objects thrown by JSON parsing.
    const unknownError = new Error('Unknown error') as SyntaxError & {
      originalResponse?: string
    }
    unknownError.name = 'SyntaxError'
    unknownError.originalResponse = responseBody
    Object.setPrototypeOf(unknownError, SyntaxError.prototype)
    throw unknownError
  }
}

/**
 * Check if HTTP response has a successful status code (2xx range).
 * Returns true for status codes between 200-299, false otherwise.
 */
export function isResponseOk(response: IncomingMessage): boolean {
  const { statusCode } = response
  /* c8 ignore next - statusCode is always present in normal HTTP responses */
  return statusCode ? statusCode >= 200 && statusCode < 300 : false
}

/**
 * Transform artifact data based on authentication status.
 * Filters and compacts response data for public/free-tier users.
 */
export function reshapeArtifactForPublicPolicy<T extends Record<string, any>>(
  data: T,
  isAuthenticated: boolean,
  actions?: string,
): T {
  // If user is not authenticated, provide a different response structure
  // optimized for the public free-tier experience.
  if (!isAuthenticated) {
    // Parse actions parameter for alert filtering.
    const allowedActions = actions ? actions.split(',') : undefined

    const reshapeArtifact = (artifact: any) => ({
      name: artifact.name,
      version: artifact.version,
      size: artifact.size,
      author: artifact.author,
      type: artifact.type,
      supplyChainRisk: artifact.supplyChainRisk,
      scorecards: artifact.scorecards,
      topLevelAncestors: artifact.topLevelAncestors,
      // Compact the alerts array to reduce response size for non-authenticated
      // requests.
      alerts: artifact.alerts
        ?.filter((alert: any) => {
          // Filter by severity (remove low severity alerts).
          if (alert.severity === 'low') {
            return false
          }
          // Filter by actions if specified.
          if (allowedActions && !allowedActions.includes(alert.action)) {
            return false
          }
          return true
        })
        .map((alert: any) => ({
          type: alert.type,
          severity: alert.severity,
          key: alert.key,
        })),
    })

    // Handle both single artifacts and objects with artifacts arrays.
    if (data['artifacts']) {
      // Object with artifacts array.
      return {
        ...data,
        artifacts: data['artifacts']?.map(reshapeArtifact),
      }
    } else if (data['alerts']) {
      // Single artifact with alerts.
      return reshapeArtifact(data) as unknown as T
    }
  }
  return data
}
