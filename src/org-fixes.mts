/**
 * @file Synchronous and advanced asynchronous organization fix requests.
 */
import { requestSdkJson } from './api-client.mts'
import { createOrgApiPath } from './org-api.mts'

import type { SdkApiContext } from './api-client.mts'
import type {
  OrgFixComputationData,
  OrgFixesData,
  OrgFixesOptions,
  StartOrgFixComputationData,
} from './types/fixes.mts'

export function getOrgFixComputation(
  context: SdkApiContext,
  orgSlug: string,
  computationId: string,
) {
  return requestSdkJson<OrgFixComputationData>(context, {
    path: createOrgApiPath(orgSlug, 'fixes', 'computations', computationId),
  })
}

export function getOrgFixes(
  context: SdkApiContext,
  orgSlug: string,
  options: OrgFixesOptions,
) {
  validateOrgFixesOptions(options)
  return requestSdkJson<OrgFixesData>(context, {
    path: createOrgApiPath(orgSlug, 'fixes'),
    query: options,
  })
}

export function startOrgFixComputation(
  context: SdkApiContext,
  orgSlug: string,
  options: OrgFixesOptions,
) {
  validateOrgFixesOptions(options)
  return requestSdkJson<StartOrgFixComputationData>(context, {
    method: 'POST',
    path: createOrgApiPath(orgSlug, 'fixes', 'computations'),
    query: options,
  })
}

export function validateOrgFixesOptions(options: OrgFixesOptions): void {
  const opts = { __proto__: null, ...options } as unknown as OrgFixesOptions
  const targets = [opts.repo_slug, opts.full_scan_id, opts.tar_hash]
  const provided = targets.filter(value => value !== undefined)
  if (
    provided.length !== 1 ||
    typeof provided[0] !== 'string' ||
    !provided[0].trim()
  ) {
    throw new TypeError(
      'Invalid fixes target in request options: expected exactly one nonempty repo_slug, full_scan_id, or tar_hash. Supply one target.',
    )
  }
  if (!opts.vulnerability_ids?.trim()) {
    throw new TypeError(
      'Invalid vulnerability_ids in fixes request: expected a nonempty value. Supply a CVE, GHSA, or "*".',
    )
  }
}
