#!/usr/bin/env node
/**
 * @fileoverview Test script that ensures dist/ is built before running tests.
 * Used by pre-commit hooks to ensure tests can import from ../dist/index.
 * Uses affected testing based on staged changes.
 */

import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')

// Check if dist/index.js exists
const distIndexPath = resolve(projectRoot, 'dist/index.js')

if (!existsSync(distIndexPath)) {
  console.log('dist/ not found, building...')
  try {
    execSync('pnpm run build', {
      cwd: projectRoot,
      stdio: 'inherit',
    })
  } catch (error) {
    console.error('Build failed')
    process.exit(1)
  }
}

// Run affected tests based on staged changes
try {
  execSync('node scripts/test-affected.mjs --staged', {
    cwd: projectRoot,
    stdio: 'inherit',
  })
} catch (error) {
  process.exit(1)
}
