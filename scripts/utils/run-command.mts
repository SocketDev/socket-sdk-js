/** @fileoverview Utility for running shell commands with proper error handling. */

import process from 'node:process'

import type { SpawnOptions, SpawnSyncOptions } from '@socketsecurity/lib/spawn'

import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { spawn, spawnSync } from '@socketsecurity/lib/spawn'

// Initialize logger
const logger = getDefaultLogger()

interface CommandSpec {
  command: string
  args?: string[]
  options?: SpawnOptions
}

interface QuietResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Run a command and return a promise that resolves with the exit code.
 */
export async function runCommand(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
): Promise<number> {
  try {
    const result = await spawn(command, args, {
      stdio: 'inherit',
      ...(process.platform === 'win32' && { shell: true }),
      ...options,
    })
    return result.code
  } catch (e) {
    // spawn() from @socketsecurity/lib throws on non-zero exit
    // Return the exit code from the error
    if (e && typeof e === 'object' && 'code' in e) {
      return e.code as number
    }
    throw e
  }
}

/**
 * Run a command synchronously.
 */
export function runCommandSync(
  command: string,
  args: string[] = [],
  options: SpawnSyncOptions = {},
): number {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })
  return result.status || 0
}

/**
 * Run a pnpm script.
 */
export async function runPnpmScript(
  scriptName: string,
  extraArgs: string[] = [],
  options: SpawnOptions = {},
): Promise<number> {
  return runCommand('pnpm', ['run', scriptName, ...extraArgs], options)
}

/**
 * Run multiple commands in sequence, stopping on first failure.
 */
export async function runSequence(commands: CommandSpec[]): Promise<number> {
  for (const { args = [], command, options = {} } of commands) {
    const exitCode = await runCommand(command, args, options)
    if (exitCode !== 0) {
      return exitCode
    }
  }
  return 0
}

/**
 * Run multiple commands in parallel.
 */
export async function runParallel(commands: CommandSpec[]): Promise<number[]> {
  const promises = commands.map(({ args = [], command, options = {} }) =>
    runCommand(command, args, options),
  )
  const results = await Promise.allSettled(promises)
  return results.map(r => (r.status === 'fulfilled' ? r.value : 1))
}

/**
 * Run a command and suppress output.
 */
export async function runCommandQuiet(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
): Promise<QuietResult> {
  try {
    const result = await spawn(command, args, {
      ...options,
      ...(process.platform === 'win32' && { shell: true }),
      stdio: 'pipe',
      stdioString: true,
    })

    return {
      exitCode: result.code,
      stderr: result.stderr as string,
      stdout: result.stdout as string,
    }
  } catch (e) {
    // spawn() from @socketsecurity/lib throws on non-zero exit
    // Return the exit code and output from the error
    if (
      e &&
      typeof e === 'object' &&
      'code' in e &&
      'stdout' in e &&
      'stderr' in e
    ) {
      return {
        exitCode: e.code as number,
        stderr: e.stderr as string,
        stdout: e.stdout as string,
      }
    }
    throw e
  }
}

/**
 * Log and run a command.
 */
export async function logAndRun(
  description: string,
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
): Promise<number> {
  logger.log(description)
  return runCommand(command, args, options)
}
