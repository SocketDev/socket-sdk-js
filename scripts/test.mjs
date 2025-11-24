#!/usr/bin/env node
/**
 * @fileoverview Test script that runs checks, build, and tests in sequence.
 *
 * Usage:
 *   node scripts/test.mjs [options]
 *   pnpm run test
 *   pnpm run test -- --all        (run all tests)
 *   pnpm run test -- --update     (update snapshots)
 *   pnpm run test -- --coverage   (run with coverage)
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * Parse command line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2)
  return {
    all: args.includes('--all'),
    update: args.includes('--update'),
    coverage: args.includes('--coverage') || args.includes('--cover'),
    help: args.includes('--help') || args.includes('-h'),
    // Get remaining arguments to pass to vitest
    extra: args.filter(
      arg =>
        ![
          '--all',
          '--update',
          '--coverage',
          '--cover',
          '--help',
          '-h'
        ].includes(arg)
    )
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
    console.log('Test Runner')
    console.log('')
    console.log('Usage: node scripts/test.mjs [options]')
    console.log('')
    console.log('Options:')
    console.log('  --all          Run all tests (ignore changes)')
    console.log('  --update       Update test snapshots')
    console.log('  --coverage     Run tests with coverage report')
    console.log('  --help         Show this help message')
    console.log('')
    console.log('Examples:')
    console.log('  pnpm run test')
    console.log('  pnpm run test -- --all')
    console.log('  pnpm run test -- --coverage')
    console.log('  pnpm run test -- --update')
    process.exitCode = 0
    return
  }

  try {
    // Check if .env.test exists
    const useEnvFile = existsSync('.env.test')

    // Step 1: Run checks
    console.log('Running checks...')
    let exitCode = await runCommand('pnpm', [
      'exec',
      'run-p',
      '-c',
      '--aggregate-output',
      'check:*'
    ])
    if (exitCode !== 0) {
      console.error('Checks failed')
      process.exitCode = exitCode
      return
    }

    // Step 2: Run test:prepare (build)
    console.log('\nPreparing tests (building)...')
    if (useEnvFile) {
      exitCode = await runCommand('pnpm', [
        'exec',
        'dotenvx',
        '-q',
        'run',
        '-f',
        '.env.test',
        '--',
        'pnpm',
        'run',
        'build'
      ])
    } else {
      exitCode = await runCommand('pnpm', ['run', 'build'])
    }
    if (exitCode !== 0) {
      console.error('Build failed')
      process.exitCode = exitCode
      return
    }

    // Step 3: Run vitest
    console.log('\nRunning tests...')
    const vitestArgs = ['exec', 'vitest', '--run']

    // Add coverage flag if requested
    if (options.coverage) {
      vitestArgs.push('--coverage')
    }

    // Add update flag if requested
    if (options.update) {
      vitestArgs.push('--update')
    }

    // Add any extra arguments
    if (options.extra.length > 0) {
      vitestArgs.push(...options.extra)
    }

    if (useEnvFile) {
      exitCode = await runCommand('pnpm', [
        'exec',
        'dotenvx',
        '-q',
        'run',
        '-f',
        '.env.test',
        '--',
        'pnpm',
        ...vitestArgs
      ])
    } else {
      exitCode = await runCommand('pnpm', vitestArgs)
    }

    process.exitCode = exitCode
  } catch (error) {
    console.error(`Test failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
