#!/usr/bin/env node
/**
 * @fileoverview Check script for the SDK.
 * Runs all quality checks in parallel:
 * - TypeScript type checking
 * - ESLint
 *
 * Usage:
 *   node scripts/check.mjs
 */

import { logger } from '@socketsecurity/registry/lib/logger'
import { runParallel } from './utils/run-command.mjs'

async function main() {
  try {
    logger.log('Running checks...')

    const checks = [
      {
        args: ['--noEmit', '-p', '.config/tsconfig.check.json'],
        command: 'tsgo',
      },
      {
        args: [
          '--config',
          '.config/eslint.config.mjs',
          '--report-unused-disable-directives',
          '.',
        ],
        command: 'eslint',
      },
    ]

    const exitCodes = await runParallel(checks)
    const failed = exitCodes.some(code => code !== 0)

    if (failed) {
      logger.error('Some checks failed')
      process.exitCode = 1
    } else {
      logger.log('All checks passed')
    }
  } catch (error) {
    logger.error('Check failed:', error.message)
    process.exitCode = 1
  }
}

main().catch(console.error)
