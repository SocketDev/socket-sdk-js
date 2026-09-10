/**
 * @file Error result conversion for Socket API clients.
 */
import {
  SOCKET_API_TOKENS_URL,
  SOCKET_CONTACT_URL,
  SOCKET_DASHBOARD_URL,
} from './constants.mts'
import { ResponseError } from './http-client.mts'
import { filterRedundantCause } from './utils.mts'

import type { SocketSdkErrorResult } from './types/core.mts'

export const SDK_ERROR_GUIDANCE: Readonly<Record<number, readonly string[]>> = {
  400: [
    '→ Bad request. Invalid parameters or request body.',
    '→ Check: All required parameters are provided and correctly formatted.',
    '→ Verify: Package URLs (PURLs) follow correct format.',
  ],
  401: [
    '→ Authentication failed. API token is invalid or expired.',
    '→ Check: Your API token is correct and active.',
    `→ Generate a new token at: ${SOCKET_API_TOKENS_URL}`,
  ],
  403: [
    '→ Authorization failed. Insufficient permissions.',
    '→ Check: Your API token has required permissions for this operation.',
    '→ Check: You have access to the specified organization/repository.',
    `→ Verify: Organization settings at ${SOCKET_DASHBOARD_URL}`,
  ],
  404: [
    '→ Resource not found.',
    '→ Verify: Package name, version, or resource ID is correct.',
    '→ Check: Organization or repository exists and is accessible.',
  ],
  413: [
    '→ Payload too large. Request exceeds size limits.',
    '→ Try: Reduce the number of files or packages in a single request.',
    '→ Try: Use batch operations with smaller chunks.',
  ],
}

export function getSdkErrorBody(text: string): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return text
  }
  if (!parsed || typeof parsed !== 'object') {
    return undefined
  }
  const payload = parsed as Record<string, unknown>
  if (typeof payload['message'] === 'string') {
    return payload['message']
  }
  const nested = payload['error']
  if (typeof nested === 'string') {
    return nested
  }
  if (!nested || typeof nested !== 'object') {
    return undefined
  }
  const details = nested as Record<string, unknown>
  if (typeof details['message'] !== 'string') {
    return undefined
  }
  if (!details['details']) {
    return details['message']
  }
  const extra =
    typeof details['details'] === 'string'
      ? details['details']
      : JSON.stringify(details['details'])
  return `${details['message']} - Details: ${extra}`
}

export function getSdkErrorGuidance(error: ResponseError): string | undefined {
  if (error.response.status !== 429) {
    return SDK_ERROR_GUIDANCE[error.response.status]?.join('\n')
  }
  const retryAfter = error.response.headers['retry-after']
  return [
    '→ Rate limit exceeded. Too many requests.',
    retryAfter
      ? `→ Retry after ${retryAfter} seconds.`
      : '→ Wait before retrying.',
    '→ Try: Implement exponential backoff or enable SDK retry option.',
    `→ Contact support to increase rate limits: ${SOCKET_CONTACT_URL}`,
  ].join('\n')
}

export async function handleSdkApiError(
  error: unknown,
): Promise<SocketSdkErrorResult<never>> {
  if (error instanceof SyntaxError) {
    return { success: false, error: error.message, status: 200 }
  }
  if (!(error instanceof ResponseError)) {
    throw new Error('Unexpected Socket API error', { cause: error })
  }
  const { status, statusText } = error.response
  if (status >= 500) {
    throw new Error(`Socket API server error (${status})`, { cause: error })
  }
  const body = getSdkErrorBody(error.response.text())?.trim()
  let message = error.message
  if (body && !message.includes(body)) {
    message =
      statusText && message.includes(statusText)
        ? message.replace(statusText, () => body)
        : `${message}: ${body}`
  }
  const guidance = getSdkErrorGuidance(error)
  const cause = guidance
    ? [body, '', guidance].filter(Boolean).join('\n')
    : body
  return {
    cause: filterRedundantCause(message, cause),
    error: message,
    status,
    success: false,
    url: error.url,
  }
}
