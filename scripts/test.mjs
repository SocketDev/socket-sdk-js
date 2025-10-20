#!/usr/bin/env node
/**
 * @fileoverview Improved test runner with progress bar and optimized performance.
 * Provides a smooth, single-script experience with minimal output by default.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '..')

// Check if we need to re-exec with loader
const registryPath = path.join(rootPath, '..', 'socket-registry', 'registry', 'dist')
if (existsSync(registryPath) && !process.env.SOCKET_LOADER_REGISTERED) {
  const loaderPath = path.join(__dirname, 'register-loader.mjs')
  const { spawnSync } = await import('node:child_process')
  const result = spawnSync(process.execPath, [
    '--import',
    loaderPath,
    ...process.execArgv,
    process.argv[1],
    ...process.argv.slice(2),
  ], {
    env: { ...process.env, SOCKET_LOADER_REGISTERED: '1' },
    stdio: 'inherit',
  })
  process.exit(result.status ?? 1)
}

// Now safe to import from registry (either with loader or published version)

import { isQuiet } from '@socketsecurity/registry/lib/argv/flags'
import { parseArgs } from '@socketsecurity/registry/lib/argv/parse'
import { logger } from '@socketsecurity/registry/lib/logger'
import { onExit } from '@socketsecurity/registry/lib/signal-exit'
import { spinner } from '@socketsecurity/registry/lib/spinner'
import { printHeader } from '@socketsecurity/registry/lib/stdio/header'

import { getTestsToRun } from './utils/changed-test-mapper.mjs'

const WIN32 = process.platform === 'win32'

// Suppress non-fatal worker termination unhandled rejections
process.on('unhandledRejection', (reason, _promise) => {
  const errorMessage = String(reason?.message || reason || '')
  // Filter out known non-fatal worker termination errors
  if (
    errorMessage.includes('Terminating worker thread') ||
    errorMessage.includes('ThreadTermination')
  ) {
    // Ignore these - they're cleanup messages from vitest worker threads
    return
  }
  // Re-throw other unhandled rejections
  throw reason
})

const nodeModulesBinPath = path.join(rootPath, 'node_modules', '.bin')

// Track running processes for cleanup
const runningProcesses = new Set()

// Setup exit handler
const removeExitHandler = onExit((_code, signal) => {
  // Stop spinner first
  try {
    spinner.stop()
  } catch {}

  // Kill all running processes
  for (const child of runningProcesses) {
    try {
      child.kill('SIGTERM')
    } catch {}
  }

  if (signal) {
    console.log(`\nReceived ${signal}, cleaning up...`)
    process.exit(128 + (signal === 'SIGINT' ? 2 : 15))
  }
})

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...(WIN32 && { shell: true }),
      ...options,
    })

    runningProcesses.add(child)

    child.on('exit', code => {
      runningProcesses.delete(child)
      resolve(code || 0)
    })

    child.on('error', error => {
      runningProcesses.delete(child)
      reject(error)
    })
  })
}

async function runCommandWithOutput(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    const child = spawn(command, args, {
      ...(WIN32 && { shell: true }),
      ...options,
    })

    runningProcesses.add(child)

    if (child.stdout) {
      child.stdout.on('data', data => {
        stdout += data.toString()
      })
    }

    if (child.stderr) {
      child.stderr.on('data', data => {
        stderr += data.toString()
      })
    }

    child.on('exit', code => {
      runningProcesses.delete(child)
      resolve({ code: code || 0, stdout, stderr })
    })

    child.on('error', error => {
      runningProcesses.delete(child)
      reject(error)
    })
  })
}

async function runCheck(options = {}) {
  const { quiet = false } = options

  if (!quiet) {
    logger.step('Running checks')
  }

  // Run fix (auto-format) quietly
  if (!quiet) {
    spinner.start('Formatting code...')
  }

  let result = await runCommandWithOutput('pnpm', ['run', 'fix'])
  if (result.code !== 0) {
    if (!quiet) {
      spinner.fail('Formatting failed')
    }
    if (result.stderr) {
      console.error(result.stderr)
    }
    return result.code
  }
  if (!quiet) {
    spinner.success('Code formatted')
    // Ensure spinner is fully cleared and we're on a fresh line
    process.stdout.write('\r\x1b[K\n')
  }

  // Run ESLint
  if (!quiet) {
    spinner.start('Running ESLint...')
  }
  result = await runCommandWithOutput('eslint', [
    '--config',
    '.config/eslint.config.mjs',
    '--report-unused-disable-directives',
    '.'
  ])

  if (result.code !== 0) {
    if (!quiet) {
      spinner.fail('Lint check failed')
    }
    if (result.stderr) {
      console.error(result.stderr)
    }
    if (result.stdout) {
      console.log(result.stdout)
    }
    return result.code
  }
  if (!quiet) {
    spinner.success('Lint check passed')
    // Ensure spinner is fully cleared and we're on a fresh line
    process.stdout.write('\r\x1b[K\n')
  }

  // Run TypeScript check
  if (!quiet) {
    spinner.start('Checking TypeScript...')
  }
  result = await runCommandWithOutput('tsgo', [
    '--noEmit',
    '-p',
    '.config/tsconfig.check.json'
  ])

  if (result.code !== 0) {
    if (!quiet) {
      spinner.fail('TypeScript check failed')
    }
    if (result.stderr) {
      console.error(result.stderr)
    }
    if (result.stdout) {
      console.log(result.stdout)
    }
    return result.code
  }
  if (!quiet) {
    spinner.success('TypeScript check passed')
    // Ensure spinner is fully cleared and we're on a fresh line
    process.stdout.write('\r\x1b[K\n')
  }

  return 0
}

async function runBuild() {
  const distIndexPath = path.join(rootPath, 'dist', 'index.js')
  if (!existsSync(distIndexPath)) {
    logger.step('Building project')
    return runCommand('pnpm', ['run', 'build'])
  }
  return 0
}

async function runVitestSimple(args, options = {}) {
  const { config = '.config/vitest.config.mts', coverage = false, interactive = true, quiet = false, update = false } = options

  const vitestCmd = WIN32 ? 'vitest.cmd' : 'vitest'
  const vitestPath = path.join(nodeModulesBinPath, vitestCmd)

  const vitestArgs = [
    '--config', config,
    'run'
  ]

  // Add coverage if requested
  if (coverage) {
    vitestArgs.push('--coverage')
  }

  // Add update if requested
  if (update) {
    vitestArgs.push('--update')
  }

  // Add provided arguments
  if (args && args.length > 0) {
    vitestArgs.push(...args)
  }

  const dotenvxPath = path.join(nodeModulesBinPath, WIN32 ? 'dotenvx.cmd' : 'dotenvx')

  // Clean environment for tests
  const env = { ...process.env }
  delete env.DEBUG
  delete env.NODE_DEBUG
  delete env.NODE_COMPILE_CACHE

  // Suppress debug output unless specifically requested
  env.LOG_LEVEL = 'error'
  env.DEBUG_HIDE_DATE = '1'

  // Set optimized memory settings
  // Suppress unhandled rejections from worker thread cleanup
  env.NODE_OPTIONS = '--max-old-space-size=2048 --unhandled-rejections=warn'

  // Use interactive runner if not quiet and TTY available
  if (!quiet && interactive && process.stdin.isTTY) {
    // Dynamically import the interactive runner
    const { runTests } = await import('./utils/interactive-runner.mjs')

    const exitCode = await runTests(dotenvxPath, [
      '-q',
      'run',
      '-f',
      '.env.test',
      '--',
      vitestPath,
      ...vitestArgs
    ], {
      cwd: rootPath,
      env
    })

    // If exit code is non-zero, check if it was only due to worker termination
    // This is a known non-fatal issue with vitest worker cleanup
    if (exitCode !== 0) {
      // For now, we trust that the test output showed the actual results
      // The worker termination happens after all tests complete
      // TODO: Parse output to verify all tests passed before overriding exit code
      return exitCode
    }

    return exitCode
  }

  // Fallback to simple execution - capture output to handle worker termination errors
  const result = await runCommandWithOutput(dotenvxPath, [
    '-q',
    'run',
    '-f',
    '.env.test',
    '--',
    vitestPath,
    ...vitestArgs
  ], {
    cwd: rootPath,
    env,
    stdio: ['inherit', 'pipe', 'pipe']
  })

  // Print output if not quiet
  if (!quiet) {
    if (result.stdout) {process.stdout.write(result.stdout)}
    if (result.stderr) {process.stderr.write(result.stderr)}
  }

  // Check if we have worker termination error but no test failures
  const hasWorkerTerminationError =
    (result.stdout + result.stderr).includes('Terminating worker thread') ||
    (result.stdout + result.stderr).includes('ThreadTermination')

  const output = result.stdout + result.stderr
  const hasTestFailures =
    output.includes('FAIL') ||
    output.includes('Test Files') && (output.match(/(\d+) failed/) !== null) ||
    output.includes('Tests') && (output.match(/Tests\s+\d+ failed/) !== null)

  // Override exit code if we only have worker termination errors
  if (result.code !== 0 && hasWorkerTerminationError && !hasTestFailures) {
    return 0
  }

  return result.code
}

async function runTests(options) {
  const { all, coverage, force, positionals, quiet, staged, update } = options
  const runAll = all || force

  // Load isolated tests list
  const isolatedTestsPath = path.join(rootPath, '.config', 'isolated-tests.json')
  let isolatedTests = []
  try {
    const isolatedTestsContent = await import('node:fs/promises').then(fs =>
      fs.readFile(isolatedTestsPath, 'utf8')
    )
    const isolatedTestsData = JSON.parse(isolatedTestsContent)
    isolatedTests = isolatedTestsData.tests || []
  } catch {
    // No isolated tests file, continue normally
  }

  // If positional arguments provided, use them directly
  if (positionals && positionals.length > 0) {
    // Separate isolated and regular tests
    const regularTests = positionals.filter(t => !isolatedTests.includes(t))
    const isolatedTestsToRun = positionals.filter(t => isolatedTests.includes(t))

    let exitCode = 0

    // Run regular tests
    if (regularTests.length > 0) {
      if (!quiet) {
        logger.step(`Running specified tests: ${regularTests.join(', ')}`)
      }
      exitCode = await runVitestSimple(regularTests, { coverage, update, quiet })
      if (exitCode !== 0) {return exitCode}
    }

    // Run isolated tests
    if (isolatedTestsToRun.length > 0) {
      if (!quiet) {
        logger.step(`Running isolated tests: ${isolatedTestsToRun.join(', ')}`)
      }
      exitCode = await runVitestSimple(isolatedTestsToRun, {
        coverage,
        update,
        quiet,
        config: '.config/vitest.config.isolated.mts'
      })
    }

    return exitCode
  }

  // Get tests to run based on changes
  const testInfo = getTestsToRun({ staged, all: runAll })
  const { mode, reason, tests: testsToRun } = testInfo

  // No tests needed
  if (testsToRun === null) {
    if (!quiet) {
      logger.substep('No relevant changes detected, skipping tests')
    }
    return 0
  }

  // Run tests
  if (testsToRun === 'all') {
    if (!quiet) {
      logger.step(`Running all tests (${reason})`)
    }

    let exitCode = 0

    // Run regular tests (exclude isolated tests)
    if (!quiet) {
      logger.substep('Running regular tests')
    }
    // Don't pass exclude args, vitest will run all tests in include pattern
    // and we'll run isolated tests separately
    exitCode = await runVitestSimple([], { coverage, update, quiet })
    if (exitCode !== 0) {return exitCode}

    // Run isolated tests
    if (isolatedTests.length > 0) {
      if (!quiet) {
        logger.substep('Running isolated tests')
      }
      exitCode = await runVitestSimple(isolatedTests, {
        coverage,
        update,
        quiet,
        config: '.config/vitest.config.isolated.mts'
      })
    }

    return exitCode
  } else {
    // Separate isolated and regular tests
    const regularTests = testsToRun.filter(t => !isolatedTests.includes(t))
    const isolatedTestsToRun = testsToRun.filter(t => isolatedTests.includes(t))

    let exitCode = 0

    // Run regular tests
    if (regularTests.length > 0) {
      const modeText = mode === 'staged' ? 'staged' : 'changed'
      if (!quiet) {
        logger.step(`Running tests for ${modeText} files:`)
        regularTests.forEach(test => logger.substep(test))
      }
      exitCode = await runVitestSimple(regularTests, { coverage, update, quiet })
      if (exitCode !== 0) {return exitCode}
    }

    // Run isolated tests
    if (isolatedTestsToRun.length > 0) {
      if (!quiet) {
        logger.step(`Running isolated tests:`)
        isolatedTestsToRun.forEach(test => logger.substep(test))
      }
      exitCode = await runVitestSimple(isolatedTestsToRun, {
        coverage,
        update,
        quiet,
        config: '.config/vitest.config.isolated.mts'
      })
    }

    return exitCode
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
        verbose: {
          type: 'boolean',
          default: false,
        },
        quiet: {
          type: 'boolean',
          default: false,
        },
        silent: {
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
      console.log('  --verbose           Show detailed test output')
      console.log('  --quiet, --silent   Minimal output')
      console.log('\nExamples:')
      console.log('  pnpm test                      # Run checks, build, and tests for changed files')
      console.log('  pnpm test --fast               # Skip checks for quick testing')
      console.log('  pnpm test --cover              # Run with coverage report')
      console.log('  pnpm test --all                # Run all tests')
      console.log('  pnpm test --staged             # Run tests for staged changes')
      console.log('  pnpm test "**/*.test.mts"      # Run specific test pattern')
      console.log('\nWhile tests are running:')
      console.log('  Press Ctrl+O to toggle verbose output')
      console.log('  Press Ctrl+C to cancel')
      process.exitCode = 0
      return
    }

    // Detect if called as test:run
    const isTestRun = process.env.npm_lifecycle_event === 'test:run'

    // When called as test:run, default to skipping checks and build
    if (isTestRun && !values.help) {
      if (!values['skip-checks'] && !values.fast && !values.quick) {
        values['skip-checks'] = true
      }
      if (!values['skip-build']) {
        values['skip-build'] = true
      }
    }

    const quiet = isQuiet(values)
    const verbose = values.verbose

    if (!quiet) {
      printHeader('Test Runner')
    }

    // Handle aliases
    const skipChecks = values.fast || values.quick || values['skip-checks']
    const withCoverage = values.cover || values.coverage

    let exitCode = 0

    // Run checks unless skipped
    if (!skipChecks) {
      exitCode = await runCheck({ quiet })
      if (exitCode !== 0) {
        if (!quiet) {
          logger.log('')
          console.log('Checks failed')
        }
        process.exitCode = exitCode
        return
      }
      if (!quiet) {
        logger.log('')
        logger.success('All checks passed')
      }
    }

    // Run build unless skipped
    if (!values['skip-build']) {
      exitCode = await runBuild()
      if (exitCode !== 0) {
        if (!quiet) {
          logger.log('')
          console.log('Build failed')
        }
        process.exitCode = exitCode
        return
      }
    }

    // Run tests
    exitCode = await runTests({
      ...values,
      coverage: withCoverage,
      positionals,
      verbose,
      quiet
    })

    if (exitCode !== 0) {
      if (!quiet) {
        logger.log('')
        console.log('Tests failed')
      }
      process.exitCode = exitCode
    } else {
      if (!quiet) {
        logger.log('')
        logger.success('All tests passed!')
      }
    }
  } catch (error) {
    // Ensure spinner is stopped
    try {
      spinner.stop()
    } catch {}
    logger.log('')
    console.log(`Test runner failed: ${error.message}`)
    process.exitCode = 1
  } finally {
    // Ensure spinner is stopped and cleared
    try {
      spinner.stop()
    } catch {}
    try {
      // Clear any remaining spinner output - multiple times to be sure
      process.stdout.write('\r\x1b[K')
      process.stdout.write('\r')
    } catch {}
    removeExitHandler()
    // Explicitly exit to prevent hanging
    process.exit(process.exitCode || 0)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})