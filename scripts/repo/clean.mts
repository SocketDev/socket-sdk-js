/**
 * @file Unified clean runner with flag-based configuration. Removes build
 *   artifacts, caches, and other generated files.
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { deleteAsync } from 'del'
import fastGlob from 'fast-glob'

import { errorMessage } from '@socketsecurity/lib-stable/errors/message'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { createSectionHeader } from '@socketsecurity/lib-stable/stdio/header'
import { isMainModule } from '../fleet/process/is-main-module.mts'
import { runMain } from '../fleet/process/run-main.mts'

const rootPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

// Initialize logger
const logger = getDefaultLogger()

interface CleanTask {
  name: string
  pattern?: string | undefined
  patterns?: string[] | undefined
}

interface CleanOptions {
  quiet?: boolean | undefined
}

/**
 * Clean specific directories.
 */
export async function cleanDirectories(
  tasks: CleanTask[],
  options: CleanOptions = {},
): Promise<number> {
  const { quiet = false } = options

  for (let i = 0, { length } = tasks; i < length; i += 1) {
    const task = tasks[i]!
    const { name, pattern, patterns } = task
    const patternsToDelete = patterns || (pattern ? [pattern] : [])

    if (!quiet) {
      logger.progress(`Cleaning ${name}`)
    }

    try {
      // Find all files/dirs matching the patterns
      const files = await fastGlob(patternsToDelete, {
        cwd: rootPath,
        absolute: true,
        dot: true,
        onlyFiles: false,
        markDirectories: true,
      })

      // Delete each file/directory
      await deleteAsync(files)

      if (!quiet) {
        if (files.length > 0) {
          logger.done(`Cleaned ${name} (${files.length} items)`)
        } else {
          logger.done(`Cleaned ${name} (already clean)`)
        }
      }
    } catch (e) {
      if (!quiet) {
        logger.error(`Failed to clean ${name}`)
        logger.error(errorMessage(e))
      }
      return 1
    }
  }

  return 0
}

export function selectCleanTasks(options: {
  all?: boolean | undefined
  cache?: boolean | undefined
  coverage?: boolean | undefined
  dist?: boolean | undefined
  types?: boolean | undefined
  modules?: boolean | undefined
}): CleanTask[] {
  // Determine what to clean
  const opts = { __proto__: null, ...options } as typeof options
  const cleanAll =
    opts['all'] ||
    (!opts['cache'] &&
      !opts['coverage'] &&
      !opts['dist'] &&
      !opts['types'] &&
      !opts['modules'])

  const tasks = []

  // Build task list
  if (cleanAll || opts['cache']) {
    // oxlint-disable-next-line socket/prefer-repo-root-dot-cache -- deletion-target glob, not a cache location.
    tasks.push({ name: 'cache', pattern: '**/.cache' })
  }

  if (cleanAll || opts['coverage']) {
    tasks.push({ name: 'coverage', pattern: 'coverage' })
  }

  if (cleanAll || opts['dist']) {
    tasks.push({
      name: 'dist',
      patterns: ['dist', '*.tsbuildinfo', '.tsbuildinfo'],
    })
  } else if (opts['types']) {
    tasks.push({ name: 'dist/types', patterns: ['dist/types'] })
  }

  if (opts['modules']) {
    tasks.push({ name: 'node_modules', pattern: '**/node_modules' })
  }

  return tasks
}

async function main(): Promise<void> {
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

    const quiet = Boolean(values.quiet || values.silent)

    const tasks = selectCleanTasks({
      all: Boolean(values.all),
      cache: Boolean(values.cache),
      coverage: Boolean(values.coverage),
      dist: Boolean(values.dist),
      types: Boolean(values.types),
      modules: Boolean(values.modules),
    })

    // Check if there's anything to clean
    if (tasks.length === 0) {
      if (!quiet) {
        logger.info('Nothing to clean')
      }
      process.exitCode = 0
      return
    }

    if (!quiet) {
      logger.log(
        createSectionHeader('Clean Runner', { width: 56, borderChar: '=' }),
      )
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
        logger.success('Clean completed successfully!')
      }
    }
  } catch (e) {
    logger.error(`Clean runner failed: ${errorMessage(e)}`)
    process.exitCode = 1
  }
}

const SCRIPT_META = {
  describe: 'remove selected SDK build outputs',
  help: `Usage: pnpm clean [options]\n\n--all  clean cache, coverage, and dist
--cache  clean caches
--coverage  clean coverage
--dist  clean bundles and declarations
--types  clean declarations
--modules  clean dependencies
--quiet, --silent  suppress progress\n--help, -h  show usage\n--describe  show purpose`,
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
