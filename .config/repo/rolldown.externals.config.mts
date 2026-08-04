/**
 * @file Rolldown configuration for the vendored externals build, mimicking
 *   socket-lib's `scripts/repo/build-externals`: each `src/external/*.js` shim
 *   becomes one self-contained CJS bundle under `dist/external/`, while the
 *   main build leaves consumers' relative `require('./external/*.js')` calls
 *   verbatim. The require therefore points at real shipped bytes, so both
 *   plain installs and consumer bundlers (socket-cli's rollup resolves the
 *   relative path and inlines the file) can load it — the failure mode this
 *   exists to prevent is CE-356, where a bundler-invisible bare
 *   `require('form-data')` shipped with nothing behind it.
 */

import path from 'node:path'

import {
  createCodeStubPlugin,
  createNodeProtocolPlugin,
  MIME_DB_PATTERN,
  MIME_DB_STUB,
} from './rolldown.config.mts'
import { REPO_ROOT } from '../../scripts/fleet/paths.mts'

import type { OutputOptions, RolldownOptions } from 'rolldown'

const rootPath = REPO_ROOT
const srcPath = path.join(rootPath, 'src')
const distPath = path.join(rootPath, 'dist')

export const externalsBuildConfig: RolldownOptions & {
  output: OutputOptions
} = {
  input: {
    // The input key carries the `external/` prefix so the bundle lands at
    // `dist/external/form-data.js`, mirroring `src/external/form-data.js`.
    'external/form-data': path.join(srcPath, 'external/form-data.js'),
  },
  output: {
    dir: distPath,
    format: 'cjs',
    entryFileNames: '[name].js',
    exports: 'auto',
    minify: false,
    banner: '"use strict";',
  },
  platform: 'node',
  plugins: [
    // 212KB mime-db arrives via form-data → mime-types → mime-db; the SDK
    // only needs octet-stream + json + form-data (same stub as the main
    // build used when form-data was an inline chunk).
    createCodeStubPlugin([{ pattern: MIME_DB_PATTERN, code: MIME_DB_STUB }]),
    createNodeProtocolPlugin(),
  ],
}
