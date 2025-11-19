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
 * @returns Sanitized headers with sensitive values redacted
 */
export function sanitizeHeaders(
  headers: Record<string, unknown> | readonly string[] | undefined,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined
  }

  // Handle readonly string[] case - this shouldn't normally happen for headers.
  if (Array.isArray(headers)) {
    return { headers: headers.join(', ') }
  }

  const sanitized: Record<string, string> = {}

  // Plain object iteration works for both HeadersRecord and IncomingHttpHeaders.
  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase()
    if (SENSITIVE_HEADERS.includes(keyLower)) {
      sanitized[key] = '[REDACTED]'
    } else {
      // Handle both string and string[] values.
      sanitized[key] = Array.isArray(value) ? value.join(', ') : String(value)
    }
  }

  return sanitized
}
