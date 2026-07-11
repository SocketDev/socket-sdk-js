/**
 * @file Shared fixtures for the transparent v1 content-addressed blob-cache
 *   path inside `SocketSdk#createFullScan` (`#tryCreateFullScanViaManifest`).
 *   Split across sibling test files by domain (happy path, fallback
 *   reasons, v1-body param normalization) — this module is the one place
 *   the org slug and the two response-body builders live, so the fixtures
 *   can't drift between them.
 */

export const ORG_SLUG = 'test-org'
export const FILE_CONTENT = '{"name":"pkg","version":"1.0.0"}'

export type JsonRecord = Record<string, unknown>

/**
 * Minimal but complete v1 201 (`FullScanV1CreatedData`) response body — every
 * field is required by the type, so every 201 fixture needs the full set.
 */
export function buildV1CreatedBody(
  overrides?: JsonRecord | undefined,
): JsonRecord {
  return {
    branch: 'main',
    commit_hash: 'abc123',
    commit_message: 'test',
    committers: [],
    created_at: '2026-01-01T00:00:00Z',
    html_report_url: 'https://socket.dev/report/scan-v1',
    id: 'scan-v1',
    organization_id: 'org-1',
    pull_request: 0,
    repository_id: 'repo-1',
    scan_type: 'full',
    unsupported_files: [],
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Minimal v0 create-response body (create-shared.ts field set); only the
 * fields these tests assert on need real values.
 */
export function buildV0Body(overrides?: JsonRecord | undefined): JsonRecord {
  return {
    api_url: 'https://api.socket.dev/v0/scans/scan-v0',
    created_at: '2026-01-01T00:00:00Z',
    html_report_url: 'https://socket.dev/report/scan-v0',
    id: 'scan-v0',
    integration_repo_url: 'https://github.com/org/repo',
    integration_type: 'api',
    organization_id: 'org-1',
    organization_slug: ORG_SLUG,
    repo: 'test-repo',
    repository_id: 'repo-1',
    repository_slug: 'test-repo',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}
