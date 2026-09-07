/**
 * @file Vitiate coverage-guided fuzz target (Tier 2) for
 *   src/utils/header-sanitization — the untrusted-HTTP-header boundary
 *   (response headers get sanitized before they reach logs). Complements the
 *   fast-check property test in header-sanitization.fuzz.test.mts: fast-check
 *   checks the redaction contract on constructed header records; vitiate feeds
 *   SWC-coverage-guided mutated BYTES (parsed into an arbitrary header record)
 *   to drive the key/value iteration + stringification into deep paths. Two
 *   contracts, read from src: sanitizeHeaders never throws, and a sensitive
 *   header's value is ALWAYS redacted (never leaked into the returned object).
 *   Run via `pnpm run test:fuzz`.
 */

import { fuzz } from '@vitiate/core'

import { sanitizeHeaders } from '../../../src/utils/header-sanitization.mjs'

// The sensitive-header list is the test's OWN spec (not imported from src) so
// the oracle is independent of the SUT.
const SENSITIVE = [
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'www-authenticate',
  'proxy-authenticate',
]

// Parse arbitrary bytes into a header record: each `name:value` line becomes an
// entry (arbitrary names, values, casing, unicode, control chars).
function headersFromBytes(data: Buffer): Record<string, string> {
  const out: Record<string, string> = { __proto__: null } as Record<
    string,
    string
  >
  const lines = data.toString('utf8').split('\n')
  for (let i = 0, { length } = lines; i < length; i += 1) {
    const line = lines[i]!
    const idx = line.indexOf(':')
    if (idx > 0) {
      out[line.slice(0, idx)] = line.slice(idx + 1)
    }
  }
  return out
}

fuzz(
  'sanitizeHeaders never throws + always redacts a sensitive header',
  data => {
    const headers = headersFromBytes(data)
    // Guarantee a sensitive entry carrying the fuzz bytes as its secret value.
    headers['Authorization'] = `Bearer ${data.toString('utf8').slice(0, 64)}`
    const result = sanitizeHeaders(headers)
    if (!result) {
      return
    }
    for (const key of Object.keys(result)) {
      if (
        SENSITIVE.includes(key.toLowerCase()) &&
        result[key] !== '[REDACTED]'
      ) {
        throw new Error(
          `sensitive header "${key}" leaked instead of [REDACTED]`,
        )
      }
    }
  },
)
