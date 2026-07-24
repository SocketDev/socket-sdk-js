# Unsupported endpoints

Some Socket public API operations are intentionally **not** wrapped by this
SDK because the API marks them deprecated. New code should use the listed
successor instead. These methods will not be added; if you need to call a
deprecated endpoint directly, use the [`getApi` / `sendApi` escape
hatches](./concepts.md#escape-hatches).

## Intentionally not supported (deprecated API operations)

| OpenAPI operation         | Endpoint                                   | Why not supported                                                             |
| ------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `createReport`            | `PUT /report/upload`                       | Deprecated reports API; use full scans (`createFullScan`).                    |
| `getReport`               | `GET /report/view/{id}`                    | Deprecated reports API; use full scans (`getFullScan`).                       |
| `getReportList`           | `GET /report/list`                         | Deprecated reports API; use full scans (`listFullScans`).                     |
| `deleteReport`            | `DELETE /report/delete/{id}`               | Deprecated reports API; use full scans (`deleteFullScan`).                    |
| `getReportSupportedFiles` | `GET /report/supported`                    | Deprecated reports API; use `getSupportedFiles`.                              |
| `GetOrgDiffScan`          | `GET /orgs/{org_slug}/full-scans/diff`     | Deprecated diff endpoint; use `createOrgDiffScanFromIds` + `getDiffScanById`. |
| `GetOrgFullScanDiffGfm`   | `GET /orgs/{org_slug}/full-scans/diff/gfm` | Deprecated GFM diff endpoint; use `getDiffScanGfm`.                           |
| `saturateLicensePolicy`   | `POST /saturate-license-policy`            | Deprecated (legacy); use `updateOrgLicensePolicy` / `viewLicensePolicy`.      |
| `getRepoList`             | `GET /repo/list`                           | Deprecated; superseded by `listRepositories` (`GET /orgs/{org_slug}/repos`).  |

## Deprecated but still present

These two methods target deprecated `npm/*` operations and remain only for
backwards compatibility. They are on their way out — prefer the org-scoped
package methods (`batchOrgPackageFetch`, `batchPackageFetch`) instead.

| SDK method              | OpenAPI operation       | Endpoint                              |
| ----------------------- | ----------------------- | ------------------------------------- |
| `getScoreByNpmPackage`  | `getScoreByNPMPackage`  | `GET /npm/{package}/{version}/score`  |
| `getIssuesByNpmPackage` | `getIssuesByNPMPackage` | `GET /npm/{package}/{version}/issues` |
