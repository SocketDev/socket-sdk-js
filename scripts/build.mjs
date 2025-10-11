/**
 * @fileoverview Fast build runner using esbuild for smaller bundles and faster builds.
 */

import { build } from 'esbuild'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  getRootPath,
  isQuiet,
  log,
  printFooter,
  printHeader,
  printHelpHeader
} from './utils/common.mjs'
import { runSequence } from './utils/run-command.mjs'
import { buildConfig, watchConfig, analyzeMetafile } from '../.config/esbuild.config.mjs'

const rootPath = getRootPath(import.meta.url)

/**
 * Build source code with esbuild.
 */
async function buildSource(options = {}) {
  const { quiet = false, skipClean = false, analyze = false, verbose = false } = options

  if (!quiet) {
    log.progress('Building source code')
  }

  // Clean dist directory if needed
  if (!skipClean) {
    const exitCode = await runSequence([
      { args: ['exec', 'node', 'scripts/clean.mjs', '--dist', '--quiet'], command: 'pnpm' }
    ])
    if (exitCode !== 0) {
      if (!quiet) {
        log.failed('Clean failed')
      }
      return exitCode
    }
  }

  try {
    const startTime = Date.now()
    // Determine log level based on verbosity
    const logLevel = quiet ? 'silent' : verbose ? 'info' : 'warning'
    const result = await build({
      ...buildConfig,
      logLevel
    })
    const buildTime = Date.now() - startTime

    if (!quiet) {
      log.done(`Source build complete in ${buildTime}ms`)

      if (analyze && result.metafile) {
        const analysis = analyzeMetafile(result.metafile)
        log.info('Build output:')
        for (const file of analysis.files) {
          log.substep(`${file.name}: ${file.size}`)
        }
        log.step(`Total bundle size: ${analysis.totalSize}`)
      }
    }

    return 0
  } catch (error) {
    if (!quiet) {
      log.failed('Source build failed')
      console.error(error)
    }
    return 1
  }
}

/**
 * Build TypeScript declarations.
 */
async function buildTypes(options = {}) {
  const { quiet = false, skipClean = false, verbose = false } = options

  if (!quiet) {
    log.progress('Building TypeScript declarations')
  }

  const commands = []

  if (!skipClean) {
    commands.push({ args: ['exec', 'node', 'scripts/clean.mjs', '--types', '--quiet'], command: 'pnpm' })
  }

  commands.push({
    args: ['exec', 'tsgo', '--project', '.config/tsconfig.dts.json'],
    command: 'pnpm',
  })

  const exitCode = await runSequence(commands)

  if (exitCode !== 0) {
    if (!quiet) {
      log.failed('Type declarations build failed')
    }
    return exitCode
  }

  // Rename .d.ts files to .d.mts for ESM
  if (!quiet) {
    log.progress('Renaming declaration files to .d.mts')
  }

  const { promises: fs } = await import('node:fs')
  const distPath = path.join(rootPath, 'dist')

  try {
    const files = await fs.readdir(distPath)
    for (const file of files) {
      if (file.endsWith('.d.ts')) {
        const oldPath = path.join(distPath, file)
        const newPath = path.join(distPath, file.replace('.d.ts', '.d.mts'))
        await fs.rename(oldPath, newPath)
      }
    }
  } catch (error) {
    if (!quiet) {
      log.error('Failed to rename declaration files:', error)
    }
    return 1
  }

  if (!quiet) {
    log.done('Type declarations built')
  }

  return 0
}

/**
 * Watch mode for development.
 */
async function watchBuild(options = {}) {
  const { quiet = false, verbose = false } = options

  if (!quiet) {
    log.step('Starting watch mode')
    log.substep('Watching for file changes...')
  }

  try {
    // Determine log level based on verbosity
    const logLevel = quiet ? 'silent' : verbose ? 'debug' : 'warning'
    const ctx = await build({
      ...watchConfig,
      logLevel
    })

    // Keep the process alive
    process.on('SIGINT', () => {
      ctx.stop()
      process.exitCode = 0
      throw new Error('Watch mode interrupted')
    })

    // Wait indefinitely
    await new Promise(() => {})
  } catch (error) {
    if (!quiet) {
      log.error('Watch mode failed:', error)
    }
    return 1
  }
}

/**
 * Check if build is needed.
 */
function isBuildNeeded() {
  const distPath = path.join(rootPath, 'dist', 'index.mjs')
  const distTypesPath = path.join(rootPath, 'dist', 'index.d.mts')

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
      printHelpHeader('Build Runner')
      console.log('\nUsage: pnpm build [options]')
      console.log('\nOptions:')
      console.log('  --help       Show this help message')
      console.log('  --src        Build source code only')
      console.log('  --types      Build TypeScript declarations only')
      console.log('  --watch      Watch mode for development')
      console.log('  --needed     Only build if dist files are missing')
      console.log('  --analyze    Show bundle size analysis')
      console.log('  --quiet, --silent  Suppress progress messages')
      console.log('  --verbose    Show detailed build output')
      console.log('\nExamples:')
      console.log('  pnpm build              # Full build (source + types)')
      console.log('  pnpm build --src        # Build source only')
      console.log('  pnpm build --types      # Build types only')
      console.log('  pnpm build --watch      # Watch mode')
      console.log('  pnpm build --analyze    # Build with size analysis')
      process.exitCode = 0
      return
    }

    const quiet = isQuiet(values)
    const verbose = values.verbose

    // Check if build is needed
    if (values.needed && !isBuildNeeded()) {
      if (!quiet) {
        log.info('Build artifacts exist, skipping build')
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
        log.step('Building TypeScript declarations only')
      }
      exitCode = await buildTypes({ quiet, verbose })
    }
    // Build source only
    else if (values.src && !values.types) {
      if (!quiet) {
        log.step('Building source only')
      }
      exitCode = await buildSource({ quiet, verbose, analyze: values.analyze })
    }
    // Build everything (default)
    else {
      if (!quiet) {
        log.step('Building package (source + types)')
      }

      // Clean all directories first (once)
      if (!quiet) {
        log.progress('Cleaning build directories')
      }
      exitCode = await runSequence([
        { args: ['exec', 'node', 'scripts/clean.mjs', '--dist', '--types', '--quiet'], command: 'pnpm' }
      ])
      if (exitCode !== 0) {
        if (!quiet) {
          log.failed('Clean failed')
        }
        process.exitCode = exitCode
        return
      }

      // Run source and types builds in parallel
      const buildPromises = [
        buildSource({ quiet, verbose, skipClean: true, analyze: values.analyze }),
        buildTypes({ quiet, verbose, skipClean: true })
      ]

      const results = await Promise.all(buildPromises)
      exitCode = results.find(code => code !== 0) || 0
    }

    if (exitCode !== 0) {
      if (!quiet) {
        log.error('Build failed')
      }
      process.exitCode = exitCode
    } else {
      if (!quiet) {
        printFooter('Build completed successfully!')
      }
    }
  } catch (error) {
    log.error(`Build runner failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(console.error)