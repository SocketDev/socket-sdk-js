#!/usr/bin/env node
/**
 * @fileoverview Lint script that runs oxlint for fast linting.
 *
 * Usage:
 *   node scripts/lint.mjs [options]
 *   pnpm run lint
 *   pnpm run lint -- --fix     (to auto-fix issues)
 *   pnpm run lint -- --all     (lint all files, ignore changes)
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * Parse command line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2)
  return {
    fix: args.includes('--fix'),
    all: args.includes('--all'),
    help: args.includes('--help') || args.includes('-h'),
    // Get remaining positional arguments (file paths)
    files: args.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'))
  }
}

/**
 * Run a command and return the exit code.
 */
function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32'
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
  const options = parseArgs()

  if (options.help) {
    console.log('Lint Runner')
    console.log('')
    console.log('Usage: node scripts/lint.mjs [options] [files...]')
    console.log('')
    console.log('Options:')
    console.log('  --fix      Automatically fix linting issues')
    console.log('  --all      Lint all files (ignore git changes)')
    console.log('  --help     Show this help message')
    console.log('')
    console.log('Examples:')
    console.log('  pnpm run lint')
    console.log('  pnpm run lint -- --fix')
    console.log('  pnpm run lint -- --all')
    console.log('  pnpm run lint -- --fix --all')
    console.log('  pnpm run lint -- src/index.ts')
    process.exitCode = 0
    return
  }

  try {
    // Build oxlint command arguments
    const oxlintArgs = [
      'exec',
      'oxlint',
      '-c=.oxlintrc.json',
      '--ignore-path=.oxlintignore',
      '--tsconfig=tsconfig.json'
    ]

    // Add fix flag if requested
    if (options.fix) {
      oxlintArgs.push('--fix')
    }

    // Add files or all flag
    if (options.files.length > 0) {
      // Lint specific files
      oxlintArgs.push(...options.files)
    } else if (options.all) {
      // Lint all files explicitly
      oxlintArgs.push('.')
    } else {
      // Default: lint all files
      oxlintArgs.push('.')
    }

    // Run oxlint with the project configuration
    // Only use dotenvx if .env.local exists
    const useEnvFile = existsSync('.env.local')
    let exitCode
    if (useEnvFile) {
      exitCode = await runCommand('pnpm', [
        'exec',
        'dotenvx',
        '-q',
        'run',
        '-f',
        '.env.local',
        '--',
        'pnpm',
        ...oxlintArgs
      ])
    } else {
      exitCode = await runCommand('pnpm', oxlintArgs)
    }

    process.exitCode = exitCode
  } catch (error) {
    console.error(`Lint failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
