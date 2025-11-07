#!/usr/bin/env node
/**
 * @fileoverview Validates that esbuild configuration has minify: false.
 * Minification breaks ESM/CJS interop and makes debugging harder.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getDefaultLogger } from '@socketsecurity/lib/logger'

const logger = getDefaultLogger()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')

/**
 * Validate esbuild configuration has minify: false.
 */
async function validateEsbuildMinify() {
  const configPath = path.join(rootPath, '.config/esbuild.config.mjs')

  try {
    // Dynamic import of the esbuild config
    const config = await import(configPath)

    const violations = []

    // Check buildConfig
    if (config.buildConfig) {
      if (config.buildConfig.minify !== false) {
        violations.push({
          config: 'buildConfig',
          value: config.buildConfig.minify,
          message: 'buildConfig.minify must be false',
          location: `${configPath}:212`,
        })
      }
    }

    // Check watchConfig
    if (config.watchConfig) {
      if (config.watchConfig.minify !== false) {
        violations.push({
          config: 'watchConfig',
          value: config.watchConfig.minify,
          message: 'watchConfig.minify must be false',
          location: `${configPath}:248`,
        })
      }
    }

    return violations
  } catch (error) {
    logger.error(`Failed to load esbuild config: ${error.message}`)
    process.exitCode = 1
    return []
  }
}

async function main() {
  const violations = await validateEsbuildMinify()

  if (violations.length === 0) {
    logger.success('esbuild minify validation passed')
    process.exitCode = 0
    return
  }

  logger.error('❌ esbuild minify validation failed\n')

  for (const violation of violations) {
    logger.error(`  ${violation.message}`)
    logger.error(`  Found: minify: ${violation.value}`)
    logger.error('  Expected: minify: false')
    logger.error(`  Location: ${violation.location}`)
    logger.error('')
  }

  logger.error(
    'Minification breaks ESM/CJS interop and makes debugging harder.',
  )
  logger.error('')

  process.exitCode = 1
}

main().catch(error => {
  logger.error('Validation failed:', error)
  process.exitCode = 1
})
