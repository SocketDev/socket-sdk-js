/**
 * @file HTTP header sanitization utilities for secure logging. Provides
 *   functions to redact sensitive header values from logs.
 */

import {
  ArrayIsArray,
  ArrayPrototypeMap,
} from '@socketsecurity/lib/primordials/array'
import { StringPrototypeToLowerCase } from '@socketsecurity/lib/primordials/string'

/**
 * Coerce one header value to a string without ever throwing. `String(value)`
 * throws a TypeError on an object with a non-callable `toString` and no
 * `Symbol.toPrimitive`; sanitized headers feed diagnostics/logging, which is
 * never worth an exception.
 */
export function coerceHeaderValue(value: unknown): string {
  try {
    return String(value)
  } catch {
    return '[unstringifiable]'
  }
}

/**
 * List of sensitive HTTP headers that should be redacted in logs.
 */
export const SENSITIVE_HEADERS: readonly string[] = [
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'www-authenticate',
  'proxy-authenticate',
]

/**
 * Sanitize headers for logging by redacting sensitive values.
 *
 * @param headers - Headers to sanitize (object or array)
 *
 * @returns Sanitized headers with sensitive values redacted
 */
export function sanitizeHeaders(
  headers: Record<string, unknown> | readonly string[] | undefined,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined
  }

  // Handle readonly string[] case - this shouldn't normally happen for headers.
  if (ArrayIsArray(headers)) {
    return { headers: (headers as readonly string[]).join(', ') }
  }

  const sanitized: Record<string, string> = {}

  // Plain object iteration works for both HeadersRecord and IncomingHttpHeaders.
  const entries = Object.entries(headers)
  for (let i = 0, { length } = entries; i < length; i += 1) {
    const entry = entries[i]!
    const key = entry[0]
    const value = entry[1]
    const keyLower = StringPrototypeToLowerCase(key)
    if (SENSITIVE_HEADERS.includes(keyLower)) {
      sanitized[key] = '[REDACTED]'
    } else {
      // Handle both string and string[] values.
      sanitized[key] = ArrayIsArray(value)
        ? ArrayPrototypeMap(value, coerceHeaderValue).join(', ')
        : coerceHeaderValue(value)
    }
  }

  return sanitized
}
