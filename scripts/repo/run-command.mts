/**
 * @file Utility for running shell commands with proper error handling.
 */

import type {
  SpawnOptions,
  SpawnSyncOptions,
} from '@socketsecurity/lib-stable/process/spawn/types'

import { isWin32 } from '@socketsecurity/lib-stable/constants/platform'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import {
  spawn,
  spawnSync,
} from '@socketsecurity/lib-stable/process/spawn/child'

// Initialize logger
const logger = getDefaultLogger()

/**
 * Spawn options plus the argv the command receives. `args` rides in the bag
 * rather than sitting in front of it, so a call site that passes only options
 * reads as one labeled argument instead of an empty array placeholder.
 */
export type RunOptions = SpawnOptions & {
  args?: readonly string[] | undefined
}

/**
 * The sync twin of {@link RunOptions}.
 */
export type RunSyncOptions = SpawnSyncOptions & {
  args?: readonly string[] | undefined
}

interface CommandSpec {
  command: string
  args?: string[] | undefined
  options?: SpawnOptions | undefined
}

interface QuietResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Log and run a command.
 */
export async function logAndRun(
  description: string,
  command: string,
  options: RunOptions = {},
): Promise<number> {
  logger.log(description)
  return runCommand(command, options)
}

/**
 * Run a command and return a promise that resolves with the exit code.
 */
export async function runCommand(
  command: string,
  options: RunOptions = {},
): Promise<number> {
  const { args = [], ...spawnOptions } = options
  try {
    const result = await spawn(command, [...args], {
      stdio: 'inherit',
      shell: isWin32(),
      ...spawnOptions,
    })
    return result.code
  } catch (e) {
    // spawn() from @socketsecurity/lib-stable throws on non-zero exit
    // Return the exit code from the error
    if (typeof e === 'object' && e !== null && 'code' in e) {
      return e.code as number
    }
    throw e
  }
}

/**
 * Run a command and suppress output.
 */
export async function runCommandQuiet(
  command: string,
  options: RunOptions = {},
): Promise<QuietResult> {
  const { args = [], ...spawnOptions } = options
  try {
    const result = await spawn(command, [...args], {
      ...spawnOptions,
      shell: isWin32(),
      stdio: 'pipe',
      stdioString: true,
    })

    return {
      exitCode: result.code,
      stderr: result.stderr,
      stdout: result.stdout,
    }
  } catch (e) {
    // spawn() from @socketsecurity/lib-stable throws on non-zero exit
    // Return the exit code and output from the error
    if (
      typeof e === 'object' &&
      e !== null &&
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
 * Run a command synchronously.
 */
export function runCommandSync(
  command: string,
  options: RunSyncOptions = {},
): number {
  const { args = [], ...spawnOptions } = options
  const result = spawnSync(command, [...args], {
    stdio: 'inherit',
    ...spawnOptions,
  })
  return result.status || 0
}

/**
 * Run multiple commands in parallel.
 */
export async function runParallel(commands: CommandSpec[]): Promise<number[]> {
  const promises = commands.map(({ args = [], command, options = {} }) =>
    runCommand(command, { ...options, args }),
  )
  const results = await Promise.allSettled(promises)
  return results.map(r => (r.status === 'fulfilled' ? r.value : 1))
}

/**
 * Run a pnpm script.
 */
export async function runPnpmScript(
  scriptName: string,
  options: RunOptions = {},
): Promise<number> {
  const { args = [], ...spawnOptions } = options
  return runCommand('pnpm', {
    ...spawnOptions,
    args: ['run', scriptName, ...args],
  })
}

/**
 * Run multiple commands in sequence, stopping on first failure.
 */
export async function runSequence(commands: CommandSpec[]): Promise<number> {
  for (let i = 0, { length } = commands; i < length; i += 1) {
    const spec = commands[i]!
    const exitCode = await runCommand(spec.command, {
      ...spec.options,
      args: spec.args ?? [],
    })
    if (exitCode !== 0) {
      return exitCode
    }
  }
  return 0
}
