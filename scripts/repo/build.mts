/**
 * @file Build runner: rolldown for the bundle, tsgo for declarations.
 */

import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

import { rolldown, watch } from 'rolldown'

import { isWin32 } from '@socketsecurity/lib-stable/constants/platform'
import { errorMessage } from '@socketsecurity/lib-stable/errors/message'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { printFooter } from '@socketsecurity/lib-stable/stdio/footer'
import { printHeader } from '@socketsecurity/lib-stable/stdio/header'

import { REPO_ROOT } from '../fleet/paths.mts'
import { buildConfig } from '../../.config/repo/rolldown.config.mts'
import { browserBuildConfig } from '../../.config/repo/rolldown.browser.config.mts'
import { externalsBuildConfig } from '../../.config/repo/rolldown.externals.config.mts'
import { runSequence } from './run-command.mts'
import { isMainModule } from '../fleet/process/is-main-module.mts'
import { runMain } from '../fleet/process/run-main.mts'

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
        args: ['scripts/repo/clean.mts', '--dist', '--quiet'],
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

    // Node-free so it runs in a Chrome MV3 service worker; the package.json
    // `browser` export condition selects it.
    const { output: browserOutput, ...browserInputOptions } = browserBuildConfig
    const browserBundle = await rolldown(browserInputOptions)
    try {
      await browserBundle.write(browserOutput)
    } finally {
      await browserBundle.close()
    }

    // Self-contained CJS, because the main bundle reaches these through
    // verbatim relative requires.
    const { output: externalsOutput, ...externalsInputOptions } =
      externalsBuildConfig
    const externalsBundle = await rolldown(externalsInputOptions)
    try {
      await externalsBundle.write(externalsOutput)
    } finally {
      await externalsBundle.close()
    }
    // Ship the hand-authored structural declarations beside the bundles
    // (socket-lib's copy-files step).
    await fs.cp(
      path.join(REPO_ROOT, 'src/external/form-data.d.ts'),
      path.join(REPO_ROOT, 'dist/external/form-data.d.ts'),
    )

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
  const { quiet = false, skipClean = false } = options

  const commands: Array<{
    args: string[]
    command: string
    options?: Record<string, unknown> | undefined
  }> = []

  if (!skipClean) {
    commands.push({
      args: ['scripts/repo/clean.mts', '--types', '--quiet'],
      command: 'node',
    })
  }

  commands.push({
    args: ['exec', 'tsgo', '--project', 'tsconfig.dts.json'],
    command: 'pnpm',
    options: {
      shell: isWin32(),
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
export function isBuildNeeded(
  options: { rootPath?: string | undefined } = {},
): boolean {
  const { rootPath = REPO_ROOT } = options
  const distPath = path.join(rootPath, 'dist', 'index.js')
  const distTypesPath = path.join(rootPath, 'dist', 'index.d.mts')

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
        void event.result.close()
      } else if (event.code === 'ERROR') {
        if (!quiet) {
          logger.error('Rebuild failed')
          logger.error(event.error)
        }
      }
    })

    process.on('SIGINT', () => {
      void watcher.close().finally(() => process.exit(0))
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

export type BuildMode = 'watch' | 'types' | 'source' | 'full'

export function selectBuildMode(values: Record<string, unknown>): BuildMode {
  if (values['watch']) {
    return 'watch'
  }
  if (values['types'] && !values['src']) {
    return 'types'
  }
  return values['src'] && !values['types'] ? 'source' : 'full'
}

export async function runFullBuild(options: BuildOptions): Promise<number> {
  const { quiet } = { __proto__: null, ...options } as typeof options
  const cleanExitCode = await runSequence([
    {
      args: ['scripts/repo/clean.mts', '--dist', '--types', '--quiet'],
      command: 'node',
    },
  ])
  if (cleanExitCode !== 0) {
    if (!quiet) {
      logger.error('Clean failed')
    }
    return cleanExitCode
  }
  if (!quiet) {
    logger.success('Build Cleaned')
  }
  const results = await Promise.allSettled([
    buildSource({ ...options, skipClean: true }),
    buildTypes({ ...options, skipClean: true }),
  ])
  const srcResult: BuildSourceResult =
    results[0].status === 'fulfilled'
      ? results[0].value
      : { exitCode: 1, buildTime: 0 }
  const typesExitCode = results[1].status === 'fulfilled' ? results[1].value : 1
  if (!quiet) {
    if (srcResult.exitCode === 0) {
      logger.success(`Source Bundle (${srcResult.buildTime}ms)`)
    }
    if (typesExitCode === 0) {
      logger.success('Type Declarations')
    }
  }
  return srcResult.exitCode !== 0 ? srcResult.exitCode : typesExitCode
}

export async function runSelectedBuild(
  mode: BuildMode,
  options: BuildOptions,
): Promise<number> {
  const opts = { __proto__: null, ...options } as typeof options
  if (!opts.quiet) {
    printHeader(`Build Runner (${mode})`)
  }
  if (mode === 'watch') {
    return watchBuild(options)
  }
  if (mode === 'full') {
    return runFullBuild(options)
  }
  const exitCode =
    mode === 'types'
      ? await buildTypes(options)
      : (await buildSource(options)).exitCode
  if (exitCode === 0 && !opts.quiet) {
    logger.success(mode === 'types' ? 'Type Declarations' : 'Source Bundle')
  }
  return exitCode
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

    const quiet = Boolean(values.quiet || values.silent)
    const verbose = Boolean(values.verbose)

    // Check if build is needed
    if (values.needed && !isBuildNeeded()) {
      if (!quiet) {
        logger.info('Build artifacts exist, skipping build')
      }
      process.exitCode = 0
      return
    }

    const exitCode = await runSelectedBuild(selectBuildMode(values), {
      quiet,
      verbose,
      analyze: Boolean(values.analyze),
    })

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

const SCRIPT_META = {
  describe: 'build SDK bundles and declarations',
  help: `Usage: pnpm build [options]\n\n--src  build source only
--types  build declarations only
--watch  watch source changes
--needed  skip existing outputs
--analyze  report bundle size
--quiet, --silent  suppress progress
--verbose  show detailed output\n--help, -h  show usage\n--describe  show purpose`,
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
