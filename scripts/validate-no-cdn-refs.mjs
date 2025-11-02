#!/usr/bin/env node
/**
 * @fileoverview Validates that no files contain CDN references.
 * CDN usage is prohibited - use npm packages and bundle instead.
 *
 * Checks for:
 * - bundle.run
 * - cdnjs.cloudflare.com
 * - denopkg.com
 * - esm.run
 * - esm.sh
 * - jsdelivr.net (cdn.jsdelivr.net, fastly.jsdelivr.net)
 * - jspm.io/jspm.dev
 * - jsr.io
 * - Pika/Snowpack CDN
 * - skypack.dev
 * - unpkg.com
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')

// CDN patterns to detect
const CDN_PATTERNS = [
  {
    pattern: /bundle\.run/gi,
    name: 'bundle.run',
  },
  {
    pattern: /cdnjs\.cloudflare\.com/gi,
    name: 'cdnjs',
  },
  {
    pattern: /denopkg\.com/gi,
    name: 'denopkg',
  },
  {
    pattern: /esm\.run/gi,
    name: 'esm.run',
  },
  {
    pattern: /esm\.sh/gi,
    name: 'esm.sh',
  },
  {
    pattern: /cdn\.jsdelivr\.net|jsdelivr\.net|fastly\.jsdelivr\.net/gi,
    name: 'jsDelivr',
  },
  {
    pattern: /ga\.jspm\.io|jspm\.dev/gi,
    name: 'JSPM',
  },
  {
    pattern: /jsr\.io/gi,
    name: 'JSR',
  },
  {
    pattern: /cdn\.pika\.dev|cdn\.snowpack\.dev/gi,
    name: 'Pika/Snowpack CDN',
  },
  {
    pattern: /skypack\.dev|cdn\.skypack\.dev/gi,
    name: 'Skypack',
  },
  {
    pattern: /unpkg\.com/gi,
    name: 'unpkg',
  },
]

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.cache',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
])

// File extensions to check
const CHECK_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
  '.jsx',
  '.json',
  '.md',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.yaml',
  '.yml',
  '.toml',
])

/**
 * Recursively find all files to check.
 */
async function findFiles(dir, files = []) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await findFiles(fullPath, files)
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (CHECK_EXTENSIONS.has(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return files
}

/**
 * Check a file for CDN references.
 */
async function checkFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const violations = []

    // Skip this validation script itself (it contains CDN names in documentation)
    const relativePath = path.relative(rootPath, filePath)
    if (relativePath === 'scripts/validate-no-cdn-refs.mjs') {
      return []
    }

    for (const { pattern, name } of CDN_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0

      let match
      while ((match = pattern.exec(content)) !== null) {
        // Get line number
        const beforeMatch = content.substring(0, match.index)
        const lineNumber = beforeMatch.split('\n').length

        // Get context (line containing the match)
        const lines = content.split('\n')
        const line = lines[lineNumber - 1]

        violations.push({
          file: path.relative(rootPath, filePath),
          lineNumber,
          cdn: name,
          line: line.trim(),
          url: match[0],
        })
      }
    }

    return violations
  } catch (error) {
    // Skip files we can't read
    return []
  }
}

/**
 * Validate no CDN references exist.
 */
async function validateNoCdnRefs() {
  const files = await findFiles(rootPath)
  const allViolations = []

  for (const file of files) {
    const violations = await checkFile(file)
    allViolations.push(...violations)
  }

  return allViolations
}

async function main() {
  try {
    const violations = await validateNoCdnRefs()

    if (violations.length === 0) {
      console.log('✓ No CDN references found')
      process.exitCode = 0
      return
    }

    console.error('❌ CDN references found (prohibited)\n')
    console.error(
      'Public CDNs (cdnjs, unpkg, jsDelivr, esm.sh, JSR, etc.) are not allowed.\n',
    )
    console.error('Use npm packages and bundle instead.\n')

    // Group by file
    const byFile = new Map()
    for (const violation of violations) {
      if (!byFile.has(violation.file)) {
        byFile.set(violation.file, [])
      }
      byFile.get(violation.file).push(violation)
    }

    for (const [file, fileViolations] of byFile) {
      console.error(`  ${file}`)
      for (const violation of fileViolations) {
        console.error(`    Line ${violation.lineNumber}: ${violation.cdn}`)
        console.error(`      ${violation.line}`)
      }
      console.error('')
    }

    console.error('Replace CDN usage with:')
    console.error('  - npm install <package>')
    console.error('  - Import and bundle with your build tool')
    console.error('')

    process.exitCode = 1
  } catch (error) {
    console.error('Validation failed:', error.message)
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error('Validation failed:', error)
  process.exitCode = 1
})
