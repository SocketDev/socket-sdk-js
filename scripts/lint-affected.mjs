/**
 * @fileoverview Smart linting runner that only lints files affected by changes.
 * Handles lint target selection based on file changes to speed up local and precommit runs.
 * Supports cross-repository linting for Socket projects.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import WIN32 from '@socketsecurity/registry/lib/constants/WIN32'
import { logger } from '@socketsecurity/registry/lib/logger'
import { spawn } from '@socketsecurity/registry/lib/spawn'

import { getChangedFiles, getStagedFiles } from './utils/git.mjs'
import { runCommandQuiet } from './utils/run-command.mjs'

const CORE_LIB_FILES = new Set([
  'src/logger.ts',
  'src/spawn.ts',
  'src/fs.ts',
  'src/promises.ts',
  'src/objects.ts',
  'src/arrays.ts',
  'src/strings.ts',
])

const RUN_ALL_PATTERNS = [
  '.config/**',
  'scripts/utils/**',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig*.json',
  'eslint.config.*',
  '.config/biome.json',
]

// Socket project paths for cross-repo support.
const SOCKET_PROJECTS = [
  '../socket-cli',
  '../socket-sdk-js',
  '../socket-packageurl-js',
  '../socket-registry',
]

/**
 * Check if we should run all linters based on changed files.
 */
function shouldRunAllLinters(changedFiles) {
  // Check if any core files changed.
  for (const file of changedFiles) {
    // Core library files that are widely used.
    if (CORE_LIB_FILES.has(file)) {
      return true
    }

    // Config or infrastructure files.
    for (const pattern of RUN_ALL_PATTERNS) {
      if (file.includes(pattern.replace('**', ''))) {
        return true
      }
    }

    // Core types.
    if (file.includes('src/types.ts')) {
      return true
    }
  }

  return false
}

/**
 * Filter files to only those that should be linted.
 */
function filterLintableFiles(files) {
  // Extensions that we lint.
  const lintableExtensions = new Set([
    '.js',
    '.mjs',
    '.cjs',
    '.ts',
    '.cts',
    '.mts',
    '.json',
    '.jsonc',
    '.md',
    '.yml',
    '.yaml',
  ])

  return files.filter(file => {
    const ext = path.extname(file)
    return lintableExtensions.has(ext)
  })
}

/**
 * Run linters on specific files.
 */
async function runLintersOnFiles(files, options = {}) {
  const { fix = false } = options
  const hasFiles = files.length > 0

  if (!hasFiles) {
    logger.log('No files to lint.\n')
    return
  }

  logger.log(`Linting ${files.length} file(s)...\n`)

  // Build the linter configurations.
  const linters = [
    {
      args: [
        'exec',
        'eslint',
        '--config',
        '.config/eslint.config.mjs',
        '--report-unused-disable-directives',
        ...(fix ? ['--fix'] : []),
        ...files,
      ],
      name: 'eslint',
      enabled: true,
    },
  ]

  let hadError = false

  for (const { args, enabled, name } of linters) {
    if (!enabled) {
      continue
    }

    logger.log(`  - Running ${name}...`)
     
    const result = await runCommandQuiet('pnpm', args)

    if (result.exitCode !== 0) {
      // When fixing, non-zero exit codes are normal if fixes were applied.
      if (!fix || (result.stderr && result.stderr.trim().length > 0)) {
        if (result.stderr) {
          logger.error(`${name} errors:`, result.stderr)
        }
        if (result.stdout && !fix) {
          logger.log(result.stdout)
        }
        hadError = true
      }
    }
  }

  return hadError
}

/**
 * Run linters on all files.
 */
async function runLintersOnAll(options = {}) {
  const { fix = false } = options

  logger.log('Running linters on all files...\n')

  const linters = [
    {
      args: [
        'exec',
        'eslint',
        '--config',
        '.config/eslint.config.mjs',
        '--report-unused-disable-directives',
        ...(fix ? ['--fix'] : []),
        '.',
      ],
      name: 'eslint',
      enabled: true,
    },
  ]

  let hadError = false

  for (const { args, enabled, name } of linters) {
    if (!enabled) {
      continue
    }

    logger.log(`  - Running ${name}...`)
     
    const result = await runCommandQuiet('pnpm', args)

    if (result.exitCode !== 0) {
      // When fixing, non-zero exit codes are normal if fixes were applied.
      if (!fix || (result.stderr && result.stderr.trim().length > 0)) {
        if (result.stderr) {
          logger.error(`${name} errors:`, result.stderr)
        }
        if (result.stdout && !fix) {
          logger.log(result.stdout)
        }
        hadError = true
      }
    }
  }

  return hadError
}

/**
 * Detect Socket project from current working directory.
 */
async function detectSocketProject(cwd) {
  try {
    const packageJsonPath = path.join(cwd, 'package.json')
    const content = await fs.readFile(packageJsonPath, 'utf8')
    const pkg = JSON.parse(content)
    const name = pkg.name || ''

    if (
      name.startsWith('@socketsecurity/') ||
      name === 'socket-cli-js' ||
      cwd.includes('socket-')
    ) {
      return path.basename(cwd)
    }
  } catch {
    // Not a valid package.json.
  }

  return null
}

/**
 * Main function to determine and run affected linters.
 */
async function main() {
  try {
    // Get arguments.
    let args = process.argv.slice(2)

    // Remove the -- separator if present.
    if (args[0] === '--') {
      args = args.slice(1)
    }

    // Check for --all flag.
    const allIndex = args.indexOf('--all')
    const runAll = allIndex !== -1

    if (runAll) {
      args.splice(allIndex, 1)
    }

    // Check for --fix flag.
    const fixIndex = args.indexOf('--fix')
    const hasFix = fixIndex !== -1

    if (hasFix) {
      args.splice(fixIndex, 1)
    }

    // Check for --staged flag.
    const stagedIndex = args.indexOf('--staged')
    const hasStaged = stagedIndex !== -1

    if (hasStaged) {
      args.splice(stagedIndex, 1)
    }

    // Check for --cross-repo flag.
    const crossRepoIndex = args.indexOf('--cross-repo')
    const hasCrossRepo = crossRepoIndex !== -1

    if (hasCrossRepo) {
      args.splice(crossRepoIndex, 1)
    }

    // If specific files are provided, use them.
    if (args.length > 0 && !args[0].startsWith('-')) {
      const files = filterLintableFiles(args)
      const hadError = await runLintersOnFiles(files, { fix: hasFix })
      process.exitCode = hadError ? 1 : 0
      return
    }

    // Handle cross-repo linting.
    if (hasCrossRepo) {
      const currentProject = await detectSocketProject(process.cwd())

      if (!currentProject) {
        logger.error(
          'Not in a recognized Socket project directory for cross-repo linting.',
        )
        process.exitCode = 1
        return
      }

      logger.log(`Cross-repo linting from ${currentProject}...\n`)

      // Run lint-affected in each Socket project.
      let hadError = false

      for (const projectPath of SOCKET_PROJECTS) {
        const projectName = path.basename(projectPath)

        // Skip current project.
        if (projectName === currentProject) {
          continue
        }

        const absolutePath = path.resolve(process.cwd(), projectPath)

        // Check if project exists.
        try {
           
          await fs.access(absolutePath)
        } catch {
          logger.log(`  - Skipping ${projectName} (not found)`)
          continue
        }

        logger.log(`  - Linting ${projectName}...`)

        // Run lint-affected in the project.
         
        const result = await spawn(
          'node',
          [
            path.join(absolutePath, 'scripts', 'lint-affected.mjs'),
            ...(hasStaged ? ['--staged'] : []),
            ...(hasFix ? ['--fix'] : []),
          ],
          {
            cwd: absolutePath,
            shell: WIN32,
            stdio: 'inherit',
          },
        )
          .then(res => res.code || 0)
          .catch(() => 1)

        if (result !== 0) {
          hadError = true
        }
      }

      // Also lint the current project.
      logger.log(`  - Linting ${currentProject}...`)
      const currentError = await runLintersBasedOnChanges({
        fix: hasFix,
        runAll: false,
        staged: hasStaged,
      })

      process.exitCode = hadError || currentError ? 1 : 0
      return
    }

    // Normal affected linting.
    const hadError = await runLintersBasedOnChanges({
      fix: hasFix,
      runAll,
      staged: hasStaged,
    })

    process.exitCode = hadError ? 1 : 0
  } catch (e) {
    logger.error('Error running linters:', e)
    process.exitCode = 1
  }
}

/**
 * Run linters based on changed files.
 */
async function runLintersBasedOnChanges(options = {}) {
  const { fix = false, runAll = false, staged = false } = options

  // Get changed files.
  const isPrecommit = staged || process.env['PRE_COMMIT'] === '1'
  let changedFiles = []

  if (isPrecommit) {
    changedFiles = await getStagedFiles({ absolute: false })
    logger.log(`Found ${changedFiles.length} staged file(s)\n`)
  } else {
    changedFiles = await getChangedFiles({ absolute: false })
    logger.log(`Found ${changedFiles.length} changed file(s)\n`)
  }

  // If no files changed and not forced, skip linting.
  if (!changedFiles.length && !runAll) {
    logger.log('No changed files, skipping linters.\n')
    return false
  }

  // Decide if we should run all linters.
  if (runAll || shouldRunAllLinters(changedFiles)) {
    return await runLintersOnAll({ fix })
  }

  // Filter to only lintable files.
  const lintableFiles = filterLintableFiles(changedFiles)

  if (!lintableFiles.length) {
    logger.log('No lintable files changed, skipping linters.\n')
    return false
  }

  // Run linters on specific files.
  return await runLintersOnFiles(lintableFiles, { fix })
}

main().catch(console.error)