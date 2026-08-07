/**
 * @file Exports-surface policy for @socketsecurity/sdk, consumed by BOTH the
 *   canonical generator (scripts/fleet/gen/package-exports.mts, which rewrites
 *   the package.json `exports` map from `files` minus `ignore`) and the
 *   public-files-are-exported validator (its `ignore` contract). The public
 *   surface is deliberately narrow: the `.` and `./testing` entries plus the
 *   two hand-authored `types/*.d.ts` declaration bundles. The declaration
 *   build emits one .d.mts per module; every sibling .d.mts is the entries'
 *   module graph (the entries re-export from them, so TypeScript resolution
 *   needs them shipped) — not an independently exported entry point. The
 *   graph leaves are therefore enumerated in `ignore`: excluded from export
 *   generation and from orphan detection, while still shipping via the
 *   package.json `files` allowlist. A NEW dist leaf fails the validator until
 *   it is either exported (add it to `files` here) or declared graph-only
 *   (add it to `ignore`) — that loud stop is the point.
 */

import type { ExportsConfig } from '../fleet/gen/package-exports.mts'

export const config: ExportsConfig = {
  files: ['dist/*.js', 'dist/*.d.mts', 'types/*.d.ts', 'package.json'],
  // Shipped-but-not-exported: the entries' declaration module graph. Kept in
  // the published tarball (package.json `files`), out of the exports map.
  ignore: [
    'dist/blob.d.mts',
    'dist/constants.d.mts',
    'dist/events-v1.d.mts',
    'dist/file-upload.d.mts',
    'dist/form-data-entry.d.mts',
    'dist/full-scans-v1.d.mts',
    'dist/http-client.d.mts',
    'dist/quota-utils.d.mts',
    'dist/socket-sdk-class.d.mts',
    'dist/threat-campaigns-v1.d.mts',
    'dist/types-strict.d.mts',
    'dist/types-parity.d.mts',
    'dist/types.d.mts',
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
