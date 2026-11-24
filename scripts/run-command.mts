/**
 * @file Run child commands with explicit exit statuses.
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

function getExitCode(result: unknown): number | undefined {
  if (typeof result !== 'object' || result === null) {
    return undefined
  }
  const signal = 'signal' in result ? result.signal : undefined
  const code = 'code' in result ? result.code : undefined
  if (signal != null) {
    return 1
  }
  if (typeof code === 'number') {
    return code
  }
  return 'code' in result && code == null ? 1 : undefined
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
    return getExitCode(result) ?? 1
  } catch (e) {
    // spawn() throws on a non-zero exit; signals may leave code null.
    const exitCode = getExitCode(e)
    if (exitCode !== undefined) {
      return exitCode
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
