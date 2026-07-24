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
/* c8 ignore stop */
