#!/usr/bin/env node
/**
 * @fileoverview Build script for the SDK.
 * Orchestrates the complete build process:
 * - Cleans dist directory
 * - Compiles source with Rollup
 * - Generates TypeScript declarations
 *
 * Usage:
 *   node scripts/build.mjs [--src-only|--types-only]
 */

import { parseArgs } from 'node:util'
import { logger } from '@socketsecurity/registry/lib/logger'
import { runCommand, runSequence } from './utils/run-command.mjs'

async function main() {
  try {
    const { values } = parseArgs({
      options: {
        'src-only': { type: 'boolean', default: false },
        'types-only': { type: 'boolean', default: false },
      },
      strict: false,
    })

    const srcOnly = values['src-only']
    const typesOnly = values['types-only']

    if (typesOnly) {
      logger.log('Building TypeScript declarations only...')
      const exitCode = await runSequence([
        { command: 'pnpm', args: ['run', 'clean:dist:types'] },
        { command: 'tsgo', args: ['--project', 'tsconfig.dts.json'] },
      ])
      process.exitCode = exitCode
      return
    }

    if (srcOnly) {
      logger.log('Building source only...')
      const exitCode = await runSequence([
        { command: 'pnpm', args: ['run', 'clean:dist'] },
        { command: 'rollup', args: ['-c', '.config/rollup.dist.config.mjs'] },
      ])
      process.exitCode = exitCode
      return
    }

    // Build both src and types
    logger.log('Building SDK (source + types)...')

    // Build src
    const srcExitCode = await runSequence([
      { command: 'pnpm', args: ['run', 'clean:dist'] },
      { command: 'rollup', args: ['-c', '.config/rollup.dist.config.mjs'] },
    ])

    if (srcExitCode !== 0) {
      process.exitCode = srcExitCode
      return
    }

    // Build types
    const typesExitCode = await runSequence([
      { command: 'pnpm', args: ['run', 'clean:dist:types'] },
      { command: 'tsgo', args: ['--project', 'tsconfig.dts.json'] },
    ])

    process.exitCode = typesExitCode
  } catch (error) {
    logger.error('Build failed:', error.message)
    process.exitCode = 1
  }
}

main().catch(console.error)
