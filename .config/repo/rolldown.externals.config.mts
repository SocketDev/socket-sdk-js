/**
 * @file Bundle vendored external entry points for SDK consumers.
 */

import path from 'node:path'

import {
  createCodeStubPlugin,
  createNodeProtocolPlugin,
  MIME_DB_PATTERN,
  MIME_DB_STUB,
  SDK_BUNDLE_COMMENTS,
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
    comments: SDK_BUNDLE_COMMENTS,
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
