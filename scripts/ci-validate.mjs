/**
 * @fileoverview CI validation script for publishing workflow.
 * Runs test, check, and build steps in sequence.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { spawn } from '@socketsecurity/lib/spawn'
import { printHeader } from '@socketsecurity/lib/stdio/header'

const logger = getDefaultLogger()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '..')

async function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const spawnPromise = spawn(command, args, {
      cwd: rootPath,
      stdio: 'inherit',
    })

    const child = spawnPromise.process

    child.on('exit', code => {
      resolve(code || 0)
    })

    child.on('error', error => {
      reject(error)
    })
  })
}

async function main() {
  try {
    printHeader('CI Validation')

    // Run tests
    logger.step('Running tests')
    let exitCode = await runCommand('pnpm', ['test', '--all'])
    if (exitCode !== 0) {
      logger.error('Tests failed')
      process.exitCode = exitCode
      return
    }
    logger.success('Tests passed')

    // Run checks
    logger.step('Running checks')
    exitCode = await runCommand('pnpm', ['check', '--all'])
    if (exitCode !== 0) {
      logger.error('Checks failed')
      process.exitCode = exitCode
      return
    }
    logger.success('Checks passed')

    // Run build
    logger.step('Building project')
    exitCode = await runCommand('pnpm', ['build'])
    if (exitCode !== 0) {
      logger.error('Build failed')
      process.exitCode = exitCode
      return
    }
    logger.success('Build completed')

    logger.success('CI validation completed successfully!')
  } catch (error) {
    logger.error(`CI validation failed: ${error.message}`)
    process.exitCode = 1
  }
}

main()
