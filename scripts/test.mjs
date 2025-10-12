/**
 * @fileoverview Unified test runner that provides a smooth, single-script experience.
 * Combines check, build, and test steps with clean, consistent output.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import WIN32 from '@socketsecurity/registry/lib/constants/WIN32'

import { getTestsToRun } from './utils/changed-test-mapper.mjs'
import { fileURLToPath } from 'node:url'

import { isQuiet } from '@socketsecurity/registry/lib/argv/flags'
import { log, printHeader, printFooter } from '@socketsecurity/registry/lib/cli/output'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '..')
const nodeModulesBinPath = path.join(rootPath, 'node_modules', '.bin')

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...(WIN32 && { shell: true }),
      ...options,
    })

    child.on('exit', code => {
      resolve(code || 0)
    })

    child.on('error', error => {
      reject(error)
    })
  })
}

async function runCheck() {
  log.step('Running checks')

  // Run fix (auto-format) quietly since it has its own output
  log.progress('Formatting code')
  let exitCode = await runCommand('pnpm', ['run', 'fix'], {
    stdio: 'pipe'
  })
  if (exitCode !== 0) {
    log.failed('Formatting failed')
    // Re-run with output to show errors
    await runCommand('pnpm', ['run', 'fix'])
    return exitCode
  }
  log.done('Code formatted')

  // Run ESLint to check for remaining issues
  log.progress('Checking ESLint')
  exitCode = await runCommand('eslint', [
    '--config',
    '.config/eslint.config.mjs',
    '--report-unused-disable-directives',
    '.'
  ], {
    stdio: 'pipe'
  })
  if (exitCode !== 0) {
    log.failed('ESLint failed')
    // Re-run with output to show errors
    await runCommand('eslint', [
      '--config',
      '.config/eslint.config.mjs',
      '--report-unused-disable-directives',
      '.'
    ])
    return exitCode
  }
  log.done('ESLint passed')

  // Run TypeScript check
  log.progress('Checking TypeScript')
  exitCode = await runCommand('tsgo', [
    '--noEmit',
    '-p',
    '.config/tsconfig.check.json'
  ], {
    stdio: 'pipe'
  })
  if (exitCode !== 0) {
    log.failed('TypeScript check failed')
    // Re-run with output to show errors
    await runCommand('tsgo', [
      '--noEmit',
      '-p',
      '.config/tsconfig.check.json'
    ])
    return exitCode
  }
  log.done('TypeScript check passed')

  return exitCode
}

async function runBuild() {
  const distIndexPath = path.join(rootPath, 'dist', 'index.js')
  if (!existsSync(distIndexPath)) {
    log.step('Building project')
    return runCommand('pnpm', ['run', 'build'])
  }
  return 0
}

async function runVitestWithArgs(args, options = {}) {
  const vitestCmd = WIN32 ? 'vitest.cmd' : 'vitest'
  const vitestPath = path.join(nodeModulesBinPath, vitestCmd)

  const vitestArgs = ['--config', '.config/vitest.config.mts', 'run']

  // Add coverage if requested
  if (options.coverage) {
    vitestArgs.push('--coverage')
  }

  // Add update if requested
  if (options.update) {
    vitestArgs.push('--update')
  }

  // Add provided arguments
  if (args && args.length > 0) {
    vitestArgs.push(...args)
  }

  const spawnOptions = {
    cwd: rootPath,
    env: {
      ...process.env,
      NODE_OPTIONS:
        `${process.env.NODE_OPTIONS || ''} --max-old-space-size=${process.env.CI ? 8192 : 4096}`.trim(),
    },
    stdio: 'inherit',
  }

  // Use dotenvx to load test environment
  const dotenvxPath = path.join(nodeModulesBinPath, WIN32 ? 'dotenvx.cmd' : 'dotenvx')
  return runCommand(dotenvxPath, [
    '-q',
    'run',
    '-f',
    '.env.test',
    '--',
    vitestPath,
    ...vitestArgs
  ], spawnOptions)
}

async function runTests(options) {
  const { all, coverage, force, positionals, staged, update } = options
  const runAll = all || force

  // If positional arguments provided, use them directly
  if (positionals && positionals.length > 0) {
    log.step(`Running specified tests: ${positionals.join(', ')}`)
    return runVitestWithArgs(positionals, { coverage, update })
  }

  // Get tests to run based on changes
  const testInfo = getTestsToRun({ staged, all: runAll })
  const { reason, tests: testsToRun, mode } = testInfo

  // No tests needed
  if (testsToRun === null) {
    log.substep('No relevant changes detected, skipping tests')
    return 0
  }

  // Add test patterns if not running all
  if (testsToRun === 'all') {
    log.step(`Running all tests (${reason})`)
    return runVitestWithArgs([], { coverage, update })
  } else {
    const modeText = mode === 'staged' ? 'staged' : 'changed'
    log.step(`Running tests for ${modeText} files:`)
    testsToRun.forEach(test => log.substep(test))
    return runVitestWithArgs(testsToRun, { coverage, update })
  }
}

async function main() {
  try {
    // Parse arguments
    const { positionals, values } = parseArgs({
      options: {
        help: {
          type: 'boolean',
          default: false,
        },
        fast: {
          type: 'boolean',
          default: false,
        },
        quick: {
          type: 'boolean',
          default: false,
        },
        'skip-build': {
          type: 'boolean',
          default: false,
        },
        'skip-checks': {
          type: 'boolean',
          default: false,
        },
        staged: {
          type: 'boolean',
          default: false,
        },
        all: {
          type: 'boolean',
          default: false,
        },
        force: {
          type: 'boolean',
          default: false,
        },
        cover: {
          type: 'boolean',
          default: false,
        },
        coverage: {
          type: 'boolean',
          default: false,
        },
        update: {
          type: 'boolean',
          default: false,
        },
      },
      allowPositionals: true,
      strict: false,
    })

    // Show help if requested
    if (values.help) {
      console.log('Test Runner')
      console.log('\nUsage: pnpm test [options] [test-files...]')
      console.log('\nOptions:')
      console.log('  --help              Show this help message')
      console.log('  --fast, --quick     Skip lint/type checks for faster execution')
      console.log('  --skip-checks       Skip lint/type checks (same as --fast)')
      console.log('  --skip-build        Skip the build step')
      console.log('  --cover, --coverage Run tests with code coverage')
      console.log('  --update            Update test snapshots')
      console.log('  --all, --force      Run all tests regardless of changes')
      console.log('  --staged            Run tests affected by staged changes')
      console.log('\nExamples:')
      console.log('  pnpm test                      # Run checks, build, and tests for changed files')
      console.log('  pnpm test --fast               # Skip checks for quick testing')
      console.log('  pnpm test --cover              # Run with coverage report')
      console.log('  pnpm test --all                # Run all tests')
      console.log('  pnpm test --staged             # Run tests for staged changes')
      console.log('  pnpm test "**/*.test.mts"      # Run specific test pattern')
      console.log('\nWhen called as test:run:')
      console.log('  pnpm test:run                  # Run only changed tests, no checks/build')
      console.log('  pnpm test:run --all            # Run all tests, no checks/build')
      process.exitCode = 0
      return
    }

    // Detect if called as test:run (from npm_lifecycle_event)
    const isTestRun = process.env.npm_lifecycle_event === 'test:run'

    // When called as test:run, default to skipping checks and build
    if (isTestRun && !values.help) {
      // Override defaults when called as test:run
      if (!values['skip-checks'] && !values.fast && !values.quick) {
        values['skip-checks'] = true
      }
      if (!values['skip-build']) {
        values['skip-build'] = true
      }
    }

    printHeader('Test Runner', { width: 56, borderChar: '=' })

    // Handle aliases
    const skipChecks = values.fast || values.quick || values['skip-checks']
    const withCoverage = values.cover || values.coverage

    let exitCode = 0

    // Run checks unless skipped
    if (!skipChecks) {
      exitCode = await runCheck()
      if (exitCode !== 0) {
        log.error('Checks failed')
        process.exitCode = exitCode
        return
      }
      log.success('All checks passed')
    }

    // Run build unless skipped
    if (!values['skip-build']) {
      exitCode = await runBuild()
      if (exitCode !== 0) {
        log.error('Build failed')
        process.exitCode = exitCode
        return
      }
    }

    // Run tests
    exitCode = await runTests({ ...values, coverage: withCoverage, positionals })

    if (exitCode !== 0) {
      log.error('Tests failed')
      process.exitCode = exitCode
    } else {
      printFooter('All tests passed!', { width: 56, borderChar: '=', color: 'green' })
    }
  } catch (error) {
    log.error(`Test runner failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(console.error)