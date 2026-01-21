/**
 * @fileoverview Strict type definitions for Socket SDK v3.
 * These types provide better TypeScript DX by marking guaranteed fields as required
 * and only keeping truly optional fields as optional. This improves IntelliSense autocomplete.
 */
/* c8 ignore start - Type definitions only, no runtime code to test. */

/**
 * Strict type for full scan metadata item.
 * Represents a single full scan with guaranteed fields marked as required.
 */
export type FullScanItem = {
  // Guaranteed fields (always returned by API)
  id: string
  created_at: string
  updated_at: string
  organization_id: string
  organization_slug: string
  repository_id: string
  repository_slug: string
  repo: string
  html_report_url: string
  api_url: string
  integration_type: string
  integration_repo_url: string

  // Truly optional/nullable fields
  branch: string | null
  commit_message: string | null
  commit_hash: string | null
  pull_request: number | null
  committers: string[]
  html_url: string | null
  integration_branch_url: string | null
  integration_commit_url: string | null
  integration_pull_request_url: string | null
  scan_state: 'pending' | 'precrawl' | 'resolve' | 'scan' | null
  unmatchedFiles?: string[] | undefined
}

/**
 * Strict type for full scan list response.
 */
export type FullScanListData = {
  results: FullScanItem[]
  nextPageCursor: string | null
  nextPage: number | null
}

/**
 * Strict type for full scan list result.
 */
export type FullScanListResult = {
  cause?: undefined | undefined
  data: FullScanListData
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for single full scan result.
 */
export type FullScanResult = {
  cause?: undefined | undefined
  data: FullScanItem
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Options for listing full scans.
 */
export type ListFullScansOptions = {
  branch?: string | undefined
  commit_hash?: string | undefined
  direction?: 'asc' | 'desc' | undefined
  from?: string | undefined
  page?: number | undefined
  per_page?: number | undefined
  pull_request?: string | undefined
  repo?: string | undefined
  sort?: 'created_at' | 'name' | undefined
  startAfterCursor?: string | undefined
  use_cursor?: boolean | undefined
  workspace?: string | undefined
}

/**
 * Options for creating a full scan.
 */
export type CreateFullScanOptions = {
  branch?: string | undefined
  commit_hash?: string | undefined
  commit_message?: string | undefined
  committers?: string | undefined
  integration_org_slug?: string | undefined
  integration_type?:
    | 'api'
    | 'azure'
    | 'bitbucket'
    | 'github'
    | 'gitlab'
    | undefined
  make_default_branch?: boolean | undefined
  pathsRelativeTo?: string | undefined
  pull_request?: number | undefined
  repo: string
  scan_type?: string | undefined
  set_as_pending_head?: boolean | undefined
  tmp?: boolean | undefined
  workspace?: string | undefined
}

/**
 * Options for streaming a full scan.
 */
export type StreamFullScanOptions = {
  output?: boolean | string | undefined
}

/**
 * Error result type for all SDK operations.
 */
export type StrictErrorResult = {
  cause?: string | undefined
  data?: undefined | undefined
  error: string
  status: number
  success: false
}

/**
 * Generic strict result type combining success and error.
 */
export type StrictResult<T> =
  | {
      cause?: undefined | undefined
      data: T
      error?: undefined | undefined
      status: number
      success: true
    }
  | StrictErrorResult

/**
 * Strict type for organization item.
 */
export type OrganizationItem = {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
  plan: string
}

/**
 * Strict type for organizations list result.
 */
export type OrganizationsResult = {
  cause?: undefined | undefined
  data: {
    organizations: OrganizationItem[]
  }
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for repository item.
 */
export type RepositoryItem = {
  id: string
  created_at: string
  updated_at: string
  name: string
  organization_id: string
  organization_slug: string
  default_branch: string | null
  homepage: string | null
  archived: boolean
  visibility: 'public' | 'private' | 'internal'
}

/**
 * Strict type for repositories list data.
 */
export type RepositoriesListData = {
  results: RepositoryItem[]
  nextPageCursor: string | null
  nextPage: number | null
}

/**
 * Strict type for repositories list result.
 */
export type RepositoriesListResult = {
  cause?: undefined | undefined
  data: RepositoriesListData
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Options for getting a single repository.
 */
export type GetRepositoryOptions = {
  workspace?: string | undefined
}

/**
 * Options for listing repositories.
 */
export type ListRepositoriesOptions = {
  direction?: 'asc' | 'desc' | undefined
  page?: number | undefined
  per_page?: number | undefined
  sort?: 'created_at' | 'name' | undefined
  startAfterCursor?: string | undefined
  use_cursor?: boolean | undefined
}

/**
 * Strict type for delete operation result.
 */
export type DeleteResult = {
  cause?: undefined | undefined
  data: { success: boolean }
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for single repository result.
 */
export type RepositoryResult = {
  cause?: undefined | undefined
  data: RepositoryItem
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for repository label item.
 */
export type RepositoryLabelItem = {
  // Guaranteed fields (always returned by API)
  id: string
  name: string

  // Optional fields
  repository_ids?: string[] | undefined
  has_security_policy?: boolean | undefined
  has_license_policy?: boolean | undefined
}

/**
 * Strict type for repository labels list data.
 */
export type RepositoryLabelsListData = {
  results: RepositoryLabelItem[]
  nextPage: number | null
}

/**
 * Strict type for repository labels list result.
 */
export type RepositoryLabelsListResult = {
  cause?: undefined | undefined
  data: RepositoryLabelsListData
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for single repository label result.
 */
export type RepositoryLabelResult = {
  cause?: undefined | undefined
  data: RepositoryLabelItem
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for delete repository label result.
 */
export type DeleteRepositoryLabelResult = {
  cause?: undefined | undefined
  data: { status: string }
  error?: undefined | undefined
  status: number
  success: true
}

/* c8 ignore stop */
