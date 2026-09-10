/**
 * @file Parameter and response conversion for v1 manifest scans.
 */
import type { QueryParams } from './types/core.mts'
import type { FullScanResult } from './types/strict.mts'
import type {
  CreateFullScanFromManifestParams,
  FullScanV1CreatedData,
} from './full-scans-v1.mts'

export function createFullScanManifestParams(
  query: QueryParams,
): CreateFullScanFromManifestParams {
  return {
    branch: query['branch'] as string | undefined,
    commit_hash: query['commit_hash'] as string | undefined,
    commit_message: query['commit_message'] as string | undefined,
    committers: normalizeScanCommitters(query['committers']),
    ephemeral: query['tmp'] as boolean | undefined,
    make_default_branch: query['make_default_branch'] as boolean | undefined,
    pull_request: normalizeScanPullRequest(query['pull_request']),
    repo: query['repo'] as string,
    scan_type: query['scan_type'] as string | undefined,
    set_as_pending_head: query['set_as_pending_head'] as boolean | undefined,
    workspace: query['workspace'] as string | undefined,
  }
}

export function createFullScanV0Result(
  created: FullScanV1CreatedData,
  orgSlug: string,
  repo: string,
  workspace: string | undefined,
): FullScanResult {
  // Mirror the exact key set the deployed v0 create endpoint's
  // schema serializer emits (additionalProperties: false): fields
  // known from the v1 body, fields synthesized from this call's own
  // arguments, and schema defaults (null for nullable, '' for
  // non-nullable string) for everything else. See openapi.json's
  // `CreateOrgFullScan` 201 schema for the full 25-key set.
  // oxlint-disable-next-line socket/prefer-undefined-over-null -- external API requirement: mirrors the v0 wire contract's literal JSON `null` schema default for an unset nullable field, not an internal unset sentinel.
  const WIRE_NULL: null = null
  const v0Shaped = {
    api_url: WIRE_NULL,
    branch: created.branch,
    commit_hash: created.commit_hash,
    commit_message: created.commit_message,
    committers: created.committers,
    created_at: created.created_at,
    html_report_url: created.html_report_url,
    html_url: WIRE_NULL,
    id: created.id,
    integration_branch_url: WIRE_NULL,
    integration_commit_url: WIRE_NULL,
    integration_pull_request_url: WIRE_NULL,
    integration_repo_url: WIRE_NULL,
    integration_type: WIRE_NULL,
    organization_id: created.organization_id,
    organization_slug: orgSlug,
    pull_request: created.pull_request,
    repo,
    repository_id: created.repository_id,
    repository_slug: repo,
    scan_state: WIRE_NULL,
    scan_type: created.scan_type,
    unmatchedFiles: created.unsupported_files.map(f => f.path),
    updated_at: created.updated_at,
    workspace: workspace ?? '',
  }
  return {
    cause: undefined,
    data: v0Shaped,
    error: undefined,
    status: 200,
    success: true,
  }
}

export function normalizeScanCommitters(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined
  }
  const entries = Array.isArray(value) ? value : [value]
  return entries.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0,
  )
}

export function normalizeScanPullRequest(value: unknown): number | undefined {
  const candidate = typeof value === 'string' ? Number(value) : value
  return typeof candidate === 'number' &&
    Number.isSafeInteger(candidate) &&
    candidate >= 1
    ? candidate
    : undefined
}
