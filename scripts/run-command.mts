/**
 * @file Run build commands with explicit exit statuses.
 */

import type { SpawnOptions } from '@socketsecurity/lib-stable/process/spawn/types'

import { isWin32 } from '@socketsecurity/lib-stable/constants/platform'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'

export type RunOptions = SpawnOptions & {
  args?: readonly string[] | undefined
}

interface CommandSpec {
  command: string
  args?: string[] | undefined
  options?: SpawnOptions | undefined
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
