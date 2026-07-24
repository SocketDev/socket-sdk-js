/**
 * @file Rolldown configuration for the socket-sdk-js BROWSER bundle
 *   (`dist/index.browser.js`). Selected by the `browser` export condition in
 *   package.json so bundlers (and Chrome MV3 service workers) that resolve with
 *   `platform: 'browser'` get a fetch-based, node-free build.
 *   How it differs from the node config (`rolldown.config.mts`):
 *
 *   - `platform: 'browser'` + `resolve.conditionNames: ['browser', 'import',
 *     'module', 'default']` (mirrors socket-webext's bundler) so
 *     `@socketsecurity/lib`'s ROOT `http-request` subpath resolves to its
 *     `browser` condition — the fetch transport in
 *     `@socketsecurity/lib/dist/http-request/browser.js` ("Designed for Chrome
 *     MV3 service workers") — instead of the node `http`/`https`/`zlib`
 *     transport. The SDK's `httpRequest` imports were switched from the deep
 *     `.../http-request/request` path (which has no `browser` condition) to the
 *     root `@socketsecurity/lib/http-request` subpath so that condition
 *     applies.
 *   - Node builtins are NOT externalized (an MV3 service worker cannot resolve
 *     `node:*`). Instead `createNodeBuiltinShimPlugin` replaces every `node:*`
 *     (and the bare builtin specifiers lib's node/* wrappers use) with a small
 *     browser-safe virtual module — see `./rolldown/browser-node-shims.mts`.
 *   - The bundle is self-contained (lib inlined, external `[]`), matching the
 *     node build's model where `@socketsecurity/lib` is a devDependency.
 *   - Emits a single ESM file (MV3 module service workers use ESM; the fetch
 *     transport and shims are all ESM-friendly). The lib heavy-stub reuse
 *     (globs/sorts/npm-pack subgraphs, mime-db, packages/operations) is shared
 *     verbatim with the node config; the lib `node/os.js` browser stub is
 *     browser-only (see browser-node-shims.mts).
 */

import path from 'node:path'

import {
  createNodeBuiltinShimPlugin,
  LIB_NODE_OS_PATTERN,
  LIB_NODE_OS_STUB,
} from './rolldown/browser-node-shims.mts'
import { createLibStubPlugin } from './rolldown/lib-stub.mts'
import {
  createCodeStubPlugin,
  LIB_STUB_PATTERN,
  MIME_DB_PATTERN,
  MIME_DB_STUB,
  OPERATIONS_PATTERN,
  OPERATIONS_STUB,
} from './rolldown.config.mts'
import { REPO_ROOT } from '../../scripts/fleet/paths.mts'

import type { OutputOptions, RolldownOptions } from 'rolldown'

const rootPath = REPO_ROOT
const srcPath = path.join(rootPath, 'src')
const distPath = path.join(rootPath, 'dist')

export const browserBuildConfig: RolldownOptions & { output: OutputOptions } = {
  // Everything is inlined for a self-contained browser bundle (lib is a
  // devDependency, same model as the node build); node builtins are shimmed.
  external: [],
  input: {
    'index.browser': path.join(srcPath, 'index.mts'),
  },
  // `node:fs` is both statically imported (lib constants/platform, file-upload,
  // full-scans, quota-utils) and dynamically imported (socket-sdk-class's
  // node-only download path). Once the shim collapses every reference to one
  // virtual module the dynamic import can't split into its own chunk — which is
  // exactly what we want (a self-contained bundle), so silence the advisory.
  onLog(level, log, defaultHandler) {
    if (log.code === 'INEFFECTIVE_DYNAMIC_IMPORT') {
      return
    }
    defaultHandler(level, log)
  },
  output: {
    dir: distPath,
    entryFileNames: '[name].js',
    format: 'esm',
    minify: false,
    sourcemap: false,
  },
  platform: 'browser',
  plugins: [
    createLibStubPlugin({ stubPattern: LIB_STUB_PATTERN }),
    createCodeStubPlugin([
      { pattern: MIME_DB_PATTERN, code: MIME_DB_STUB },
      { pattern: OPERATIONS_PATTERN, code: OPERATIONS_STUB },
      { pattern: LIB_NODE_OS_PATTERN, code: LIB_NODE_OS_STUB },
    ]),
    createNodeBuiltinShimPlugin(),
  ],
  resolve: {
    // Mirrors socket-webext: pick lib's `browser` condition (fetch transport)
    // before `import`/`module`/`default`.
    conditionNames: ['browser', 'import', 'module', 'default'],
  },
  transform: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env['NODE_ENV'] || 'production',
      ),
    },
  },
}
