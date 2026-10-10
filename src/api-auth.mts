/**
 * @file Socket API authentication resolved for each request.
 */
import type { HeadersRecord, RequestOptionsWithHooks } from './types/core.mts'

export class SdkAuthenticationError extends Error {
  constructor(cause: unknown) {
    super('Socket SDK authentication failed', { cause })
    this.name = 'SdkAuthenticationError'
  }
}

export function getSdkAuthorization(
  token: string,
  scheme: 'basic' | 'bearer' = 'basic',
): string {
  const trimmed = validateSdkApiToken(token)
  if (scheme === 'bearer') {
    return `Bearer ${trimmed}`
  }
  if (scheme === 'basic') {
    return `Basic ${btoa(`${trimmed}:`)}`
  }
  throw new TypeError('Invalid "authScheme": use basic or bearer')
}

export async function resolveSdkRequestHeaders(
  options: RequestOptionsWithHooks,
): Promise<HeadersRecord> {
  const opts = { __proto__: null, ...options }
  opts.signal?.throwIfAborted()
  if (!opts.authProvider) {
    return opts.headers
  }
  let authorization: string
  try {
    const credential = await opts.authProvider()
    if (
      credential.authScheme !== 'basic' &&
      credential.authScheme !== 'bearer'
    ) {
      throw new TypeError('Invalid credential authentication scheme')
    }
    authorization = getSdkAuthorization(credential.token, credential.authScheme)
  } catch (error) {
    throw new SdkAuthenticationError(error)
  }
  opts.signal?.throwIfAborted()
  const headers: Record<string, string | string[]> = {}
  for (const [name, value] of Object.entries(opts.headers ?? {})) {
    if (name.toLowerCase() !== 'authorization') {
      headers[name] = value
    }
  }
  headers['Authorization'] = authorization
  return headers
}

export function validateSdkApiToken(apiToken: string): string {
  const MAX_API_TOKEN_LENGTH = 1024
  if (typeof apiToken !== 'string') {
    throw new TypeError('"apiToken" is required and must be a string')
  }
  const trimmedToken = apiToken.trim()
  if (!trimmedToken) {
    throw new Error('"apiToken" cannot be empty or whitespace-only')
  }
  if (trimmedToken.length > MAX_API_TOKEN_LENGTH) {
    throw new Error(
      `"apiToken" exceeds maximum length of ${MAX_API_TOKEN_LENGTH} characters`,
    )
  }

  if (/[\r\n]/.test(trimmedToken)) {
    throw new TypeError('Invalid "apiToken": remove newline characters')
  }
  return trimmedToken
}
