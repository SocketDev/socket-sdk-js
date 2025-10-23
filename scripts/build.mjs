/**
 * @fileoverview Fast build runner using esbuild for smaller bundles and faster builds.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build, context } from 'esbuild'
import colors from 'yoctocolors-cjs'

import { isQuiet } from '@socketsecurity/lib/argv/flags'
import { parseArgs } from '@socketsecurity/lib/argv/parse'
import { logger } from '@socketsecurity/lib/logger'
import { printFooter, printHeader } from '@socketsecurity/lib/stdio/header'

import {
  analyzeMetafile,
  buildConfig,
  watchConfig,
} from '../.config/esbuild.config.mjs'
import { runSequence } from './utils/run-command.mjs'

const rootPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

/**
 * Build source code with esbuild.
 * Returns { exitCode, buildTime, result } for external logging.
 */
async function buildSource(options = {}) {
  const { quiet = false, skipClean = false, verbose = false } = options

  if (!quiet) {
    logger.substep('Building source code')
  }

  // Clean dist directory if needed
  if (!skipClean) {
    const exitCode = await runSequence([
      {
        args: ['scripts/load.cjs', 'clean', '--dist', '--quiet'],
        command: 'node',
      },
    ])
    if (exitCode !== 0) {
      if (!quiet) {
        logger.error('Clean failed')
      }
      return { exitCode, buildTime: 0, result: null }
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
  } catch (error) {
    if (!quiet) {
      logger.error('Source build failed')
      console.error(error)
    }
    return { exitCode: 1, buildTime: 0, result: null }
  }
}

/**
 * Build TypeScript declarations.
 * Returns exitCode for external logging.
 */
async function buildTypes(options = {}) {
  const {
    quiet = false,
    skipClean = false,
    verbose: _verbose = false,
  } = options

  if (!quiet) {
    logger.substep('Building TypeScript declarations')
  }

  const commands = []

  if (!skipClean) {
    commands.push({
      args: ['scripts/load.cjs', 'clean', '--types', '--quiet'],
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
async function watchBuild(options = {}) {
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
          setup(build) {
            build.onEnd(result => {
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
    await new Promise(() => {})
  } catch (error) {
    if (!quiet) {
      logger.error('Watch mode failed:', error)
    }
    return 1
  }
}

/**
 * Check if build is needed.
 */
function isBuildNeeded() {
  const distPath = path.join(rootPath, 'dist', 'index.js')
  const distTypesPath = path.join(rootPath, 'dist', 'types', 'index.d.ts')

  return !existsSync(distPath) || !existsSync(distTypesPath)
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
      console.log('Build Runner')
      console.log('\nUsage: pnpm build [options]')
      console.log('\nOptions:')
      console.log('  --help       Show this help message')
      console.log('  --src        Build source code only')
      console.log('  --types      Build TypeScript declarations only')
      console.log(
        '  --watch      Watch mode with incremental builds (68% faster rebuilds)',
      )
      console.log('  --needed     Only build if dist files are missing')
      console.log('  --analyze    Show bundle size analysis')
      console.log('  --quiet, --silent  Suppress progress messages')
      console.log('  --verbose    Show detailed build output')
      console.log('\nExamples:')
      console.log('  pnpm build              # Full build (source + types)')
      console.log('  pnpm build --src        # Build source only')
      console.log('  pnpm build --types      # Build types only')
      console.log(
        '  pnpm build --watch      # Watch mode with incremental builds',
      )
      console.log('  pnpm build --analyze    # Build with size analysis')
      console.log(
        '\nNote: Watch mode uses esbuild context API for 68% faster rebuilds',
      )
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

    if (!quiet) {
      printHeader('Build Runner')
    }

    let exitCode = 0

    // Handle watch mode
    if (values.watch) {
      exitCode = await watchBuild({ quiet, verbose })
    }
    // Build types only
    else if (values.types && !values.src) {
      if (!quiet) {
        logger.step('Building TypeScript declarations only')
      }
      exitCode = await buildTypes({ quiet, verbose })
      if (exitCode === 0 && !quiet) {
        logger.substep('Type declarations built')
      }
    }
    // Build source only
    else if (values.src && !values.types) {
      if (!quiet) {
        logger.step('Building source only')
      }
      const {
        buildTime,
        exitCode: srcExitCode,
        result,
      } = await buildSource({ quiet, verbose, analyze: values.analyze })
      exitCode = srcExitCode
      if (exitCode === 0 && !quiet) {
        logger.substep(`Source build complete in ${buildTime}ms`)

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
        logger.step('Building package (source + types)')
      }

      // Clean all directories first (once)
      if (!quiet) {
        logger.substep('Cleaning build directories')
      }
      exitCode = await runSequence([
        {
          args: ['scripts/load.cjs', 'clean', '--dist', '--types', '--quiet'],
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

      // Run source and types builds in parallel
      const [srcResult, typesExitCode] = await Promise.all([
        buildSource({
          quiet,
          verbose,
          skipClean: true,
          analyze: values.analyze,
        }),
        buildTypes({ quiet, verbose, skipClean: true }),
      ])

      // Log completion messages in order
      if (!quiet) {
        if (srcResult.exitCode === 0) {
          logger.substep(`Source build complete in ${srcResult.buildTime}ms`)

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
          logger.substep('Type declarations built')
        }
      }

      exitCode = srcResult.exitCode !== 0 ? srcResult.exitCode : typesExitCode
    }

    // Print final status and footer
    if (!quiet) {
      if (exitCode === 0) {
        console.log(colors.green('✓ Build completed successfully!'))
      } else {
        console.error(colors.red('✗ Build failed'))
      }
      printFooter()
    }

    if (exitCode !== 0) {
      process.exitCode = exitCode
    }
  } catch (error) {
    logger.error(`Build runner failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(e => {
  logger.error(e)
  process.exitCode = 1
})
