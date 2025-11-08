#!/usr/bin/env node
/**
 * @fileoverview Check script that runs quality checks in parallel.
 * Runs TypeScript type checking and ESLint.
 *
 * Usage:
 *   node scripts/check.mjs
 *   pnpm run check
 */

import { spawn } from 'node:child_process'

/**
 * Run a command and return the exit code.
 */
function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

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
    // Run check using npm-run-all2 (run-p) to run checks in parallel
    // Explicitly list tasks to avoid infinite recursion
    const exitCode = await runCommand('pnpm', [
      'exec',
      'run-p',
      '-c',
      '--aggregate-output',
      'check:lint',
      'check:tsc',
    ])

    process.exitCode = exitCode
  } catch (error) {
    console.error(`Check failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
