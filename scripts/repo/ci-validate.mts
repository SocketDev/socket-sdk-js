/**
 * @file CI validation script for publishing workflow. Runs test, check, and
 *   build steps in sequence.
 */

import process from 'node:process'

import { errorMessage } from '@socketsecurity/lib-stable/errors/message'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { printHeader } from '@socketsecurity/lib-stable/stdio/header'
import { REPO_ROOT } from '../fleet/paths.mts'
import { isMainModule } from '../fleet/process/is-main-module.mts'
import type { ScriptMeta } from '../fleet/process/run-main.mts'

import { runMain } from '../fleet/process/run-main.mts'

const logger = getDefaultLogger()

export async function runCommand(
  command: string,
  options: { args?: string[] | undefined } = {},
): Promise<number> {
  const { args = [] } = options
  const result = await spawn(command, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    throws: false,
  })
  return result.signal ? 1 : (result.code ?? 1)
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

const SCRIPT_META: ScriptMeta = {
  describe: 'validate SDK build and generated artifacts',
  help: `Usage: pnpm run ci:validate\n\n--help, -h  show usage\n--describe  show purpose`,
  json: 'result',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
