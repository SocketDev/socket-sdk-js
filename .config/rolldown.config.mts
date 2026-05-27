/**
 * @file Rolldown configuration for the socket-sdk-js bundle. Two CJS entries
 *   (index, testing), runtime deps externalized so consumers install them.
 *   Replaces the esbuild build (fleet "Tooling" rule: bundler = rolldown). The
 *   heavy-lib stubbing uses the fleet-canonical createLibStubPlugin; mime-db is
 *   stubbed separately (different replacement body); node: builtins are
 *   prefixed + externalized via a resolveId hook.
 */

import { promises as fs } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { envAsBoolean } from '@socketsecurity/lib-stable/env/boolean'

import { createLibStubPlugin } from './rolldown/lib-stub.mts'

import type { OutputOptions, Plugin, RolldownOptions } from 'rolldown'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')
const srcPath = path.join(rootPath, 'src')
const distPath = path.join(rootPath, 'dist')

const packageJson = JSON.parse(
  await fs.readFile(path.join(rootPath, 'package.json'), 'utf8'),
) as { dependencies?: Record<string, string> | undefined }
const externalDependencies = Object.keys(packageJson.dependencies || {})

// Heavy lib modules eagerly required but never exercised by the SDK's code
// paths (globs/sorts gateways + their npm-pack/pico-pack/cacache/del
// subgraphs). Verified unreachable from the SDK's import surface.
//
// `package-default-node-range` is stubbed too: it is pulled in transitively
// (constants/socket → constants/packages → here) and EAGERLY evaluates
// `semver.parse(...)` at module load — but `semver` comes from the stubbed
// npm-pack, so it would be undefined and crash. The SDK never reads
// `packageDefaultNodeRange`, so replacing the module with an empty export
// breaks the eager-evaluation chain cleanly. (esbuild's cross-module DCE
// dropped these; rolldown evaluates each required CJS module's whole body,
// so they need explicit stubs.)
const LIB_STUB_PATTERN =
  /@socketsecurity\/lib\/dist\/(?:constants\/package-default-node-range|external\/(?:cacache|del|npm-pack|pico-pack)|globs|sorts)\.js$/

// `packages/operations` is required only for the pure `pkgNameToSlug` helper
// (http-request/user-agent builds the UA string from it). Its module body
// eagerly inits a make-fetch-happen fetcher (`makeFetchHappen.defaults(...)`)
// from the stubbed npm-pack → crashes at load. The SDK never calls any
// fetcher-backed export, so replace the module with just the pure helper.
// (lib 6.0.4 makes that fetcher lazy, after which this stub is belt-and-
// suspenders; kept so the SDK builds against published 6.0.3 too.)
const OPERATIONS_PATTERN =
  /@socketsecurity\/lib\/dist\/packages\/operations\.js$/
const OPERATIONS_STUB = `'use strict'
function pkgNameToSlug(pkgName) {
  return pkgName.charCodeAt(0) === 64
    ? pkgName.slice(1).replace('/', '-')
    : pkgName
}
module.exports = { pkgNameToSlug }`

// 212KB mime-db reached via form-data → mime-types → mime-db; the SDK only
// needs octet-stream + json + form-data. Replace with a minimal lookup.
const MIME_DB_PATTERN = /mime-db\/db\.json$/
const MIME_DB_STUB = `module.exports = {
  "application/json": { source: "iana", charset: "UTF-8", compressible: true },
  "application/octet-stream": { source: "iana", compressible: false },
  "multipart/form-data": { source: "iana" }
}`

/**
 * Stub modules that need a non-empty replacement body (unlike the empty-export
 * lib-stub). Each entry maps a path pattern to JS replacement code.
 * `moduleType: 'js'` is required so rolldown treats the body as JS even when
 * the id ends in `.json` (mime-db).
 */
export function createCodeStubPlugin(
  stubs: ReadonlyArray<{ pattern: RegExp; code: string }>,
): Plugin {
  return {
    name: 'stub-code-modules',
    load(id) {
      for (const { code, pattern } of stubs) {
        if (pattern.test(id)) {
          return { code, moduleType: 'js', moduleSideEffects: false }
        }
      }
      return undefined
    },
  }
}

/**
 * Rewrite bare Node builtin imports to the `node:` protocol + externalize them,
 * so a dependency's `require('fs')` doesn't leak into the bundle. Ported from
 * the esbuild onResolve plugin to a rolldown resolveId hook.
 */
export function createNodeProtocolPlugin(): Plugin {
  const builtins = new Set(
    Module.builtinModules.filter(m => !m.startsWith('node:')),
  )
  return {
    name: 'node-protocol',
    resolveId(source) {
      if (builtins.has(source)) {
        return { id: `node:${source}`, external: true }
      }
      return undefined
    },
  }
}

export const buildConfig: RolldownOptions & { output: OutputOptions } = {
  input: {
    index: path.join(srcPath, 'index.ts'),
    testing: path.join(srcPath, 'testing.ts'),
  },
  platform: 'node',
  // Runtime deps stay external (consumers install them); node: builtins are
  // externalized by the node-protocol plugin.
  external: externalDependencies,
  transform: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env['NODE_ENV'] || 'production',
      ),
    },
  },
  plugins: [
    createLibStubPlugin({ stubPattern: LIB_STUB_PATTERN }),
    createCodeStubPlugin([
      { pattern: MIME_DB_PATTERN, code: MIME_DB_STUB },
      { pattern: OPERATIONS_PATTERN, code: OPERATIONS_STUB },
    ]),
    createNodeProtocolPlugin(),
  ],
  output: {
    dir: distPath,
    format: 'cjs',
    entryFileNames: '[name].js',
    minify: false,
    sourcemap: envAsBoolean(process.env['COVERAGE']),
    banner: '"use strict";',
  },
}
