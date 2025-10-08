#!/usr/bin/env node
/**
 * @fileoverview Coverage script for the SDK.
 * Collects both code coverage and type coverage.
 *
 * Usage:
 *   node scripts/cover.mjs [--code-only|--type-only|--percent|--summary]
 */

import { parseArgs } from 'node:util'
import { logger } from '@socketsecurity/registry/lib/logger'
import { runSequence } from './utils/run-command.mjs'

async function main() {
  try {
    const { values } = parseArgs({
      options: {
        'code-only': { type: 'boolean', default: false },
        percent: { type: 'boolean', default: false },
        summary: { type: 'boolean', default: false },
        'type-only': { type: 'boolean', default: false },
      },
      strict: false,
    })

    if (values.percent || values.summary) {
      // Just get coverage percentage/summary
      const exitCode = await runSequence([
        { args: ['scripts/get-coverage-percentage.mjs'], command: 'node' },
      ])
      process.exitCode = exitCode
      return
    }

    if (values['type-only']) {
      logger.log('Collecting type coverage...')
      const exitCode = await runSequence([
        { args: ['exec', 'type-coverage'], command: 'pnpm' },
      ])
      process.exitCode = exitCode
      return
    }

    if (values['code-only']) {
      logger.log('Collecting code coverage...')
      const exitCode = await runSequence([
        { args: ['run', 'build'], command: 'pnpm' },
        {
          args: ['exec', 'vitest', '--run', '--coverage', '--config', '.config/vitest.config.mts'],
          command: 'pnpm',
        },
      ])
      process.exitCode = exitCode
      return
    }

    // Collect both code and type coverage
    logger.log('Collecting coverage (code + type)...')

    const codeExitCode = await runSequence([
      { args: ['run', 'build'], command: 'pnpm' },
      {
        args: ['exec', 'vitest', '--run', '--coverage', '--config', '.config/vitest.config.mts'],
        command: 'pnpm',
      },
    ])

    if (codeExitCode !== 0) {
      process.exitCode = codeExitCode
      return
    }

    const typeExitCode = await runSequence([
      { args: ['exec', 'type-coverage'], command: 'pnpm' },
    ])

    process.exitCode = typeExitCode
  } catch (error) {
    logger.error('Coverage collection failed:', error.message)
    process.exitCode = 1
  }
}

main().catch(console.error)
