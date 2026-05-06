/**
 * @fileoverview esbuild configuration for fast builds with smaller bundles
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import type { BuildResult, Metafile, PluginBuild } from 'esbuild'

import { envAsBoolean } from '@socketsecurity/lib/env/helpers'
import { getDefaultLogger } from '@socketsecurity/lib/logger'

import { createNodeProtocolPlugin } from './esbuild/node-protocol.mts'
import { createPathShorteningPlugin } from './esbuild/shorten-paths.mts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const rootPath = path.join(__dirname, '..')
const srcPath = path.join(rootPath, 'src')
const distPath = path.join(rootPath, 'dist')

const logger = getDefaultLogger()

// Read package.json to get runtime dependencies
const packageJsonPath = path.join(rootPath, 'package.json')
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
const externalDependencies = Object.keys(packageJson.dependencies || {})

/**
 * Plugin to stub heavy @socketsecurity/lib internals and third-party modules
 * that are unreachable or safely degradable in the SDK's runtime code paths.
 *
 * @socketsecurity/lib stubs:
 *
 *   npm-pack.js (2.5MB) — arborist, cacache, pacote, make-fetch-happen,
 *     semver. Reached via sorts→semver (dead) and cache-with-ttl→cacache
 *     (degrades gracefully: safeGet returns undefined, in-memory memoization
 *     still works).
 *
 *   pico-pack.js (260KB) — picomatch, fast-glob, del. Reached via
 *     fs→globs for isDirEmptySync/readDirNames, never called by SDK.
 *
 *   globs.js, sorts.js — gateway modules to pico-pack and npm-pack.
 *
 * Third-party stubs:
 *
 *   mime-db (212KB) — Massive MIME type database bundled via form-data →
 *     mime-types → mime-db. The SDK only uses 'application/octet-stream'
 *     (file uploads) and 'application/json' (API calls). Replaced with a
 *     minimal lookup covering just those types.
 */
function createLibStubPlugin() {
  // Heavy lib modules that are eagerly required but never exercised
  // by the SDK's actual code paths.
  //
  // Never-reached by SDK gateway modules:
  //   - globs.js / sorts.js → only used by fs helpers the SDK skips
  //   - external/npm-pack.js / pico-pack.js → Arborist/pacote/fast-glob,
  //     SDK only needs validateFiles() from fs
  //
  // Never-reached transitive external shims:
  //   - external/cacache.js → destructures from npm-pack (already stubbed),
  //     SDK's cache-with-ttl path degrades gracefully
  //   - external/del.js → pulled in by fs's lazy getDel() for safeDelete,
  //     SDK never calls safeDelete/safeDeleteSync
  const libStubPattern =
    /@socketsecurity\/lib\/dist\/(globs|sorts|external\/(npm-pack|pico-pack|cacache|del))\.js$/

  const mimeDbPattern = /mime-db\/db\.json$/

  return {
    name: 'stub-unused-internals',
    setup(build: PluginBuild) {
      // Stub heavy lib modules with empty exports.
      build.onLoad({ filter: libStubPattern }, () => ({
        contents: 'module.exports = {}',
        loader: 'js',
      }))
      // Replace 212KB mime-db with minimal lookup for types the SDK uses.
      build.onLoad({ filter: mimeDbPattern }, () => ({
        contents: `module.exports = {
  "application/json": { source: "iana", charset: "UTF-8", compressible: true },
  "application/octet-stream": { source: "iana", compressible: false },
  "multipart/form-data": { source: "iana" }
}`,
        loader: 'js',
      }))
    },
  }
}

// Build configuration for ESM output
export const buildConfig = {
  entryPoints: [`${srcPath}/index.ts`, `${srcPath}/testing.ts`],
  outdir: distPath,
  outbase: srcPath,
  bundle: true,
  format: 'cjs' as const,
  // Target Node.js environment (not browser).
  platform: 'node' as const,
  // Target Node.js 18+ features.
  target: 'node18',
  // Enable source maps for coverage (set COVERAGE=true env var)
  sourcemap: envAsBoolean(process.env['COVERAGE']),
  minify: false,
  treeShaking: true,
  // For bundle analysis
  metafile: true,
  logLevel: 'info',

  // Use plugins for module resolution and path handling.
  plugins: [
    createLibStubPlugin(),
    createNodeProtocolPlugin(),
    createPathShorteningPlugin(),
  ].filter(Boolean),

  // External dependencies.
  // All runtime dependencies from package.json are external (not bundled) - consumers must install them.
  external: externalDependencies,

  // TypeScript configuration
  tsconfig: path.join(rootPath, 'tsconfig.json'),

  // Define constants for optimization
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env['NODE_ENV'] || 'production',
    ),
  },
}

// Watch configuration for development
export const watchConfig = {
  ...buildConfig,
  minify: false,
  sourcemap: 'inline' as const,
  logLevel: 'debug',
  watch: {
    onRebuild(error: Error | null, result: BuildResult | null) {
      if (error) {
        logger.error(`Watch build failed: ${error}`)
      } else {
        logger.log('Watch build succeeded')
        if (result?.metafile) {
          const analysis = analyzeMetafile(result.metafile)
          logger.log(analysis)
        }
      }
    },
  },
}

/**
 * Analyze build output for size information
 */
function analyzeMetafile(metafile: Metafile) {
  const outputs = Object.keys(metafile.outputs)
  let totalSize = 0

  const files = outputs.map(file => {
    const output = metafile.outputs[file]!
    totalSize += output.bytes
    return {
      name: path.relative(rootPath, file),
      size: `${(output.bytes / 1024).toFixed(2)} KB`,
    }
  })

  return {
    files,
    totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
  }
}

export { analyzeMetafile }
