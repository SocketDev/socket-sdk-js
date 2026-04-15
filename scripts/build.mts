/**
 * @fileoverview Fast build runner using esbuild for smaller bundles and faster builds.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import type { BuildResult, PluginBuild } from 'esbuild'

import { build, context } from 'esbuild'

import type { FlagValues } from '@socketsecurity/lib/argv/flags'

import { isQuiet } from '@socketsecurity/lib/argv/flags'
import { parseArgs } from '@socketsecurity/lib/argv/parse'
import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { printFooter, printHeader } from '@socketsecurity/lib/stdio/header'

// @ts-expect-error -- esbuild.config.mjs has no declaration file
import {
  analyzeMetafile,
  buildConfig,
  watchConfig,
} from '../.config/esbuild.config.mts'
import { runSequence } from './utils/run-command.mts'

const rootPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

// Initialize logger
const logger = getDefaultLogger()

interface BuildOptions {
  analyze?: boolean
  quiet?: boolean
  skipClean?: boolean
  verbose?: boolean
}

interface BuildSourceResult {
  exitCode: number
  buildTime: number
  result: BuildResult | undefined
}

/**
 * Build source code with esbuild.
 * Returns { exitCode, buildTime, result } for external logging.
 */
async function buildSource(
  options: BuildOptions = {},
): Promise<BuildSourceResult> {
  const { quiet = false, skipClean = false, verbose = false } = options

  // Clean dist directory if needed
  if (!skipClean) {
    const exitCode = await runSequence([
      {
        args: ['scripts/clean.mjs', '--dist', '--quiet'],
        command: 'node',
      },
    ])
    if (exitCode !== 0) {
      if (!quiet) {
        logger.error('Clean failed')
      }
      return { exitCode, buildTime: 0, result: undefined }
    }
  }

  try {
    const startTime = Date.now()
    // Determine log level based on verbosity
    const logLevel = quiet ? 'silent' : verbose ? 'info' : 'warning'
    const result = await build({
      ...buildConfig,
      logLevel,
    })
    const buildTime = Date.now() - startTime

    return { exitCode: 0, buildTime, result }
  } catch {
    if (!quiet) {
      logger.error('Source build failed')
    }
    return { exitCode: 1, buildTime: 0, result: undefined }
  }
}

/**
 * Build TypeScript declarations.
 * Returns exitCode for external logging.
 */
async function buildTypes(options: BuildOptions = {}): Promise<number> {
  const {
    quiet = false,
    skipClean = false,
    verbose: _verbose = false,
  } = options

  const commands: Array<{
    args: string[]
    command: string
    options?: Record<string, unknown>
  }> = []

  if (!skipClean) {
    commands.push({
      args: ['scripts/clean.mjs', '--types', '--quiet'],
      command: 'node',
    })
  }

  commands.push({
    args: ['exec', 'tsgo', '--project', '.config/tsconfig.dts.json'],
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
 * Watch mode for development with incremental builds (68% faster rebuilds).
 */
async function watchBuild(options: BuildOptions = {}): Promise<number> {
  const { quiet = false, verbose = false } = options

  if (!quiet) {
    logger.step('Starting watch mode with incremental builds')
    logger.substep('Watching for file changes...')
  }

  try {
    // Determine log level based on verbosity
    const logLevel = quiet ? 'silent' : verbose ? 'debug' : 'warning'

    // Use context API for incremental builds (68% faster rebuilds)
    // Extract watch option from watchConfig as it's not valid for context()
    const { watch: _watchOpts, ...contextConfig } = watchConfig
    const ctx = await context({
      ...contextConfig,
      logLevel,
      plugins: [
        ...(contextConfig.plugins || []),
        {
          name: 'rebuild-logger',
          setup(pluginBuild: PluginBuild) {
            pluginBuild.onEnd(result => {
              if (result.errors.length > 0) {
                if (!quiet) {
                  logger.error('Rebuild failed')
                }
              } else {
                if (!quiet) {
                  logger.success('Rebuild succeeded')
                  if (result?.metafile && verbose) {
                    const analysis = analyzeMetafile(result.metafile)
                    logger.info(`Bundle size: ${analysis.totalSize}`)
                  }
                }
              }
            })
          },
        },
      ],
    })

    // Enable watch mode
    await ctx.watch()

    // Keep the process alive
    process.on('SIGINT', async () => {
      await ctx.dispose()
      process.exitCode = 0
      throw new Error('Watch mode interrupted')
    })

    // Wait indefinitely
    await new Promise<never>(() => {})
  } catch (e) {
    if (!quiet) {
      logger.error('Watch mode failed:', e)
    }
    return 1
  }
}

/**
 * Check if build is needed.
 */
function isBuildNeeded(): boolean {
  const distPath = path.join(rootPath, 'dist', 'index.js')
  const distTypesPath = path.join(rootPath, 'dist', 'types', 'index.d.ts')

  return !existsSync(distPath) || !existsSync(distTypesPath)
}

async function main(): Promise<void> {
  try {
    // Parse arguments
    interface BuildArgs {
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
      logger.log('\nUsage: pnpm build [options]')
      logger.log('\nOptions:')
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
      logger.log('\nExamples:')
      logger.log('  pnpm build              # Full build (source + types)')
      logger.log('  pnpm build --src        # Build source only')
      logger.log('  pnpm build --types      # Build types only')
      logger.log(
        '  pnpm build --watch      # Watch mode with incremental builds',
      )
      logger.log('  pnpm build --analyze    # Build with size analysis')
      logger.log(
        '\nNote: Watch mode uses esbuild context API for 68% faster rebuilds',
      )
      process.exitCode = 0
      return
    }

    const quiet = isQuiet(values as FlagValues)
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
      const {
        buildTime,
        exitCode: srcExitCode,
        result,
      } = await buildSource({ quiet, verbose, analyze: values.analyze })
      exitCode = srcExitCode
      if (exitCode === 0 && !quiet) {
        logger.success(`Source Bundle (${buildTime}ms)`)

        if (values.analyze && result?.metafile) {
          const analysis = analyzeMetafile(result.metafile)
          logger.info('Build output:')
          for (const file of analysis.files) {
            logger.substep(`${file.name}: ${file.size}`)
          }
          logger.step(`Total bundle size: ${analysis.totalSize}`)
        }
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
          args: ['scripts/clean.mjs', '--dist', '--types', '--quiet'],
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
          : { exitCode: 1, buildTime: 0, result: undefined }
      const typesExitCode =
        results[1].status === 'fulfilled' ? results[1].value : 1

      // Log completion messages
      if (!quiet) {
        if (srcResult.exitCode === 0) {
          logger.success(`Source Bundle (${srcResult.buildTime}ms)`)

          if (values.analyze && srcResult.result?.metafile) {
            const analysis = analyzeMetafile(srcResult.result.metafile)
            logger.info('Build output:')
            for (const file of analysis.files) {
              logger.substep(`${file.name}: ${file.size}`)
            }
            logger.step(`Total bundle size: ${analysis.totalSize}`)
          }
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
    logger.error(
      `Build runner failed: ${e instanceof Error ? e.message : String(e)}`,
    )
    process.exitCode = 1
  }
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
