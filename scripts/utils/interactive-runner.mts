/**
 * @fileoverview Interactive runner for commands with ctrl+o toggle.
 * Standardized across all socket-* repositories.
 */

import process from 'node:process'

import { runWithMask } from '@socketsecurity/lib/stdio/mask'

interface RunWithOutputOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  message?: string
  toggleText?: string
  showOnError?: boolean
  verbose?: boolean
}

/**
 * Run a command with interactive output control.
 * Standard experience across all socket-* repos.
 */
export async function runWithOutput(
  command: string,
  args: string[] = [],
  options: RunWithOutputOptions = {},
): Promise<number> {
  const {
    cwd = process.cwd(),
    env = process.env,
    message = 'Running',
    toggleText = 'to see output',
    verbose = false,
  } = options

  return runWithMask(command, args, {
    cwd,
    env,
    message,
    showOutput: verbose,
    toggleText,
  })
}

/**
 * Standard test runner with interactive output.
 */
export async function runTests(
  command: string,
  args: string[],
  options: RunWithOutputOptions = {},
): Promise<number> {
  return runWithOutput(command, args, {
    message: 'Running tests',
    toggleText: 'to see test output',
    ...options,
  })
}

/**
 * Standard lint runner with interactive output.
 */
export async function runLint(
  command: string,
  args: string[],
  options: RunWithOutputOptions = {},
): Promise<number> {
  return runWithOutput(command, args, {
    message: 'Running linter',
    toggleText: 'to see lint results',
    ...options,
  })
}

/**
 * Standard build runner with interactive output.
 */
export async function runBuild(
  command: string,
  args: string[],
  options: RunWithOutputOptions = {},
): Promise<number> {
  return runWithOutput(command, args, {
    message: 'Building',
    toggleText: 'to see build output',
    ...options,
  })
}
