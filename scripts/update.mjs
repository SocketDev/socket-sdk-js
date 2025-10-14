/**
 * @fileoverview Update script for the SDK.
 * Updates dependencies and regenerates lockfile.
 *
 * Usage:
 *   node scripts/update.mjs
 */

import {
  log,
  printError,
  printFooter,
  printHeader,
  printSuccess,
} from './utils/cli-helpers.mjs'
import { runCommand, runCommandQuiet } from './utils/run-command.mjs'

async function main() {
  try {
    printHeader('Updating Dependencies')

    // Update lockfile.
    log.progress('Updating pnpm-lock.yaml...')
    const lockResult = await runCommandQuiet('pnpm', ['install'], {
      cwd: process.cwd(),
    })

    if (lockResult.exitCode !== 0) {
      log.failed('Failed to update lockfile')
      if (lockResult.stderr) {
        console.error(lockResult.stderr)
      }
      process.exitCode = 1
      return
    }
    log.done('Updated pnpm-lock.yaml')

    // Update Socket packages.
    log.progress('Updating Socket packages...')
    const socketResult = await runCommand(
      'pnpm',
      [
        'update',
        '@socketsecurity/*',
        '@socketregistry/*',
        '--latest',
        '--no-workspace',
      ],
      {
        cwd: process.cwd(),
        stdio: 'pipe',
      },
    )

    if (socketResult !== 0) {
      log.failed('Failed to update Socket packages')
      process.exitCode = 1
      return
    }
    log.done('Updated Socket packages')

    // Update dependencies.
    log.progress('Checking for outdated dependencies...')
    const outdatedResult = await runCommandQuiet('pnpm', ['outdated'], {
      cwd: process.cwd(),
    })

    if (outdatedResult.stdout && outdatedResult.stdout.trim()) {
      console.log('\nOutdated dependencies:')
      console.log(outdatedResult.stdout)
      console.log('\nRun "pnpm run taze" to update them.')
    } else {
      log.done('All dependencies are up to date')
    }

    printSuccess('Update complete')
    printFooter()
  } catch (error) {
    printError(`Update failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(console.error)