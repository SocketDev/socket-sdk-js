/**
 * @fileoverview Auto-fix script for the SDK.
 * Runs linting with auto-fix enabled.
 *
 * Usage:
 *   node scripts/fix.mjs
 */

import {
  printError,
  printFooter,
  printHeader,
  printSuccess,
} from './utils/cli-helpers.mjs'
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
      printError('Some fixes could not be applied')
      process.exitCode = 1
    } else {
      printSuccess('Linting passed')
      printFooter()
    }
  } catch (error) {
    printError(`Fix failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(console.error)