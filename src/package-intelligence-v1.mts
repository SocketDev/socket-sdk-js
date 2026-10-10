/**
 * @file Organization package checks and summaries from the v1 API.
 */
import { isPlainObject } from '@socketsecurity/lib-stable/objects/predicates'

import { requestSdkJson } from './api-client.mts'
import { deriveApiV1BaseUrl } from './full-scans-v1.mts'
import { createOrgApiPath } from './org-api.mts'

import type { SdkApiContext } from './api-client.mts'
import type { OpReturnType } from '../types/api-helpers.d.ts'
import type { paths } from '../types/api-v1.d.ts'
import type { SocketSdkGenericResult } from './types/core.mts'

export type PackageChecksOperation =
  paths['/v1/orgs/{org_slug}/packages/checks']['post']
export type PackageSummariesOperation =
  paths['/v1/orgs/{org_slug}/packages/summaries']['post']

export type PostOrgPackageChecksBody =
  PackageChecksOperation['requestBody']['content']['application/json']
export type PostOrgPackageChecksData = OpReturnType<PackageChecksOperation>
export type PostOrgPackageChecksResult =
  SocketSdkGenericResult<PostOrgPackageChecksData>
export type PostOrgPackageSummariesBody =
  PackageSummariesOperation['requestBody']['content']['application/json']
export type PostOrgPackageSummariesData =
  OpReturnType<PackageSummariesOperation>
export type PostOrgPackageSummariesResult =
  SocketSdkGenericResult<PostOrgPackageSummariesData>

const MAX_PACKAGES = 100
const MAX_PURL_CODE_POINTS = 2048
const MAX_REQUEST_BODY_BYTES = 256 * 1024

export function hasExactlyKeys(
  value: object,
  expected: readonly string[],
): boolean {
  const keys = Reflect.ownKeys(value)
  return (
    keys.length === expected.length &&
    keys.every(key => typeof key === 'string' && expected.includes(key))
  )
}

export function postOrgPackageChecks(
  context: SdkApiContext,
  orgSlug: string,
  body: PostOrgPackageChecksBody,
  baseUrl = requireApiV1BaseUrl(context),
): Promise<PostOrgPackageChecksResult> {
  validatePackageIntelligenceRequest(orgSlug, body)
  return requestSdkJson<PostOrgPackageChecksData>(context, {
    baseUrl,
    method: 'POST',
    path: createOrgApiPath(orgSlug, 'packages', 'checks'),
    body,
  })
}

export function postOrgPackageSummaries(
  context: SdkApiContext,
  orgSlug: string,
  body: PostOrgPackageSummariesBody,
  baseUrl = requireApiV1BaseUrl(context),
): Promise<PostOrgPackageSummariesResult> {
  validatePackageIntelligenceRequest(orgSlug, body)
  return requestSdkJson<PostOrgPackageSummariesData>(context, {
    baseUrl,
    method: 'POST',
    path: createOrgApiPath(orgSlug, 'packages', 'summaries'),
    body,
  })
}

export function requireApiV1BaseUrl(context: SdkApiContext): string {
  const baseUrl = deriveApiV1BaseUrl(context.baseUrl)
  if (baseUrl === undefined) {
    throw new TypeError(
      'Missing v1 API URL for package intelligence. Supply an apiV1BaseUrl for the custom API base.',
    )
  }
  return baseUrl
}

export function validatePackageIntelligenceEntries(packages: unknown): void {
  if (
    !Array.isArray(packages) ||
    packages.length < 1 ||
    packages.length > MAX_PACKAGES
  ) {
    throw new TypeError(
      `Package intelligence requests must contain 1–${MAX_PACKAGES} packages.`,
    )
  }
  for (let index = 0; index < packages.length; index += 1) {
    validatePackageIntelligenceEntry(packages[index], index)
  }
}

export function validatePackageIntelligenceEntry(
  packageEntry: unknown,
  index: number,
): void {
  if (
    !isPlainObject(packageEntry) ||
    !hasExactlyKeys(packageEntry, ['purl']) ||
    typeof packageEntry['purl'] !== 'string'
  ) {
    throw new TypeError(
      `Package intelligence item ${index} must contain only a string purl.`,
    )
  }
  const purlLength = Array.from(packageEntry['purl']).length
  if (purlLength < 1 || purlLength > MAX_PURL_CODE_POINTS) {
    throw new TypeError(
      `Package intelligence item ${index} purl must contain 1–${MAX_PURL_CODE_POINTS} Unicode characters.`,
    )
  }
}

export function validatePackageIntelligenceRequest(
  orgSlug: string,
  body: unknown,
): void {
  if (typeof orgSlug !== 'string' || orgSlug.trim().length === 0) {
    throw new TypeError('Organization slug must be a nonempty string.')
  }
  if (!isPlainObject(body) || !hasExactlyKeys(body, ['packages'])) {
    throw new TypeError('Package intelligence body must contain only packages.')
  }
  validatePackageIntelligenceEntries(body['packages'])
  validatePackageIntelligenceRequestSize(body)
}

export function validatePackageIntelligenceRequestSize(body: unknown): void {
  const serializedBody = JSON.stringify(body)
  if (serializedBody === undefined) {
    throw new TypeError(
      'Package intelligence request body is not serializable.',
    )
  }
  const bodyBytes = new TextEncoder().encode(serializedBody).byteLength
  if (bodyBytes > MAX_REQUEST_BODY_BYTES) {
    throw new TypeError(
      `Package intelligence request body exceeds ${MAX_REQUEST_BODY_BYTES} UTF-8 bytes.`,
    )
  }
}
