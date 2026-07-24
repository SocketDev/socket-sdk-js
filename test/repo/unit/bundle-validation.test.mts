/**
 * @file Bundle validation tests to ensure build output quality. Verifies that
 *   dist files don't contain absolute paths or external dependencies.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import { describe, expect, it } from 'vitest'

import { getDefaultLogger } from '@socketsecurity/lib/logger/default'

const logger = getDefaultLogger()

// CJS/ESM interop: @babel/traverse wraps the function under .default in ESM
const traverse = ((_traverse as { default?: typeof _traverse | undefined })
  .default ?? _traverse) as typeof _traverse

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagePath = path.resolve(__dirname, '../../..')
const distPath = path.join(packagePath, 'dist')

/**
 * Check if bundle contains inlined dependencies using AST analysis. Reads
 * package.json dependencies and ensures they are NOT bundled inline.
 */
export async function checkBundledDependencies(content: string): Promise<{
  bundledDeps: string[]
  hasNoBundledDeps: boolean
}> {
  // Read package.json to get runtime dependencies.
  const pkgJsonPath = path.join(packagePath, 'package.json')
  const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf8'))
  const dependencies = pkgJson.dependencies || {}

  const bundledDeps: string[] = []

  // Parse the bundle into an AST.
  const file = parse(content, {
    sourceType: 'module',
    plugins: ['typescript'],
  })

  // Collect all import sources from the AST.
  const importSources = new Set<string>()

  traverse(file as Parameters<typeof traverse>[0], {
    ImportDeclaration(importPath) {
      const source = importPath.node.source.value
      importSources.add(source)
    },
    CallExpression(callPath) {
      // Handle require() calls
      const { callee } = callPath.node
      const [firstArg] = callPath.node.arguments
      if (
        callee.type === 'Identifier' &&
        callee.name === 'require' &&
        firstArg?.type === 'StringLiteral'
      ) {
        importSources.add(firstArg.value)
      }
    },
  })

  // Packages that should always be external (never bundled).
  const socketPackagePatterns = [
    /@socketsecurity\/lib/,
    /@socketregistry\/packageurl-js/,
    /@socketsecurity\/sdk/,
    /@socketsecurity\/registry/,
  ]

  // Check if we have runtime dependencies.
  if (Object.keys(dependencies).length === 0) {
    // No runtime dependencies - check that Socket packages aren't bundled.
    for (let i = 0, { length } = socketPackagePatterns; i < length; i += 1) {
      const pattern = socketPackagePatterns[i]!
      const hasExternalImport = Array.from(importSources).some(source =>
        pattern.test(source),
      )

      if (!hasExternalImport) {
        // Check if this package name appears in the content at all.
        // If it's just in string literals (like constants), that's fine.
        // Use AST to check if it appears in any meaningful way.
        let foundInCode = false

        traverse(file as Parameters<typeof traverse>[0], {
          StringLiteral(stringPath) {
            // Skip string literals - these are fine
            if (pattern.test(stringPath.node.value)) {
              // It's in a string literal, which is fine
            }
          },

          Identifier(identifierPath) {
            // Check if the package name appears in identifiers or other code
            if (
              pattern.test(identifierPath.node.name) ||
              (identifierPath.node.name.includes('socketsecurity') &&
                pattern.test(identifierPath.node.name))
            ) {
              foundInCode = true
            }
          },
        })

        // Only flag if we found it in actual code, not just string literals
        if (foundInCode) {
          bundledDeps.push(pattern.source)
        }
      }
    }
  } else {
    // We have runtime dependencies - check that they remain external.
    const depKeys = Object.keys(dependencies)
    for (let di = 0, { length: dlen } = depKeys; di < dlen; di += 1) {
      const dep = depKeys[di]!
      // Check for exact match or subpath imports (e.g., '@socketsecurity/lib/path')
      const hasExternalImport = Array.from(importSources).some(
        source => source === dep || source.startsWith(`${dep}/`),
      )

      if (!hasExternalImport) {
        // Check if dependency appears in actual bundled code (not just package.json metadata)
        // The bundle might include package.json as a literal object, which is fine
        let foundInBundledCode = false

        traverse(file as Parameters<typeof traverse>[0], {
          // Look for actual code that imports/requires this dependency
          CallExpression(callPath) {
            const { callee } = callPath.node
            const [firstArg] = callPath.node.arguments
            if (
              callee.type === 'Identifier' &&
              callee.name === 'require' &&
              firstArg?.type === 'StringLiteral' &&
              firstArg.value.startsWith(dep)
            ) {
              foundInBundledCode = true
            }
          },
          ImportDeclaration(importPath) {
            if (importPath.node.source.value.startsWith(dep)) {
              foundInBundledCode = true
            }
          },
        })

        // Only flag if we found actual bundled code, not just metadata
        if (foundInBundledCode) {
          bundledDeps.push(dep)
        }
      }
    }
  }

  return {
    bundledDeps,
    hasNoBundledDeps: bundledDeps.length === 0,
  }
}

// Node core modules that must never appear as an executable import/require in
// the browser bundle. A leading `node:` prefix always disqualifies; these bare
// names are the builtins the SDK/lib graph could reach.
const NODE_BUILTIN_NAMES = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'stream/promises',
  'string_decoder',
  'sys',
  'timers',
  'timers/promises',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
])

/**
 * AST-scan a bundle for executable Node builtin imports/requires. Ignores
 * string literals and comments (e.g. an embedded package.json script or a
 * shim's throw-message), so it flags only imports the runtime would actually
 * resolve — the exact thing that crashes a Chrome MV3 service worker at module
 * load.
 */
export function findNodeBuiltinImports(content: string): string[] {
  const file = parse(content, {
    sourceType: 'module',
    plugins: ['typescript'],
  })

  const offenders = new Set<string>()
  const flag = (source: string | undefined): void => {
    if (!source) {
      return
    }
    if (source.startsWith('node:') || NODE_BUILTIN_NAMES.has(source)) {
      offenders.add(source)
    }
  }

  traverse(file as Parameters<typeof traverse>[0], {
    ImportDeclaration(importPath) {
      flag(importPath.node.source.value)
    },
    ExportNamedDeclaration(exportPath) {
      if (exportPath.node.source) {
        flag(exportPath.node.source.value)
      }
    },
    ExportAllDeclaration(exportPath) {
      flag(exportPath.node.source.value)
    },
    Import(importPath) {
      // Dynamic import(): the specifier is the parent CallExpression's first arg.
      const parent = importPath.parent
      if (parent.type === 'CallExpression') {
        const [firstArg] = parent.arguments
        if (firstArg?.type === 'StringLiteral') {
          flag(firstArg.value)
        }
      }
    },
    CallExpression(callPath) {
      const { callee } = callPath.node
      const [firstArg] = callPath.node.arguments
      if (
        callee.type === 'Identifier' &&
        callee.name === 'require' &&
        firstArg?.type === 'StringLiteral'
      ) {
        flag(firstArg.value)
      }
    },
  })

  return Array.from(offenders)
}

/**
 * Check if content contains absolute paths. Detects paths like /Users/, C:,
 * /home/, etc.
 */
export function hasAbsolutePaths(content: string): {
  hasIssue: boolean
  matches: string[]
} {
  // Match absolute paths but exclude URLs and node: protocol.
  const patterns = [
    // Match require('/abs/path') or require('C:\\path').
    /require\(["'](?:[A-Z]:\\[^"'\n]+|\/[^"'\n]+)["']\)/g,
    // Match import from '/abs/path'.
    /import\s+.*?from\s+["'](?:[A-Z]:\\[^"'\n]+|\/[^"'\n]+)["']/g,
  ]

  const matches: string[] = []
  for (let i = 0, { length } = patterns; i < length; i += 1) {
    const pattern = patterns[i]!
    const found = content.match(pattern)
    if (found) {
      matches.push(...found)
    }
  }

  return {
    hasIssue: matches.length > 0,
    matches,
  }
}

describe('Bundle validation', () => {
  it('should not contain absolute paths in dist/index.js', async () => {
    const indexPath = path.join(distPath, 'index.js')
    const content = await fs.readFile(indexPath, 'utf8')

    const result = hasAbsolutePaths(content)

    if (result.hasIssue) {
      logger.fail('Found absolute paths in bundle:')
      const matches = result.matches
      for (let i = 0, { length } = matches; i < length; i += 1) {
        logger.fail(`  - ${matches[i]!}`)
      }
    }

    expect(result.hasIssue, 'Bundle should not contain absolute paths').toBe(
      false,
    )
  })

  it('should not bundle dependencies inline (validate against package.json dependencies)', async () => {
    const indexPath = path.join(distPath, 'index.js')
    const content = await fs.readFile(indexPath, 'utf8')

    const result = await checkBundledDependencies(content)

    if (!result.hasNoBundledDeps) {
      logger.fail('Found bundled dependencies (should be external):')
      const deps = result.bundledDeps
      for (let i = 0, { length } = deps; i < length; i += 1) {
        logger.fail(`  - ${deps[i]!}`)
      }
    }

    expect(
      result.hasNoBundledDeps,
      'Dependencies from package.json should be external, not bundled inline',
    ).toBe(true)
  })

  it('browser bundle (dist/index.browser.js) is node-free', async () => {
    const browserPath = path.join(distPath, 'index.browser.js')
    const content = await fs.readFile(browserPath, 'utf8')

    // An MV3 service worker cannot resolve `node:*` (or bare builtin) imports; a
    // single one throws at module load and kills the whole worker. The browser
    // config shims every builtin the graph reaches, so the emitted bundle must
    // contain zero executable Node builtin imports/requires.
    const offenders = findNodeBuiltinImports(content)

    if (offenders.length) {
      logger.fail('Found Node builtin imports in the browser bundle:')
      for (let i = 0, { length } = offenders; i < length; i += 1) {
        logger.fail(`  - ${offenders[i]!}`)
      }
    }

    expect(
      offenders,
      'Browser bundle must not import any Node builtin (node:* or bare)',
    ).toEqual([])
  })
})
