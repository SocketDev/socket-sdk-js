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

import { logger } from '@socketsecurity/lib/logger'
import { printFooter, printHeader } from '@socketsecurity/lib/stdio/header'

import { runParallel } from './utils/run-command.mjs'

async function main() {
  try {
    printHeader('Check Runner')

    const checks = [
      {
        args: ['exec', 'tsgo', '--noEmit', '-p', '.config/tsconfig.check.json'],
        command: 'pnpm',
      },
      {
        args: [
          'exec',
          'eslint',
          '--config',
          '.config/eslint.config.mjs',
          '--report-unused-disable-directives',
          '.',
        ],
        command: 'pnpm',
      },
    ]

    const exitCodes = await runParallel(checks)
    const failed = exitCodes.some(code => code !== 0)

    if (failed) {
      logger.log('')
      logger.error('Some checks failed')
      process.exitCode = 1
    } else {
      logger.log('')
      logger.success('All checks passed!')
      printFooter()
    }
  } catch (error) {
    logger.log('')
    logger.error(`Check failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(console.error)
