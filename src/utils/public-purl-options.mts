/**
 * @file Public PURL proxy option validation for JavaScript and TypeScript
 *   callers.
 */

import type { PublicOrgPurlQuery, PublicPurlQuery } from '../types/purl.mts'

export const PUBLIC_PURL_ACTIONS = new Set([
  'error',
  'ignore',
  'monitor',
  'warn',
])

export const PUBLIC_PURL_BOOLEAN_KEYS = new Set([
  'alerts',
  'cachedResultsOnly',
  'compact',
  'fixable',
  'licenseattrib',
  'licensedetails',
  'purlErrors',
])

export function assertPublicPurlOrganization(
  orgSlug: string,
  options: { authenticated: boolean },
): void {
  const opts = { __proto__: null, ...options } as typeof options
  if (!opts.authenticated) {
    throw new TypeError(
      'Missing apiToken in organization PURL request: anonymous credentials cannot select an organization; provide an explicit apiToken',
    )
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-_.]{0,99}$/.test(orgSlug)) {
    throw new TypeError(
      'Invalid orgSlug in public PURL request: expected an organization slug; use letters, digits, hyphens, underscores, or dots',
    )
  }
}

export function assertPublicPurlQueryValue(
  key: string,
  value: unknown,
  options: { allowLabels?: boolean | undefined },
): void {
  const opts = { __proto__: null, ...options } as typeof options
  if (PUBLIC_PURL_BOOLEAN_KEYS.has(key) && typeof value === 'boolean') {
    return
  }
  if (
    key === 'actions' &&
    typeof value === 'string' &&
    value.split(',').every(action => PUBLIC_PURL_ACTIONS.has(action))
  ) {
    return
  }
  if (
    key === 'labels' &&
    opts.allowLabels &&
    typeof value === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9-_.]{0,99}$/.test(value)
  ) {
    return
  }
  throw new TypeError(
    `Invalid ${key} in public PURL query: unsupported key or value; use the public proxy query options`,
  )
}

export function validatePublicPurlQuery(
  query: PublicPurlQuery | PublicOrgPurlQuery | undefined,
  options: { allowLabels?: boolean | undefined } = {},
): PublicPurlQuery | PublicOrgPurlQuery | undefined {
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      assertPublicPurlQueryValue(key, value, options)
    }
  }
  return query
}
