# Method Reference

## Scans

| Task | Method |
|------|--------|
| List scans | `listFullScans(orgSlug, options)` |
| Create scan | `createFullScan(orgSlug, files, options)` |
| Get scan | `getFullScan(orgSlug, scanId)` |
| Stream scan | `streamFullScan(orgSlug, scanId)` |
| Delete scan | `deleteFullScan(orgSlug, scanId)` |
| Get metadata | `getFullScanMetadata(orgSlug, scanId)` |

## Organizations & Repositories

| Task | Method |
|------|--------|
| List orgs | `listOrganizations()` |
| List repos | `listRepositories(orgSlug, options)` |
| Get repo | `getRepository(orgSlug, repoSlug)` |
| Create repo | `createRepository(orgSlug, data)` |
| Update repo | `updateRepository(orgSlug, repoSlug, data)` |
| Delete repo | `deleteRepository(orgSlug, repoSlug)` |

## Package Analysis

| Task | Method |
|------|--------|
| Batch analysis | `batchPackageFetch(options)` |
| Stream analysis | `batchPackageStream(options)` |
| Get issues | `getIssuesByNpmPackage(name, version)` |
| Get score | `getScoreByNpmPackage(name, version)` |

## Dependencies & SBOM

| Task | Method |
|------|--------|
| Create snapshot | `createDependenciesSnapshot(files, options)` |
| Upload manifests | `uploadManifestFiles(orgSlug, files, options)` |
| Export CycloneDX | `exportCDX(orgSlug, scanId)` |
| Export SPDX | `exportSPDX(orgSlug, scanId)` |

## Policies & Diffs

| Task | Method |
|------|--------|
| Get security policy | `getOrgSecurityPolicy(orgSlug)` |
| Update security policy | `updateOrgSecurityPolicy(orgSlug, rules)` |
| Get license policy | `getOrgLicensePolicy(orgSlug)` |
| Update license policy | `updateOrgLicensePolicy(orgSlug, rules)` |
| List diffs | `listOrgDiffScans(orgSlug, options)` |
| Create diff | `createOrgDiffScanFromIds(orgSlug, { base_scan_id, head_scan_id })` |
| Get diff | `getDiffScanById(orgSlug, diffId)` |
| Delete diff | `deleteOrgDiffScan(orgSlug, diffId)` |
