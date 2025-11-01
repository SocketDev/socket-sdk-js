/**
 * @fileoverview Update script for the SDK.
 * Updates dependencies and regenerates lockfile.
 *
 * Usage:
 *   node scripts/update.mjs
 */

import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { printFooter, printHeader } from '@socketsecurity/lib/stdio/header'

import { runCommand, runCommandQuiet } from './utils/run-command.mjs'

// Initialize logger
const logger = getDefaultLogger()

async function main() {
  try {
    printHeader('Updating Dependencies')

    // Update lockfile.
    logger.progress('Updating pnpm-lock.yaml...')
    const lockResult = await runCommandQuiet('pnpm', ['install'], {
      cwd: process.cwd(),
    })

    if (lockResult.exitCode !== 0) {
      logger.clearLine().error('Failed to update lockfile')
      if (lockResult.stderr) {
        console.error(lockResult.stderr)
      }
      process.exitCode = 1
      return
    }
    logger.clearLine().done('Updated pnpm-lock.yaml')

    // Update Socket packages.
    logger.progress('Updating Socket packages...')
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
      logger.clearLine().error('Failed to update Socket packages')
      process.exitCode = 1
      return
    }
    logger.clearLine().done('Updated Socket packages')

    // Update dependencies.
    logger.progress('Checking for outdated dependencies...')
    const outdatedResult = await runCommandQuiet('pnpm', ['outdated'], {
      cwd: process.cwd(),
    })

    if (outdatedResult.stdout?.trim()) {
      logger.clearLine()
      console.log('\nOutdated dependencies:')
      console.log(outdatedResult.stdout)
      console.log('\nRun "pnpm run taze" to update them.')
    } else {
      logger.clearLine().done('All dependencies are up to date')
    }

    logger.log('')
    logger.success('Update complete')
    printFooter()
  } catch (error) {
    logger.log('')
    logger.error(`Update failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(e => {
  logger.error(e)
  process.exitCode = 1
})
