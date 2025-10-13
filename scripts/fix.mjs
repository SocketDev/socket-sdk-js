/**
 * @fileoverview Auto-fix script for the SDK.
 * Runs linting with auto-fix enabled.
 *
 * Usage:
 *   node scripts/fix.mjs
 */

import { logger } from '@socketsecurity/registry/lib/logger'
import { printFooter, printHeader } from '@socketsecurity/registry/lib/stdio/header'

import { runSequence } from './utils/run-command.mjs'

async function main() {
  try {
    printHeader('Running Auto-fix')

    const commands = [
      {
        args: ['run', 'lint', '--fix'],
        command: 'pnpm',
      },
    ]

    const exitCode = await runSequence(commands)

    if (exitCode !== 0) {
      logger.error('Some fixes could not be applied')
      process.exitCode = 1
    } else {
      logger.success('Linting passed')
      printFooter()
    }
  } catch (error) {
    logger.error(`Fix failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(console.error)