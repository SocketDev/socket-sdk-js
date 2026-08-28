/**
 * @file Domain key aliases for the SDK's keyed response maps.
 *   A `Record<string, T>` admits any string, so a path-keyed map accepts a key
 *   that is not a path and a PURL-keyed map accepts one that is not a PURL.
 *   Naming the key says which domain it belongs to, and `prefer-refined-record`
 *   accepts a named key for exactly that reason.
 *   Each alias resolves to `string`, so it stays assignable in both directions
 *   and no caller of a published type has to change. The alias documents the
 *   domain; it does not enforce it. A true brand would enforce it and would
 *   break every existing caller, which is not a trade this surface should make.
 */
/* c8 ignore start - Type definitions only, no runtime code to test. */

/**
 * A package URL, as `pkg:npm/name@version`. Keys the per-package result maps
 * the patches endpoints return.
 */
export type Purl = string

/**
 * A path relative to the scanned project root, in POSIX form. Keys the file
 * maps in patch views and full-scan manifests.
 */
export type FilePath = string

/**
 * A vulnerability identifier, as `CVE-2024-1234` or `GHSA-xxxx-xxxx-xxxx`.
 * Keys the vulnerability maps hanging off a patch.
 */
export type VulnerabilityId = string

/**
 * An SDK method name, as `getOrgFullScanList`. Keys the quota requirement
 * table, which is generated from the API surface.
 */
export type ApiMethodName = string

/**
 * A quota cost bucket, as the stringified unit count a method consumes. Keys
 * the usage summary that groups methods by cost.
 */
export type QuotaCost = string

/**
 * An organization slug, as it appears in a dashboard URL. Keys the
 * organization map on the session response.
 */
export type OrganizationSlug = string
/* c8 ignore stop */
