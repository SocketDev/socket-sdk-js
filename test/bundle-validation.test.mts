/**
 * @fileoverview Bundle validation tests to ensure build output quality.
 * Verifies that dist files don't contain absolute paths or external dependencies.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagePath = path.resolve(__dirname, '..')
const distPath = path.join(packagePath, 'dist')

/**
 * Check if content contains absolute paths.
 * Detects paths like /Users/, C:\, /home/, etc.
 */
function hasAbsolutePaths(content: string): {
  hasIssue: boolean
  matches: string[]
} {
  // Match absolute paths but exclude URLs and node: protocol.
  const patterns = [
    // Match require('/abs/path') or require('C:\\path').
    /require\(["'](?:\/[^"'\n]+|[A-Z]:\\[^"'\n]+)["']\)/g,
    // Match import from '/abs/path'.
    /import\s+.*?from\s+["'](?:\/[^"'\n]+|[A-Z]:\\[^"'\n]+)["']/g,
  ]

  const matches: string[] = []
  for (const pattern of patterns) {
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

/**
 * Check if bundle contains inlined dependencies.
 * Reads package.json dependencies and ensures they are NOT bundled inline.
 */
async function checkBundledDependencies(content: string): Promise<{
  bundledDeps: string[]
  hasNoBundledDeps: boolean
}> {
  // Read package.json to get runtime dependencies.
  const pkgJsonPath = path.join(packagePath, 'package.json')
  const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf8'))
  const dependencies = pkgJson.dependencies || {}

  const bundledDeps: string[] = []

  // If we have NO dependencies, check that no external packages are bundled.
  if (Object.keys(dependencies).length === 0) {
    // Look for signs of bundled npm packages in ESM format.
    // Bundled ESM packages have patterns like:
    // - import { x } from "inline-bundled-code"
    // - Functions from external packages inlined directly.
    const bundledPackagePatterns = [
      // Socket packages that should always be external.
      /@socketsecurity\/lib/,
      /@socketsecurity\/packageurl-js/,
      /@socketsecurity\/sdk/,
      /@socketsecurity\/registry/,
    ]

    for (const pattern of bundledPackagePatterns) {
      // For ESM bundles, check if imports are to external packages (good)
      // vs having the code inlined (bad).
      // Look for: import ... from "@socketsecurity/lib" (external - good)
      // vs: no imports but code from the package is present (bundled - bad).
      const hasExternalImport = new RegExp(
        `import\\s+.*?from\\s+["']${pattern.source}`,
      ).test(content)

      // If no external import found, check if package code might be bundled.
      // This is a heuristic - look for multiple characteristic functions.
      if (!hasExternalImport) {
        // Check for signs of bundled code from this package.
        // This would mean the package wasn't properly externalized.
        const bundlePattern = new RegExp(
          `(?:var|const|let)\\s+\\w+.*${pattern.source}`,
        )

        if (bundlePattern.test(content)) {
          bundledDeps.push(pattern.source)
        }
      }
    }
  } else {
    // If we have dependencies, check that they remain external (not bundled).
    for (const dep of Object.keys(dependencies)) {
      const escapedDep = dep.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')

      // Check if dependency is properly external.
      const hasExternalImport = new RegExp(
        `import\\s+.*?from\\s+["']${escapedDep}`,
      ).test(content)

      // If no external import, it might be bundled.
      if (!hasExternalImport) {
        const bundlePattern = new RegExp(
          `(?:var|const|let)\\s+\\w+.*${escapedDep}`,
        )

        if (bundlePattern.test(content)) {
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

describe('Bundle validation', () => {
  it('should not contain absolute paths in dist/index.mjs', async () => {
    const indexPath = path.join(distPath, 'index.mjs')
    const content = await fs.readFile(indexPath, 'utf8')

    const result = hasAbsolutePaths(content)

    if (result.hasIssue) {
      console.error('Found absolute paths in bundle:')
      for (const match of result.matches) {
        console.error(`  - ${match}`)
      }
    }

    expect(result.hasIssue, 'Bundle should not contain absolute paths').toBe(
      false,
    )
  })

  it('should not bundle dependencies inline (validate against package.json dependencies)', async () => {
    const indexPath = path.join(distPath, 'index.mjs')
    const content = await fs.readFile(indexPath, 'utf8')

    const result = await checkBundledDependencies(content)

    if (!result.hasNoBundledDeps) {
      console.error('Found bundled dependencies (should be external):')
      for (const dep of result.bundledDeps) {
        console.error(`  - ${dep}`)
      }
    }

    expect(
      result.hasNoBundledDeps,
      'Dependencies from package.json should be external, not bundled inline',
    ).toBe(true)
  })
})
