/**
 * @fileoverview Unified test runner that provides a smooth, single-script experience.
 * Combines check, build, and test steps with clean, consistent output.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parseArgs } from '@socketsecurity/lib/argv/parse'
import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { onExit } from '@socketsecurity/lib/signal-exit'
import { getDefaultSpinner } from '@socketsecurity/lib/spinner'
import { printHeader } from '@socketsecurity/lib/stdio/header'

import { getTestsToRun } from './utils/changed-test-mapper.mts'

const WIN32 = process.platform === 'win32'

// Suppress non-fatal worker termination unhandled rejections
process.on(
  'unhandledRejection',
  (reason: unknown, _promise: Promise<unknown>) => {
    const errorMessage = String(
      (reason as Record<string, unknown> | null)?.['message'] || reason || '',
    )
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
  },
)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '..')
const nodeModulesBinPath = path.join(rootPath, 'node_modules', '.bin')

// Initialize logger and spinner
const logger = getDefaultLogger()
const spinner = getDefaultSpinner()

const tsConfigPath = '.config/tsconfig.check.json'

// Track running processes for cleanup
const runningProcesses = new Set<import('node:child_process').ChildProcess>()

// Setup exit handler
const removeExitHandler = onExit(
  (_code: number | null, signal: string | null) => {
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
      logger.log(`\nReceived ${signal}, cleaning up...`)
      // Let onExit handle the exit with proper code
      process.exitCode = 128 + (signal === 'SIGINT' ? 2 : 15)
    }
  },
)

interface CommandOutput {
  code: number
  stdout: string
  stderr: string
}

async function runCommand(
  command: string,
  args: string[] = [],
  options: Record<string, unknown> = {},
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...(process.platform === 'win32' && { shell: true }),
      ...options,
    })

    runningProcesses.add(child)

    child.on('exit', (code: number | null) => {
      runningProcesses.delete(child)
      resolve(code || 0)
    })

    child.on('error', (e: Error) => {
      runningProcesses.delete(child)
      reject(e)
    })
  })
}

async function runCommandWithOutput(
  command: string,
  args: string[] = [],
  options: Record<string, unknown> = {},
): Promise<CommandOutput> {
  return new Promise<CommandOutput>((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    const child = spawn(command, args, {
      ...(process.platform === 'win32' && { shell: true }),
      ...options,
    })

    runningProcesses.add(child)

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })
    }

    child.on('exit', (code: number | null) => {
      runningProcesses.delete(child)
      resolve({ code: code || 0, stdout, stderr })
    })

    child.on('error', (e: Error) => {
      runningProcesses.delete(child)
      reject(e)
    })
  })
}

async function runCheck(): Promise<number> {
  logger.step('Running checks')

  // Run fix (auto-format) quietly since it has its own output
  spinner.start('Formatting code...')
  let exitCode = await runCommand('pnpm', ['run', 'fix'], {
    stdio: 'pipe',
  })
  if (exitCode !== 0) {
    spinner.stop()
    logger.error('Formatting failed')
    // Re-run with output to show errors
    await runCommand('pnpm', ['run', 'fix'])
    return exitCode
  }
  spinner.stop()
  logger.success('Code formatted')

  // Run oxlint to check for remaining issues
  spinner.start('Running oxlint...')
  exitCode = await runCommand('oxlint', ['--config', '.oxlintrc.json', '.'], {
    stdio: 'pipe',
  })
  if (exitCode !== 0) {
    spinner.stop()
    logger.error('oxlint failed')
    // Re-run with output to show errors
    await runCommand('oxlint', ['--config', '.oxlintrc.json', '.'])
    return exitCode
  }
  spinner.stop()
  logger.success('oxlint passed')

  // Run TypeScript check
  spinner.start('Checking TypeScript...')
  exitCode = await runCommand('tsgo', ['--noEmit', '-p', tsConfigPath], {
    stdio: 'pipe',
  })
  if (exitCode !== 0) {
    spinner.stop()
    logger.error('TypeScript check failed')
    // Re-run with output to show errors
    await runCommand('tsgo', ['--noEmit', '-p', tsConfigPath])
    return exitCode
  }
  spinner.stop()
  logger.success('TypeScript check passed')

  return exitCode
}

async function runBuild(): Promise<number> {
  const distIndexPath = path.join(rootPath, 'dist', 'index.js')
  if (!existsSync(distIndexPath)) {
    logger.step('Building project')
    return runCommand('pnpm', ['run', 'build'])
  }
  return 0
}

interface TestOptions {
  all?: boolean
  coverage?: boolean
  force?: boolean
  staged?: boolean
  update?: boolean
}

async function runTests(
  options: TestOptions,
  positionals: string[] = [],
): Promise<number> {
  const { all, coverage, force, staged, update } = options
  const runAll = all || force

  // Get tests to run
  const testInfo = getTestsToRun({ staged: !!staged, all: !!runAll })
  const { mode, reason, tests: testsToRun } = testInfo

  // No tests needed
  if (testsToRun === undefined) {
    logger.substep('No relevant changes detected, skipping tests')
    return 0
  }

  // Prepare vitest command
  const vitestCmd = WIN32 ? 'vitest.cmd' : 'vitest'
  const vitestPath = path.join(nodeModulesBinPath, vitestCmd)

  const vitestArgs = ['--config', '.config/vitest.config.mts', 'run']

  // --passWithNoTests is only safe for scoped runs (specific test files from
  // the changed-file mapper, or user-supplied positional patterns). In those
  // cases, "no matching test file" is an expected non-failure — e.g., an edit
  // touches only non-testable code, or the user points vitest at a file
  // outside the test globs. For --all/--force runs (and the fallback where
  // the mapper returns 'all'), an empty test run is a real signal (e.g.,
  // wholesale test deletion, broken globs) and must surface as failure.
  const isScopedRun = testsToRun !== 'all' || positionals.length > 0
  if (isScopedRun) {
    vitestArgs.push('--passWithNoTests')
  }

  // Add coverage if requested
  if (coverage) {
    vitestArgs.push('--coverage')
  }

  // Add update if requested
  if (update) {
    vitestArgs.push('--update')
  }

  // Add test patterns if not running all
  if (testsToRun === 'all') {
    logger.step(`Running all tests (${reason})`)
  } else {
    const modeText = mode === 'staged' ? 'staged' : 'changed'
    logger.step(`Running tests for ${modeText} files:`)
    testsToRun.forEach(test => logger.substep(test))
    vitestArgs.push(...testsToRun)
  }

  // Add any additional positional arguments
  if (positionals.length > 0) {
    vitestArgs.push(...positionals)
  }

  const spawnOptions = {
    cwd: rootPath,
    env: {
      ...process.env,
      NODE_OPTIONS:
        `${process.env['NODE_OPTIONS'] || ''} --max-old-space-size=${process.env['CI'] ? 8192 : 4096} --unhandled-rejections=warn`.trim(),
      VITEST: '1',
    },
    stdio: 'inherit',
  }

  // Use interactive runner for interactive Ctrl+O experience when appropriate
  if (process.stdout.isTTY) {
    const { runTests } = await import('./utils/interactive-runner.mts')
    return runTests(vitestPath, vitestArgs, {
      env: spawnOptions.env,
      cwd: spawnOptions.cwd,
      verbose: false,
    })
  }

  // Fallback to execution with output capture to handle worker termination errors
  const result = await runCommandWithOutput(vitestPath, vitestArgs, {
    ...spawnOptions,
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  // Check if we have worker termination error but no test failures
  const output = result.stdout + result.stderr
  const hasWorkerTerminationError =
    output.includes('Terminating worker thread') ||
    output.includes('ThreadTermination')

  const hasTestFailures =
    output.includes('FAIL') ||
    (output.includes('Test Files') && output.match(/(\d+) failed/) !== null) ||
    (output.includes('Tests') && output.match(/Tests\s+\d+ failed/) !== null)

  // Filter out worker termination errors from output if no real test failures
  const shouldFilterWorkerErrors = hasWorkerTerminationError && !hasTestFailures

  const filterWorkerErrors = (text: string): string => {
    if (!shouldFilterWorkerErrors || !text) {
      return text
    }

    const lines = text.split('\n')
    const filtered = []
    let skipUntilBlankLine = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!

      // Start skipping when we hit the unhandled rejection header
      if (line.includes('⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯')) {
        skipUntilBlankLine = true
        continue
      }

      // Stop skipping after blank line following error block
      if (skipUntilBlankLine && line.trim() === '') {
        skipUntilBlankLine = false
        continue
      }

      // Skip lines that are part of worker termination error
      if (
        skipUntilBlankLine ||
        line.includes('Terminating worker thread') ||
        line.includes('ThreadTermination') ||
        line.includes('tinypool/dist/index.js')
      ) {
        continue
      }

      // Skip the "Command failed" line if it's only due to worker termination
      if (
        line.includes('Command failed with exit code 1') &&
        shouldFilterWorkerErrors
      ) {
        continue
      }

      filtered.push(line)
    }

    return filtered.join('\n')
  }

  // Print filtered output
  if (result.stdout) {
    process.stdout.write(filterWorkerErrors(result.stdout))
  }
  if (result.stderr) {
    process.stderr.write(filterWorkerErrors(result.stderr))
  }

  // Override exit code if we only have worker termination errors
  if (result.code !== 0 && hasWorkerTerminationError && !hasTestFailures) {
    return 0
  }

  return result.code
}

async function main(): Promise<void> {
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
    if (values['help']) {
      logger.log('Test Runner')
      logger.log('\nUsage: pnpm test [options] [-- vitest-args...]')
      logger.log('\nOptions:')
      logger.log('  --help              Show this help message')
      logger.log(
        '  --fast, --quick     Skip lint/type checks for faster execution',
      )
      logger.log('  --cover, --coverage Run tests with code coverage')
      logger.log('  --update            Update test snapshots')
      logger.log('  --all, --force      Run all tests regardless of changes')
      logger.log('  --staged            Run tests affected by staged changes')
      logger.log('  --skip-build        Skip the build step')
      logger.log('\nExamples:')
      logger.log(
        '  pnpm test                  # Run checks, build, and tests for changed files',
      )
      logger.log('  pnpm test --all            # Run all tests')
      logger.log('  pnpm test --fast           # Skip checks for quick testing')
      logger.log('  pnpm test --cover          # Run with coverage report')
      logger.log('  pnpm test --fast --cover   # Quick test with coverage')
      logger.log('  pnpm test --update         # Update test snapshots')
      logger.log('  pnpm test -- --reporter=dot # Pass args to vitest')
      process.exitCode = 0
      return
    }

    printHeader('Test Runner')

    // Handle aliases
    const skipChecks = values['fast'] || values['quick']
    const withCoverage = values['cover'] || values['coverage']

    let exitCode = 0
    const startTime = performance.now()

    // Run checks unless skipped
    if (!skipChecks) {
      exitCode = await runCheck()
      if (exitCode !== 0) {
        logger.error('Checks failed')
        process.exitCode = exitCode
        return
      }
      logger.success('All checks passed')
    }

    // Run build unless skipped
    if (!values['skip-build']) {
      exitCode = await runBuild()
      if (exitCode !== 0) {
        logger.error('Build failed')
        process.exitCode = exitCode
        return
      }
    }

    // Run tests
    const testStartTime = performance.now()
    exitCode = await runTests(
      {
        all: !!values['all'],
        coverage: !!withCoverage,
        force: !!values['force'],
        staged: !!values['staged'],
        update: !!values['update'],
      },
      positionals,
    )
    const testEndTime = performance.now()
    const testDuration = ((testEndTime - testStartTime) / 1000).toFixed(2)

    if (exitCode !== 0) {
      logger.error('Tests failed')
      process.exitCode = exitCode
    } else {
      logger.success('All tests passed!')
      const totalDuration = ((performance.now() - startTime) / 1000).toFixed(2)
      logger.progress(
        `Test execution: ${testDuration}s | Total: ${totalDuration}s`,
      )
    }
  } catch (e) {
    // Ensure spinner is stopped
    try {
      spinner.stop()
    } catch {}
    logger.error(
      `Test runner failed: ${e instanceof Error ? e.message : String(e)}`,
    )
    process.exitCode = 1
  } finally {
    // Ensure spinner is stopped
    try {
      spinner.stop()
    } catch {}
    removeExitHandler()
  }
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
