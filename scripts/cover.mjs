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
import { createSectionHeader } from '@socketsecurity/registry/lib/stdio/header'
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

    // Show header for coverage collection
    console.log(createSectionHeader('Running Coverage'))
    console.log()

    if (values['type-only']) {
      logger.step('Collecting type coverage...')
      const exitCode = await runSequence([
        { args: ['exec', 'type-coverage'], command: 'pnpm' },
      ])
      if (exitCode === 0) {
        console.log()
        logger.success('Type coverage complete!')
      }
      process.exitCode = exitCode
      return
    }

    if (values['code-only']) {
      logger.step('Collecting code coverage...')
      // Use the test runner with coverage flag for consistent experience
      const exitCode = await runSequence([
        { args: ['scripts/test.mjs', '--skip-checks', '--cover', '--all'], command: 'node' },
      ])
      if (exitCode === 0) {
        console.log()
        logger.success('Code coverage complete!')
      }
      process.exitCode = exitCode
      return
    }

    // Collect both code and type coverage
    logger.step('Collecting full coverage (code + type)...')

    // Use test runner for code coverage
    logger.substep('Running tests with code coverage')
    const codeExitCode = await runSequence([
      { args: ['scripts/test.mjs', '--skip-checks', '--cover', '--all'], command: 'node' },
    ])

    if (codeExitCode !== 0) {
      logger.error('Code coverage failed')
      process.exitCode = codeExitCode
      return
    }

    logger.substep('Collecting type coverage')
    const typeExitCode = await runSequence([
      { args: ['exec', 'type-coverage'], command: 'pnpm' },
    ])

    if (typeExitCode === 0) {
      console.log()
      logger.success('Full coverage complete!')
    }
    process.exitCode = typeExitCode
  } catch (error) {
    logger.error('Coverage collection failed:', error.message)
    process.exitCode = 1
  }
}

main().catch(console.error)
