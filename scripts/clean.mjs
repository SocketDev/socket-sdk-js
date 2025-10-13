/**
 * @fileoverview Unified clean runner with flag-based configuration.
 * Removes build artifacts, caches, and other generated files.
 */

import { parseArgs } from 'node:util'

import { deleteAsync } from 'del'
import { isQuiet } from '@socketsecurity/registry/lib/argv/flags'
import { logger } from '@socketsecurity/registry/lib/logger'
import { createHeader } from '@socketsecurity/registry/lib/stdio/header'
import { createFooter } from '@socketsecurity/registry/lib/stdio/footer'

/**
 * Clean specific directories.
 */
async function cleanDirectories(patterns, options = {}) {
  const { quiet = false } = options

  for (const { name, pattern } of patterns) {
    if (!quiet) {
      logger.progress(`Cleaning ${name}`)
    }

    try {
      await deleteAsync(pattern)
    } catch (error) {
      if (!quiet) {
        logger.fail(`Failed to clean ${name}: ${error.message}`)
      }
      return 1
    }

    if (!quiet) {
      logger.done(`Cleaned ${name}`)
    }
  }

  return 0
}

async function main() {
  try {
    // Parse arguments
    const { values } = parseArgs({
      options: {
        help: {
          type: 'boolean',
          default: false,
        },
        all: {
          type: 'boolean',
          default: false,
        },
        cache: {
          type: 'boolean',
          default: false,
        },
        coverage: {
          type: 'boolean',
          default: false,
        },
        dist: {
          type: 'boolean',
          default: false,
        },
        types: {
          type: 'boolean',
          default: false,
        },
        modules: {
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
      allowPositionals: false,
      strict: false,
    })

    // Show help if requested
    if (values.help) {
      console.log('Clean Runner')
      console.log('\nUsage: pnpm clean [options]')
      console.log('\nOptions:')
      console.log('  --help              Show this help message')
      console.log('  --all               Clean everything (default if no flags)')
      console.log('  --cache             Clean cache directories')
      console.log('  --coverage          Clean coverage reports')
      console.log('  --dist              Clean build output')
      console.log('  --types             Clean TypeScript declarations only')
      console.log('  --modules           Clean node_modules')
      console.log('  --quiet, --silent   Suppress progress messages')
      console.log('\nExamples:')
      console.log('  pnpm clean                  # Clean everything except node_modules')
      console.log('  pnpm clean --dist           # Clean build output only')
      console.log('  pnpm clean --cache --coverage  # Clean cache and coverage')
      console.log('  pnpm clean --all --modules  # Clean everything including node_modules')
      process.exitCode = 0
      return
    }

    // Determine what to clean
    const cleanAll = values.all ||
      (!values.cache && !values.coverage && !values.dist && !values.types && !values.modules)

    const tasks = []

    // Build task list
    if (cleanAll || values.cache) {
      tasks.push({ name: 'cache', pattern: '**/.cache' })
    }

    if (cleanAll || values.coverage) {
      tasks.push({ name: 'coverage', pattern: 'coverage' })
    }

    if (cleanAll || values.dist) {
      tasks.push({ name: 'dist', pattern: 'dist' })
      tasks.push({ name: 'tsbuildinfo files', pattern: '**/*.tsbuildinfo' })
    } else if (values.types) {
      tasks.push({ name: 'dist/types', pattern: 'dist/types' })
    }

    if (values.modules) {
      tasks.push({ name: 'node_modules', pattern: '**/node_modules' })
    }

    const quiet = isQuiet(values)
    // Check if there's anything to clean
    if (tasks.length === 0) {
      if (!quiet) {
        logger.info('Nothing to clean')
      }
      process.exitCode = 0
      return
    }

    if (!quiet) {
      console.log(createHeader('Clean Runner', { width: 56, borderChar: '=' }))
      logger.step('Cleaning project directories')
    }

    // Clean directories
    const exitCode = await cleanDirectories(tasks, { quiet })

    if (exitCode !== 0) {
      if (!quiet) {
        logger.error('Clean failed')
      }
      process.exitCode = exitCode
    } else {
      if (!quiet) {
        console.log(createFooter('Clean completed successfully!', { width: 56, borderChar: '=', color: 'green' }))
      }
    }
  } catch (error) {
    logger.error(`Clean runner failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(console.error)