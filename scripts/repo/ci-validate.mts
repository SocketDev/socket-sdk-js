/**
 * @file CI validation script for publishing workflow. Runs test, check, and
 *   build steps in sequence.
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { errorMessage } from '@socketsecurity/lib-stable/errors/message'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { printHeader } from '@socketsecurity/lib-stable/stdio/header'
import { isMainModule } from '../fleet/process/is-main-module.mts'
import { runMain } from '../fleet/process/run-main.mts'

const logger = getDefaultLogger()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '..')

export async function runCommand(
  command: string,
  options: { args?: string[] | undefined } = {},
): Promise<number> {
  const { args = [] } = options
  return new Promise<number>((resolve, reject) => {
    const spawnPromise = spawn(command, args, {
      cwd: rootPath,
      stdio: 'inherit',
    })

    const child = spawnPromise.process

    child.on('exit', (code: number | null) => {
      resolve(code || 0)
    })

    child.on('error', (e: Error) => {
      reject(e)
    })
  })
}

async function main(): Promise<void> {
  try {
    printHeader('CI Validation')

    // Run tests
    logger.step('Running tests')
    let exitCode = await runCommand('pnpm', { args: ['test', '--all'] })
    if (exitCode !== 0) {
      logger.error('Tests failed')
      process.exitCode = exitCode
      return
    }
    logger.success('Tests passed')

    // Run checks
    logger.step('Running checks')
    exitCode = await runCommand('pnpm', { args: ['check', '--all'] })
    if (exitCode !== 0) {
      logger.error('Checks failed')
      process.exitCode = exitCode
      return
    }
    logger.success('Checks passed')

    // Run build
    logger.step('Building project')
    exitCode = await runCommand('pnpm', { args: ['build'] })
    if (exitCode !== 0) {
      logger.error('Build failed')
      process.exitCode = exitCode
      return
    }
    logger.success('Build completed')

    logger.success('CI validation completed successfully!')
  } catch (e) {
    logger.error(`CI validation failed: ${errorMessage(e)}`)
    process.exitCode = 1
  }
}

const SCRIPT_META = {
  describe: 'validate SDK build and generated artifacts',
  help: `Usage: pnpm run ci:validate\n\n--help, -h  show usage\n--describe  show purpose`,
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
