/** @fileoverview Utility for running shell commands with proper error handling. */

import { logger } from '@socketsecurity/lib/logger'
import { spawn, spawnSync } from '@socketsecurity/lib/spawn'


/**
 * Run a command and return a promise that resolves with the exit code.
 * @param {string} command - The command to run
 * @param {string[]} args - Arguments to pass to the command
 * @param {object} options - Spawn options
 * @returns {Promise<number>} Exit code
 */
export async function runCommand(command, args = [], options = {}) {
  const result = await spawn(command, args, {
    stdio: 'inherit',
    ...options,
  })
  return result.code
}

/**
 * Run a command synchronously.
 * @param {string} command - The command to run
 * @param {string[]} args - Arguments to pass to the command
 * @param {object} options - Spawn options
 * @returns {number} Exit code
 */
export function runCommandSync(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })
  return result.status || 0
}

/**
 * Run a pnpm script.
 * @param {string} scriptName - The pnpm script to run
 * @param {string[]} extraArgs - Additional arguments
 * @param {object} options - Spawn options
 * @returns {Promise<number>} Exit code
 */
export async function runPnpmScript(scriptName, extraArgs = [], options = {}) {
  return runCommand('pnpm', ['run', scriptName, ...extraArgs], options)
}

/**
 * Run multiple commands in sequence, stopping on first failure.
 * @param {Array<{command: string, args?: string[], options?: object}>} commands
 * @returns {Promise<number>} Exit code of first failing command, or 0 if all succeed
 */
export async function runSequence(commands) {
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
 * @param {Array<{command: string, args?: string[], options?: object}>} commands
 * @returns {Promise<number[]>} Array of exit codes
 */
export async function runParallel(commands) {
  const promises = commands.map(({ args = [], command, options = {} }) =>
    runCommand(command, args, options),
  )
  return Promise.all(promises)
}

/**
 * Run a command and capture output.
 * @param {string} command - The command to run
 * @param {string[]} args - Arguments to pass to the command
 * @param {object} options - Spawn options
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
export async function runCommandQuiet(command, args = [], options = {}) {
  const result = await spawn(command, args, {
    ...options,
    stdio: ['inherit', 'pipe', 'pipe'],
    stdioString: true,
  })

  return {
    exitCode: result.code,
    stderr: result.stderr,
    stdout: result.stdout,
  }
}

/**
 * Log and run a command.
 * @param {string} description - Description of what the command does
 * @param {string} command - The command to run
 * @param {string[]} args - Arguments
 * @param {object} options - Spawn options
 * @returns {Promise<number>} Exit code
 */
export async function logAndRun(description, command, args = [], options = {}) {
  logger.log(description)
  return runCommand(command, args, options)
}
