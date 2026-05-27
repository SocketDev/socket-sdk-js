#!/usr/bin/env node
/**
 * @file Validates that the bundler configuration keeps minification off.
 *   Minification breaks ESM/CJS interop and makes debugging harder. The SDK
 *   migrated from esbuild to rolldown; this gate now reads the rolldown config
 *   and asserts `buildConfig.output.minify === false`. (Filename kept for the
 *   fleet-canonical check wiring; the rule it enforces is unchanged.)
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

const logger = getDefaultLogger()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')

interface MinifyViolation {
  config: string
  value: unknown
  message: string
  location: string
}

/**
 * Validate the rolldown build config has `output.minify: false`.
 */
async function validateMinify(): Promise<MinifyViolation[]> {
  const configPath = path.join(rootPath, '.config/rolldown.config.mts')

  try {
    // oxlint-disable-next-line socket/no-dynamic-import-outside-bundle -- config path is computed at runtime.
    const config = await import(configPath)

    const violations: MinifyViolation[] = []

    const output = config.buildConfig?.output
    if (output && output.minify !== false) {
      violations.push({
        config: 'buildConfig.output',
        value: output.minify,
        message: 'buildConfig.output.minify must be false',
        location: configPath,
      })
    }

    return violations
  } catch (e) {
    logger.error(
      `Failed to load rolldown config: ${e instanceof Error ? e.message : String(e)}`,
    )
    process.exitCode = 1
    return []
  }
}

async function main(): Promise<void> {
  const violations = await validateMinify()

  if (violations.length === 0) {
    logger.success('bundler minify validation passed')
    process.exitCode = 0
    return
  }

  logger.fail('bundler minify validation failed')
  logger.error('')

  for (let i = 0, { length } = violations; i < length; i += 1) {
    const violation = violations[i]!
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

main().catch((e: unknown) => {
  logger.error('Validation failed:', e)
  process.exitCode = 1
})
