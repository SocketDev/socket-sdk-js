/**
 * @file Public exports and internal declaration modules for the SDK package.
 *   The exports generator and public-files validator share this policy.
 *   Internal declaration modules ship through package.json files so consumers
 *   can resolve imports from the root and testing declarations.
 */

import type { ExportsConfig } from '../fleet/gen/package-exports.mts'

export const config: ExportsConfig = {
  files: ['dist/*.js', 'dist/*.d.mts', 'types/*.d.ts', 'package.json'],
  ignore: [
    'dist/alert-policies.d.mts',
    'dist/alert-policy-migration.d.mts',
    'dist/alert-policy-rules.d.mts',
    'dist/api-client.d.mts',
    'dist/api-errors.d.mts',
    'dist/api-retry.d.mts',
    'dist/blob.d.mts',
    'dist/constants.d.mts',
    'dist/events-v1.d.mts',
    'dist/file-upload.d.mts',
    'dist/full-scan-compat.d.mts',
    'dist/full-scan-polling-v1.d.mts',
    'dist/full-scan-results-v1.d.mts',
    'dist/full-scans-v1.d.mts',
    'dist/http-client.d.mts',
    'dist/malware.d.mts',
    'dist/org-api.d.mts',
    'dist/org-fixes.d.mts',
    'dist/patch-verification.d.mts',
    'dist/public-patches-client.d.mts',
    'dist/public-purl-client.d.mts',
    'dist/purl-versions-v1.d.mts',
    'dist/purl.d.mts',
    'dist/quota-utils.d.mts',
    'dist/socket-sdk-class.d.mts',
    'dist/threat-campaigns-v1.d.mts',
    'dist/types/*',
    'dist/user-agent.d.mts',
    'dist/utils.d.mts',
    'dist/utils/*',
    // Vendored externals (socket-lib convention): self-contained bundles the
    // main bundle reaches through verbatim relative requires — shipped via
    // `files`, never exported as subpaths.
    'dist/external/*',
    // rolldown code-split JS chunks: the shared runtime and hashed shared
    // chunks imported by the exported entries — graph-only, shipped via
    // `files`, never exported. Globbed so a content-hash change does not
    // re-trip the validator on every dependency bump.
    'dist/promises-*.js',
    'dist/rolldown-runtime-*.js',
    // The vendored form-data module graph: the externals build splits the
    // form-data npm module into this root-level chunk, and the declaration
    // build emits its matching graph leaf. Shipped via `files`, never an
    // exported subpath.
    'dist/form-data.js',
  ],
  outDir: 'dist',
}
