/**
 * @file Option and response type aliases for the newer Socket API endpoint
 *   methods (historical/analytics, full-scan CSV/PDF exports, repo-label
 *   settings, and license-policy). Each alias is derived from the generated
 *   OpenAPI operation types (`../types/api`) so the SDK method signatures stay
 *   in lockstep with the spec instead of hand-listing the (large) historical
 *   filter query sets. Split out of `types.mts` to keep that file under the
 *   file-size cap.
 */
/* c8 ignore start - Type definitions only, no runtime code to test. */

import type { operations } from '../types/api'

export type HistoricalAlertsListOptions = NonNullable<
  operations['historicalAlertsList']['parameters']['query']
>

export type HistoricalAlertsTrendOptions = NonNullable<
  operations['historicalAlertsTrend']['parameters']['query']
>

export type HistoricalDependenciesTrendOptions = NonNullable<
  operations['historicalDependenciesTrend']['parameters']['query']
>

export type HistoricalSnapshotsListOptions = NonNullable<
  operations['historicalSnapshotsList']['parameters']['query']
>

// Full-scan CSV/PDF exports take both query params and an optional filters
// body; the SDK method flattens them into a single options object and splits
// them back out when building the request.
export type GetOrgFullScanCsvOptions = NonNullable<
  operations['getOrgFullScanCsv']['parameters']['query']
> &
  NonNullable<
    NonNullable<operations['getOrgFullScanCsv']['requestBody']>['content']
  >['application/json']

export type GetOrgFullScanPdfOptions = NonNullable<
  operations['getOrgFullScanPdf']['parameters']['query']
> &
  NonNullable<
    NonNullable<operations['getOrgFullScanPdf']['requestBody']>['content']
  >['application/json']

// Repo-HEAD diff scan: the query params drive the new full-scan's metadata;
// pathsRelativeTo mirrors createFullScan and controls how the uploaded
// manifest file paths are resolved (it is not sent to the API).
export type CreateOrgRepoDiffOptions = NonNullable<
  operations['createOrgRepoDiff']['parameters']['query']
> & {
  pathsRelativeTo?: string | undefined
}

// The label-setting update body is a structured issue-rules object; reference
// the generated request body so the shape tracks the spec.
export type UpdateOrgRepoLabelSettingBody = NonNullable<
  NonNullable<operations['updateOrgRepoLabelSetting']['requestBody']>['content']
>['application/json']

// License-policy (beta) returns newline-delimited JSON violations; the SDK
// parses the stream into this array shape.
export type LicensePolicyViolations = NonNullable<
  NonNullable<operations['licensePolicy']['responses']['200']['content']>
>['application/x-ndjson']
/* c8 ignore stop */
