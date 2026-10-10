/**
 * @file Shared request context for Socket API domain clients.
 */
import { getSdkAuthorization } from './auth.mts'
import { handleSdkApiError } from './api-errors.mts'
import { executeSdkWithRetry } from './api-retry.mts'
import {
  DEFAULT_HTTP_TIMEOUT,
  DEFAULT_USER_AGENT,
  MAX_HTTP_TIMEOUT,
  MIN_HTTP_TIMEOUT,
} from './constants.mts'
import {
  createDeleteRequest,
  createGetRequest,
  createRequestWithJson,
  getResponseJson,
  isResponseOk,
  ResponseError,
} from './http-client.mts'
import { normalizeBaseUrl } from './utils.mts'
import { bufferStreamedErrorResponse } from './utils/response-stream.mts'

import type {
  QueryParams,
  RequestOptionsWithHooks,
  SocketSdkGenericResult,
  SocketSdkOptions,
} from './types/core.mts'
import type { StrictErrorResult } from './types/strict.mts'
import type { SocketSdkHttpResponse as HttpResponse } from './types/http.mts'

export function createSdkApiContext(
  options: SdkApiClientOptions,
): SdkApiContext {
  const opts = { __proto__: null, ...options } as typeof options
  const timeout = opts.timeout ?? DEFAULT_HTTP_TIMEOUT
  if (
    !Number.isFinite(timeout) ||
    timeout < MIN_HTTP_TIMEOUT ||
    timeout > MAX_HTTP_TIMEOUT
  ) {
    throw new TypeError(
      `Invalid "timeout": use ${MIN_HTTP_TIMEOUT}–${MAX_HTTP_TIMEOUT} milliseconds`,
    )
  }
  const headers: Record<string, string> = {
    'User-Agent': opts.userAgent
      ? `${DEFAULT_USER_AGENT} ${opts.userAgent}`
      : DEFAULT_USER_AGENT,
  }
  if (opts.apiToken !== undefined) {
    headers['Authorization'] = getSdkAuthorization(
      opts.apiToken,
      opts.authScheme,
    )
  }
  return {
    baseUrl: normalizeBaseUrl(opts.baseUrl),
    requestOptions: {
      headers,
      authProvider: opts.authProvider,
      timeout,
      signal: opts.signal,
      hooks: opts.hooks,
    },
    executeWithRetry<T>(
      operation: () => Promise<T>,
      signal?: AbortSignal | undefined,
    ) {
      return executeSdkWithRetry(operation, {
        ...options,
        signal: signal ?? opts.signal,
      })
    },
    handleApiError: handleSdkApiError,
  }
}

export interface SdkApiContext {
  baseUrl: string
  requestOptions: RequestOptionsWithHooks
  executeWithRetry<T>(
    operation: () => Promise<T>,
    signal?: AbortSignal | undefined,
  ): Promise<T>
  handleApiError(error: unknown): Promise<StrictErrorResult>
}

export interface SdkApiRequest {
  path: string
  baseUrl?: string | undefined
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | undefined
  body?: unknown | undefined
  query?: QueryParams | undefined
  stream?: boolean | undefined
  maxResponseSize?: number | undefined
}

export type SdkApiClientOptions = Pick<
  SocketSdkOptions,
  | 'authProvider'
  | 'authScheme'
  | 'hooks'
  | 'retries'
  | 'retryDelay'
  | 'signal'
  | 'timeout'
  | 'userAgent'
> & { baseUrl: string; apiToken?: string | undefined }

export function getSdkRequestPath(request: SdkApiRequest): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value === undefined || value === null) {
      continue
    }
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      throw new TypeError(
        `Invalid query parameter "${key}": use a string, number, or boolean`,
      )
    }
    query.set(key, String(value))
  }
  const path = request.path.replace(/^\/+/, '')
  return query.size ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path
}

export async function requestSdkApi(
  context: SdkApiContext,
  request: SdkApiRequest,
): Promise<HttpResponse> {
  return await context.executeWithRetry(
    () => sendSdkApiRequest(context, request),
    context.requestOptions.signal,
  )
}

export async function requestSdkBytes(
  context: SdkApiContext,
  request: SdkApiRequest,
): Promise<SocketSdkGenericResult<Uint8Array>> {
  try {
    const response = await requestSdkApi(context, request)
    return {
      data: new Uint8Array(response.arrayBuffer()),
      status: response.status,
      success: true,
    }
  } catch (error) {
    return await context.handleApiError(error)
  }
}

export async function requestSdkJson<T>(
  context: SdkApiContext,
  request: SdkApiRequest,
): Promise<SocketSdkGenericResult<T>> {
  try {
    const response = await requestSdkApi(context, request)
    const data = await getResponseJson(response)
    return { data: data as T, status: response.status, success: true }
  } catch (error) {
    return await context.handleApiError(error)
  }
}

export async function sendSdkApiRequest(
  context: SdkApiContext,
  request: SdkApiRequest,
): Promise<HttpResponse> {
  const baseUrl = normalizeBaseUrl(request.baseUrl ?? context.baseUrl)
  const path = getSdkRequestPath(request)
  const options = {
    ...context.requestOptions,
    stream: request.stream,
    maxResponseSize: request.maxResponseSize,
  }
  options.signal?.throwIfAborted()
  const method = request.method ?? 'GET'
  let response: HttpResponse
  if (method === 'GET') {
    response = await createGetRequest(baseUrl, path, options)
  } else if (method === 'DELETE') {
    response = await createDeleteRequest(baseUrl, path, options)
  } else {
    response = await createRequestWithJson(
      method,
      baseUrl,
      path,
      request.body,
      options,
    )
  }
  if (!isResponseOk(response)) {
    if (request.stream) {
      response = await bufferStreamedErrorResponse(response)
    }
    throw new ResponseError(response, method, `${baseUrl}${path}`)
  }
  return response
}
