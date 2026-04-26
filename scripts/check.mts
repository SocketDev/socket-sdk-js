#!/usr/bin/env node
/**
 * @fileoverview Check script for the SDK.
 * Runs all quality checks in parallel:
 * - Linting (via lint command)
 * - TypeScript type checking
 *
 * Usage:
 *   node scripts/check.mts [options]
 *
 * Options:
 *   --all      Run on all files (default behavior)
 *   --staged   Run on staged files only
 */

import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { printFooter } from '@socketsecurity/lib/stdio/footer'
import { printHeader } from '@socketsecurity/lib/stdio/header'

import { runParallel } from './utils/run-command.mts'

// Initialize logger
const logger = getDefaultLogger()

const tsConfigPath = '.config/tsconfig.check.json'

async function main(): Promise<void> {
  try {
    const all = process.argv.includes('--all')
    const staged = process.argv.includes('--staged')
    const help = process.argv.includes('--help') || process.argv.includes('-h')

    if (help) {
      logger.log('Check Runner')
      logger.log('\nUsage: node scripts/check.mts [options]')
      logger.log('\nOptions:')
      logger.log('  --help, -h     Show this help message')
      logger.log('  --all          Run on all files (default behavior)')
      logger.log('  --staged       Run on staged files only')
      logger.log('\nExamples:')
      logger.log('  node scripts/check.mts          # Run on all files')
      logger.log(
        '  node scripts/check.mts --all    # Run on all files (explicit)',
      )
      logger.log('  node scripts/check.mts --staged # Run on staged files')
      process.exitCode = 0
      return
    }

    printHeader('Check Runner')

    // Delegate to lint command with appropriate flags
    const lintArgs = ['run', 'lint']
    if (all) {
      lintArgs.push('--all')
    } else if (staged) {
      lintArgs.push('--staged')
    }

    const checks = [
      {
        args: lintArgs,
        command: 'pnpm',
      },
      {
        args: ['exec', 'tsgo', '--noEmit', '-p', tsConfigPath],
        command: 'pnpm',
      },
      {
        args: ['scripts/validate-no-link-deps.mts'],
        command: 'node',
      },
      {
        args: ['scripts/validate-bundle-deps.mts'],
        command: 'node',
      },
      {
        args: ['scripts/validate-esbuild-minify.mts'],
        command: 'node',
      },
      {
        args: ['scripts/validate-no-cdn-refs.mts'],
        command: 'node',
      },
      {
        args: ['scripts/validate-markdown-filenames.mts'],
        command: 'node',
      },
      {
        args: ['scripts/validate-file-size.mts'],
        command: 'node',
      },
      {
        args: ['scripts/validate-file-count.mts'],
        command: 'node',
      },
      // Path-hygiene gate (1 path, 1 reference). See
      // .claude/skills/path-guard/ + .claude/hooks/path-guard/.
      {
        args: ['scripts/check-paths.mts', '--quiet'],
        command: 'node',
      },
    ]

    const exitCodes = await runParallel(checks)
    const failed = exitCodes.some(code => code !== 0)

    if (failed) {
      logger.log('')
      logger.error('Some checks failed')
      process.exitCode = 1
    } else {
      logger.log('')
      logger.success('All checks passed')
      printFooter()
    }
  } catch (e) {
    logger.log('')
    logger.error(`Check failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exitCode = 1
  }
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
