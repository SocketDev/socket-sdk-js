/**
 * @fileoverview esbuild configuration for fast builds with smaller bundles
 */

import { promises as fs } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import type { Comment } from '@babel/types'

import { parse } from '@babel/parser'
import MagicString from 'magic-string'

import type { BuildResult, Metafile, OnResolveArgs, PluginBuild } from 'esbuild'

import { NODE_MODULES } from '@socketsecurity/lib/paths/dirnames'
import { envAsBoolean } from '@socketsecurity/lib/env/helpers'
import { getDefaultLogger } from '@socketsecurity/lib/logger'

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
 * Plugin to shorten module paths in bundled output with conflict detection.
 * Uses @babel/parser and magic-string for precise AST-based modifications.
 */
function createPathShorteningPlugin() {
  return {
    name: 'shorten-module-paths',
    setup(build: PluginBuild) {
      build.onEnd(async (result: BuildResult) => {
        if (!result.outputFiles && result.metafile) {
          const outputs = Object.keys(result.metafile.outputs).filter(
            f => f.endsWith('.js') || f.endsWith('.mjs'),
          )

          for (const outputPath of outputs) {
            // eslint-disable-next-line no-await-in-loop
            const content = await fs.readFile(outputPath, 'utf8')
            const magicString = new MagicString(content)

            // Track module paths and their shortened versions
            const pathMap = new Map()
            const conflictDetector = new Map()

            // eslint-disable-next-line unicorn/consistent-function-scoping
            const shortenPath = (longPath: string): string => {
              if (pathMap.has(longPath)) {
                return pathMap.get(longPath)
              }

              let shortPath = longPath

              // Handle pnpm scoped packages
              const scopedPnpmMatch = longPath.match(
                /node_modules\/\.pnpm\/@([^+/]+)\+([^@/]+)@[^/]+\/node_modules\/(@[^/]+\/[^/]+)\/(.+)/,
              )
              if (scopedPnpmMatch) {
                const [, _scope, _pkg, packageName, subpath] = scopedPnpmMatch
                shortPath = `${packageName}/${subpath}`
              } else {
                // Handle pnpm non-scoped packages
                const pnpmMatch = longPath.match(
                  /node_modules\/\.pnpm\/([^@/]+)@[^/]+\/node_modules\/([^/]+)\/(.+)/,
                )
                if (pnpmMatch) {
                  const [, _pkgName, packageName, subpath] = pnpmMatch
                  shortPath = `${packageName}/${subpath}`
                }
              }

              // Detect conflicts
              if (conflictDetector.has(shortPath)) {
                const existingPath = conflictDetector.get(shortPath)
                if (existingPath !== longPath) {
                  logger.warn(
                    `Path conflict detected:\n  "${shortPath}"\n  Maps to: "${existingPath}"\n  Also from: "${longPath}"\n  Keeping original paths to avoid conflict.`,
                  )
                  shortPath = longPath
                }
              } else {
                conflictDetector.set(shortPath, longPath)
              }

              pathMap.set(longPath, shortPath)
              return shortPath
            }

            // Parse AST to find all string literals containing module paths
            try {
              const ast = parse(content, {
                sourceType: 'module',
                plugins: [],
              })

              // Walk through all comments
              for (const comment of (ast.comments || []) as Comment[]) {
                if (
                  comment.type === 'CommentLine' &&
                  comment.value.includes(NODE_MODULES)
                ) {
                  const originalPath = comment.value.trim()
                  const shortPath = shortenPath(originalPath)

                  if (
                    shortPath !== originalPath &&
                    comment.start != null &&
                    comment.end != null
                  ) {
                    magicString.overwrite(
                      comment.start,
                      comment.end,
                      `// ${shortPath}`,
                    )
                  }
                }
              }

              // Walk through all string literals
              function walk(node: unknown) {
                if (!node || typeof node !== 'object') {
                  return
                }
                const n = node as Record<string, unknown>

                if (
                  n['type'] === 'StringLiteral' &&
                  typeof n['value'] === 'string' &&
                  n['value'].includes(NODE_MODULES)
                ) {
                  const originalPath = n['value']
                  const shortPath = shortenPath(originalPath)
                  const start = n['start']
                  const end = n['end']

                  if (
                    shortPath !== originalPath &&
                    typeof start === 'number' &&
                    typeof end === 'number'
                  ) {
                    magicString.overwrite(start + 1, end - 1, shortPath)
                  }
                }

                for (const key of Object.keys(n)) {
                  if (key === 'start' || key === 'end' || key === 'loc') {
                    continue
                  }
                  const value = n[key]
                  if (Array.isArray(value)) {
                    for (const item of value) {
                      walk(item)
                    }
                  } else {
                    walk(value)
                  }
                }
              }

              walk(ast.program as unknown)
              // eslint-disable-next-line no-await-in-loop
              await fs.writeFile(outputPath, magicString.toString(), 'utf8')
            } catch (e) {
              logger.error(
                `Failed to shorten paths in ${outputPath}: ${e instanceof Error ? e.message : String(e)}`,
              )
            }
          }
        }
      })
    },
  }
}

/**
 * Plugin to ensure all Node.js builtins use the node: protocol.
 * Intercepts imports of Node.js built-in modules and rewrites them to use the node: prefix.
 */
function createNodeProtocolPlugin() {
  // Get list of Node.js built-in modules dynamically
  return {
    name: 'node-protocol',
    setup(build: PluginBuild) {
      for (const builtin of Module.builtinModules) {
        // Skip builtins that already have node: prefix
        if (builtin.startsWith('node:')) {
          continue
        }

        // Match imports that don't already have the node: prefix
        // Escape special regex characters in module name
        const escapedBuiltin = builtin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        build.onResolve(
          { filter: new RegExp(`^${escapedBuiltin}$`) },
          (_args: OnResolveArgs) => {
            // Return with node: prefix and mark as external
            return {
              path: `node:${builtin}`,
              external: true,
            }
          },
        )
      }
    },
  }
}

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
  const libStubPattern =
    /@socketsecurity\/lib\/dist\/(globs|sorts|external\/(npm-pack|pico-pack))\.js$/

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
