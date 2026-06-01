/**
 * @file Build runner: rolldown for the bundle, tsgo for declarations.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { rolldown, watch } from 'rolldown'

import { isQuiet } from '@socketsecurity/lib-stable/argv/flag-predicates'
import { parseArgs } from '@socketsecurity/lib-stable/argv/parse'
import { errorMessage } from '@socketsecurity/lib-stable/errors/message'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { printFooter } from '@socketsecurity/lib-stable/stdio/footer'
import { printHeader } from '@socketsecurity/lib-stable/stdio/header'

import { buildConfig } from '../.config/repo/rolldown.config.mts'
import { runSequence } from './utils/run-command.mts'

const rootPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

// Initialize logger
const logger = getDefaultLogger()

interface BuildOptions {
  analyze?: boolean | undefined
  quiet?: boolean | undefined
  skipClean?: boolean | undefined
  verbose?: boolean | undefined
}

interface BuildSourceResult {
  exitCode: number
  buildTime: number
}

/**
 * Build source code with rolldown. Returns { exitCode, buildTime } for external
 * logging.
 */
export async function buildSource(
  options: BuildOptions = {},
): Promise<BuildSourceResult> {
  const { quiet = false, skipClean = false } = options

  // Clean dist directory if needed
  if (!skipClean) {
    const exitCode = await runSequence([
      {
        args: ['scripts/clean.mts', '--dist', '--quiet'],
        command: 'node',
      },
    ])
    if (exitCode !== 0) {
      if (!quiet) {
        logger.error('Clean failed')
      }
      return { exitCode, buildTime: 0 }
    }
  }

  try {
    const startTime = Date.now()
    const { output, ...inputOptions } = buildConfig
    const bundle = await rolldown(inputOptions)
    try {
      await bundle.write(output)
    } finally {
      await bundle.close()
    }
    const buildTime = Date.now() - startTime

    return { exitCode: 0, buildTime }
  } catch (e) {
    if (!quiet) {
      logger.error('Source build failed')
      logger.error(e)
    }
    return { exitCode: 1, buildTime: 0 }
  }
}

/**
 * Build TypeScript declarations. Returns exitCode for external logging.
 */
export async function buildTypes(options: BuildOptions = {}): Promise<number> {
  const {
    quiet = false,
    skipClean = false,
    verbose: _verbose = false,
  } = options

  const commands: Array<{
    args: string[]
    command: string
    options?: Record<string, unknown> | undefined
  }> = []

  if (!skipClean) {
    commands.push({
      args: ['scripts/clean.mts', '--types', '--quiet'],
      command: 'node',
    })
  }

  commands.push({
    args: ['exec', 'tsgo', '--project', 'tsconfig.dts.json'],
    command: 'pnpm',
    options: {
      ...(process.platform === 'win32' && { shell: true }),
    },
  })

  const exitCode = await runSequence(commands)

  if (exitCode !== 0) {
    if (!quiet) {
      logger.error('Type declarations build failed')
    }
  }

  return exitCode
}

/**
 * Check if build is needed.
 */
export function isBuildNeeded(): boolean {
  const distPath = path.join(rootPath, 'dist', 'index.js')
  const distTypesPath = path.join(rootPath, 'dist', 'types', 'index.d.ts')

  return !existsSync(distPath) || !existsSync(distTypesPath)
}

/**
 * Watch mode for development with incremental builds (68% faster rebuilds).
 */
export async function watchBuild(options: BuildOptions = {}): Promise<number> {
  const { quiet = false } = options

  if (!quiet) {
    logger.step('Starting watch mode with incremental builds')
    logger.substep('Watching for file changes…')
  }

  try {
    const { output, ...inputOptions } = buildConfig
    const watcher = watch({ ...inputOptions, output })

    // rolldown requires closing each build's result on BUNDLE_END to avoid
    // leaking native handles; ERROR surfaces a failed rebuild.
    watcher.on('event', event => {
      if (event.code === 'BUNDLE_END') {
        if (!quiet) {
          logger.success('Rebuild succeeded')
        }
        event.result.close()
      } else if (event.code === 'ERROR') {
        if (!quiet) {
          logger.error('Rebuild failed')
          logger.error(event.error)
        }
      }
    })

    process.on('SIGINT', () => {
      watcher.close().finally(() => process.exit(0))
    })

    // Wait indefinitely — SIGINT is the only exit path.
    await new Promise<never>(() => {})
  } catch (e) {
    if (!quiet) {
      logger.error('Watch mode failed:', e)
    }
    return 1
  }
  return 0
}

async function main(): Promise<void> {
  try {
    // Parse arguments
    interface BuildArgs extends Record<string, unknown> {
      help: boolean
      src: boolean
      types: boolean
      watch: boolean
      needed: boolean
      analyze: boolean
      silent: boolean
      quiet: boolean
      verbose: boolean
    }
    const { values } = parseArgs<BuildArgs>({
      options: {
        help: {
          type: 'boolean',
          default: false,
        },
        src: {
          type: 'boolean',
          default: false,
        },
        types: {
          type: 'boolean',
          default: false,
        },
        watch: {
          type: 'boolean',
          default: false,
        },
        needed: {
          type: 'boolean',
          default: false,
        },
        analyze: {
          type: 'boolean',
          default: false,
        },
        silent: {
          type: 'boolean',
          default: false,
        },
        quiet: {
          type: 'boolean',
          default: false,
        },
        verbose: {
          type: 'boolean',
          default: false,
        },
      },
      allowPositionals: false,
      strict: false,
    })

    // Show help if requested
    if (values.help) {
      logger.log('Build Runner')
      logger.log('')
      logger.log('Usage: pnpm build [options]')
      logger.log('')
      logger.log('Options:')
      logger.log('  --help       Show this help message')
      logger.log('  --src        Build source code only')
      logger.log('  --types      Build TypeScript declarations only')
      logger.log(
        '  --watch      Watch mode with incremental builds (68% faster rebuilds)',
      )
      logger.log('  --needed     Only build if dist files are missing')
      logger.log('  --analyze    Show bundle size analysis')
      logger.log('  --quiet, --silent  Suppress progress messages')
      logger.log('  --verbose    Show detailed build output')
      logger.log('')
      logger.log('Examples:')
      logger.log('  pnpm build              # Full build (source + types)')
      logger.log('  pnpm build --src        # Build source only')
      logger.log('  pnpm build --types      # Build types only')
      logger.log(
        '  pnpm build --watch      # Watch mode with incremental builds',
      )
      logger.log('  pnpm build --analyze    # Build with size analysis')
      logger.log('')
      logger.log('Note: Watch mode uses rolldown for incremental rebuilds')
      process.exitCode = 0
      return
    }

    const quiet = isQuiet(values)
    const verbose = values.verbose

    // Check if build is needed
    if (values.needed && !isBuildNeeded()) {
      if (!quiet) {
        logger.info('Build artifacts exist, skipping build')
      }
      process.exitCode = 0
      return
    }

    let exitCode = 0

    // Handle watch mode
    if (values.watch) {
      if (!quiet) {
        printHeader('Build Runner (Watch Mode)')
      }
      exitCode = await watchBuild({ quiet, verbose })
    }
    // Build types only
    else if (values.types && !values.src) {
      if (!quiet) {
        printHeader('Building TypeScript Declarations')
      }
      exitCode = await buildTypes({ quiet, verbose })
      if (exitCode === 0 && !quiet) {
        logger.success('Type Declarations')
      }
    }
    // Build source only
    else if (values.src && !values.types) {
      if (!quiet) {
        printHeader('Building Source')
      }
      const { buildTime, exitCode: srcExitCode } = await buildSource({
        quiet,
        verbose,
        analyze: values.analyze,
      })
      exitCode = srcExitCode
      if (exitCode === 0 && !quiet) {
        logger.success(`Source Bundle (${buildTime}ms)`)
      }
    }
    // Build everything (default)
    else {
      if (!quiet) {
        printHeader('Building Package')
      }

      // Clean all directories first (once)
      exitCode = await runSequence([
        {
          args: ['scripts/clean.mts', '--dist', '--types', '--quiet'],
          command: 'node',
        },
      ])
      if (exitCode !== 0) {
        if (!quiet) {
          logger.error('Clean failed')
        }
        process.exitCode = exitCode
        return
      }

      if (!quiet) {
        logger.success('Build Cleaned')
      }

      // Run source and types builds in parallel
      const results = await Promise.allSettled([
        buildSource({
          quiet,
          verbose,
          skipClean: true,
          analyze: values.analyze,
        }),
        buildTypes({ quiet, verbose, skipClean: true }),
      ])
      const srcResult: BuildSourceResult =
        results[0].status === 'fulfilled'
          ? results[0].value
          : { exitCode: 1, buildTime: 0 }
      const typesExitCode =
        results[1].status === 'fulfilled' ? results[1].value : 1

      // Log completion messages
      if (!quiet) {
        if (srcResult.exitCode === 0) {
          logger.success(`Source Bundle (${srcResult.buildTime}ms)`)
        }

        if (typesExitCode === 0) {
          logger.success('Type Declarations')
        }
      }

      exitCode = srcResult.exitCode !== 0 ? srcResult.exitCode : typesExitCode
    }

    // Print final status and footer
    if (!quiet) {
      if (exitCode === 0) {
        logger.success('Build completed successfully!')
      } else {
        logger.fail('Build failed')
      }
      printFooter()
    }

    if (exitCode !== 0) {
      process.exitCode = exitCode
    }
  } catch (e) {
    logger.error(`Build runner failed: ${errorMessage(e)}`)
    process.exitCode = 1
  }
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
