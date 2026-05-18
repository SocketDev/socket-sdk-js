/**
 * @file Esbuild plugin: shorten pnpm `node_modules/.pnpm/...` paths in bundled
 *   output (comments + string literals) to plain `package/subpath` form.
 *   Detects collisions and falls back to the original path when two long paths
 *   would collapse to the same short form. Uses @babel/parser + magic-string
 *   for AST-precise rewrites — string replacement would corrupt JS in edge
 *   cases (paths inside template literals, JSDoc, etc.). Source: lifted from
 *   socket-sdk-js. Fleet-canonical via socket-wheelhouse.
 */

import { promises as fs } from 'node:fs'

import type { Comment } from '@babel/types'

import { parse } from '@babel/parser'
import MagicString from 'magic-string'

import type { BuildResult, PluginBuild } from 'esbuild'

import { NODE_MODULES } from '@socketsecurity/lib-stable/paths/dirnames'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger'

const logger = getDefaultLogger()

export function createPathShorteningPlugin() {
  return {
    name: 'shorten-module-paths',
    setup(build: PluginBuild) {
      build.onEnd(async (result: BuildResult) => {
        if (!result.outputFiles && result.metafile) {
          const outputs = Object.keys(result.metafile.outputs).filter(
            f => f.endsWith('.js') || f.endsWith('.mjs'),
          )

          for (let i = 0, { length } = outputs; i < length; i += 1) {
            const outputPath = outputs[i]!
            // eslint-disable-next-line no-await-in-loop
            const content = await fs.readFile(outputPath, 'utf8')
            const magicString = new MagicString(content)

            const pathMap = new Map<string, string>()
            const conflictDetector = new Map<string, string>()

            // eslint-disable-next-line unicorn/consistent-function-scoping
            const shortenPath = (longPath: string): string => {
              if (pathMap.has(longPath)) {
                return pathMap.get(longPath)!
              }

              let shortPath = longPath

              // pnpm scoped packages: .pnpm/@scope+pkg@version/node_modules/@scope/pkg/subpath
              const scopedPnpmMatch = longPath.match(
                /node_modules\/\.pnpm\/@([^+/]+)\+([^@/]+)@[^/]+\/node_modules\/(@[^/]+\/[^/]+)\/(.+)/,
              )
              if (scopedPnpmMatch) {
                const [, _scope, _pkg, packageName, subpath] = scopedPnpmMatch
                shortPath = `${packageName}/${subpath}`
              } else {
                // pnpm non-scoped packages: .pnpm/pkg@version/node_modules/pkg/subpath
                const pnpmMatch = longPath.match(
                  /node_modules\/\.pnpm\/([^@/]+)@[^/]+\/node_modules\/([^/]+)\/(.+)/,
                )
                if (pnpmMatch) {
                  const [, _pkgName, packageName, subpath] = pnpmMatch
                  shortPath = `${packageName}/${subpath}`
                }
              }

              // Two distinct long paths must not collapse to the same short
              // path — that would corrupt the bundle. On collision, keep
              // the original.
              if (conflictDetector.has(shortPath)) {
                const existingPath = conflictDetector.get(shortPath)
                if (existingPath !== longPath) {
                  logger.warn(
                    // oxlint-disable-next-line socket/no-logger-newline-literal -- multi-line diagnostic: pairing the short/long path with its conflict origin requires inline newlines for readability.
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

            try {
              const ast = parse(content, {
                sourceType: 'module',
                plugins: [],
              })

              const comments = (ast.comments || []) as Comment[]
              for (
                let ci = 0, { length: clen } = comments;
                ci < clen;
                ci += 1
              ) {
                const comment = comments[ci]!
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

              function walk(node: unknown): void {
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

                const keys = Object.keys(n)
                for (let ki = 0, { length: klen } = keys; ki < klen; ki += 1) {
                  const key = keys[ki]!
                  if (key === 'end' || key === 'loc' || key === 'start') {
                    continue
                  }
                  const value = n[key]!
                  if (Array.isArray(value)) {
                    for (let i = 0, { length } = value; i < length; i += 1) {
                      const item = value[i]!
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
