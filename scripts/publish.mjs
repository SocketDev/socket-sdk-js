/**
 * @fileoverview Standardized publish runner for Socket projects.
 * Supports both simple single-package and complex multi-package publishing.
 */

import { spawn } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import colors from 'yoctocolors-cjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')
const WIN32 = process.platform === 'win32'

// Simple inline logger.
const log = {
  info: msg => console.log(msg),
  error: msg => console.error(`${colors.red('✗')} ${msg}`),
  success: msg => console.log(`${colors.green('✓')} ${msg}`),
  step: msg => console.log(`\n${msg}`),
  substep: msg => console.log(`  ${msg}`),
  progress: msg => process.stdout.write(`  ∴ ${msg}`),
  done: msg => {
    process.stdout.write('\r\x1b[K')
    console.log(`  ${colors.green('✓')} ${msg}`)
  },
  failed: msg => {
    process.stdout.write('\r\x1b[K')
    console.log(`  ${colors.red('✗')} ${msg}`)
  },
  warn: msg => console.log(`${colors.yellow('⚠')} ${msg}`)
}

function printHeader(title) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'─'.repeat(60)}`)
}

function printFooter(message) {
  console.log(`\n${'─'.repeat(60)}`)
  if (message) {
    console.log(`  ${colors.green('✓')} ${message}`)
  }
}

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: rootPath,
      ...(WIN32 && { shell: true }),
      ...options,
    })

    child.on('exit', code => {
      resolve(code || 0)
    })

    child.on('error', error => {
      reject(error)
    })
  })
}

async function runCommandWithOutput(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    const child = spawn(command, args, {
      cwd: rootPath,
      ...(WIN32 && { shell: true }),
      ...options,
    })

    if (child.stdout) {
      child.stdout.on('data', data => {
        stdout += data
      })
    }

    if (child.stderr) {
      child.stderr.on('data', data => {
        stderr += data
      })
    }

    child.on('exit', code => {
      resolve({ exitCode: code || 0, stdout, stderr })
    })

    child.on('error', error => {
      reject(error)
    })
  })
}

/**
 * Read package.json from the project.
 */
async function readPackageJson(pkgPath = rootPath) {
  const packageJsonPath = path.join(pkgPath, 'package.json')
  const content = await fs.readFile(packageJsonPath, 'utf8')
  return JSON.parse(content)
}

/**
 * Check if the working directory is clean.
 */
async function checkGitStatus() {
  const result = await runCommandWithOutput('git', ['status', '--porcelain'])
  if (result.stdout.trim()) {
    log.error('Working directory is not clean')
    log.info('Uncommitted changes:')
    console.log(result.stdout)
    return false
  }
  return true
}

/**
 * Check if we're on the main/master branch.
 */
async function checkGitBranch() {
  const result = await runCommandWithOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = result.stdout.trim()
  if (branch !== 'main' && branch !== 'master') {
    log.warn(`Not on main/master branch (current: ${branch})`)
    return false
  }
  return true
}

/**
 * Get the current version from package.json.
 */
async function getCurrentVersion(pkgPath = rootPath) {
  const pkgJson = await readPackageJson(pkgPath)
  return pkgJson.version
}

/**
 * Check if a version exists on npm.
 */
async function versionExists(packageName, version) {
  const result = await runCommandWithOutput('npm', [
    'view',
    `${packageName}@${version}`,
    'version'
  ], { stdio: 'pipe' })

  return result.exitCode === 0
}

/**
 * Run pre-publish checks.
 */
async function runPrePublishChecks(options = {}) {
  const { skipGitCheck = false, skipBranchCheck = false } = options

  log.step('Running pre-publish checks')

  // Check git status.
  if (!skipGitCheck) {
    log.progress('Checking git status')
    const gitClean = await checkGitStatus()
    if (!gitClean) {
      log.failed('Git status check failed')
      return false
    }
    log.done('Git status clean')
  }

  // Check git branch.
  if (!skipBranchCheck) {
    log.progress('Checking git branch')
    const onMainBranch = await checkGitBranch()
    if (!onMainBranch && !options.force) {
      log.failed('Not on main/master branch')
      return false
    }
    if (!onMainBranch) {
      log.done('Branch check skipped (forced)')
    } else {
      log.done('On main/master branch')
    }
  }

  // Run tests.
  log.progress('Running tests')
  const testCode = await runCommand('pnpm', ['test', '--all'], { stdio: 'pipe' })
  if (testCode !== 0) {
    log.failed('Tests failed')
    // Re-run with output.
    await runCommand('pnpm', ['test', '--all'])
    return false
  }
  log.done('Tests passed')

  // Run checks.
  log.progress('Running checks')
  const checkCode = await runCommand('pnpm', ['check', '--all'], { stdio: 'pipe' })
  if (checkCode !== 0) {
    log.failed('Checks failed')
    // Re-run with output.
    await runCommand('pnpm', ['check', '--all'])
    return false
  }
  log.done('Checks passed')

  return true
}

/**
 * Build the project.
 */
async function buildProject() {
  log.step('Building project')

  log.progress('Cleaning build directories')
  const cleanCode = await runCommand('pnpm', ['clean', '--dist'], { stdio: 'pipe' })
  if (cleanCode !== 0) {
    log.failed('Clean failed')
    return false
  }
  log.done('Build directories cleaned')

  log.progress('Building package')
  const buildCode = await runCommand('pnpm', ['build'], { stdio: 'pipe' })
  if (buildCode !== 0) {
    log.failed('Build failed')
    // Re-run with output.
    await runCommand('pnpm', ['build'])
    return false
  }
  log.done('Build complete')

  return true
}

/**
 * Publish a single package (simple flow).
 */
async function publishSimple(options = {}) {
  const { dryRun = false, tag = 'latest', access = 'public', otp } = options

  const pkgJson = await readPackageJson()
  const packageName = pkgJson.name
  const version = pkgJson.version

  log.step(`Publishing ${packageName}@${version}`)

  // Check if version already exists.
  log.progress('Checking npm registry')
  const exists = await versionExists(packageName, version)
  if (exists) {
    log.warn(`Version ${version} already exists on npm`)
    if (!options.force) {
      return false
    }
  }
  log.done('Version check complete')

  // Prepare publish args.
  const publishArgs = ['publish', '--access', access, '--tag', tag]

  // Add provenance if available (npm >= 9.5.0).
  if (!dryRun) {
    publishArgs.push('--provenance')
  }

  if (dryRun) {
    publishArgs.push('--dry-run')
  }

  if (otp) {
    publishArgs.push('--otp', otp)
  }

  // Publish.
  log.progress(dryRun ? 'Running dry-run publish' : 'Publishing to npm')
  const publishCode = await runCommand('npm', publishArgs)

  if (publishCode !== 0) {
    log.failed('Publish failed')
    return false
  }

  if (dryRun) {
    log.done('Dry-run publish complete')
  } else {
    log.done(`Published ${packageName}@${version} to npm`)
  }

  return true
}

/**
 * Publish multiple packages (complex flow).
 * This should be overridden by projects with specific needs.
 */
async function publishComplex(options = {}) {
  // Check for project-specific publish script.
  const projectPublishPath = path.join(rootPath, 'scripts', 'publish-packages.mjs')
  if (existsSync(projectPublishPath)) {
    log.step('Running project-specific publish script')
    const exitCode = await runCommand('node', [projectPublishPath], {
      env: {
        ...process.env,
        ...options.env
      }
    })
    return exitCode === 0
  }

  // Fall back to simple publish.
  log.info('No project-specific publish script found, using simple flow')
  return publishSimple(options)
}

/**
 * Create git tag for the release.
 */
async function createGitTag(version, options = {}) {
  const { push = false, force = false } = options

  const tagName = `v${version}`

  log.step('Creating git tag')

  // Check if tag already exists.
  log.progress(`Checking for tag ${tagName}`)
  const tagCheckResult = await runCommandWithOutput('git', ['tag', '-l', tagName])
  if (tagCheckResult.stdout.trim()) {
    if (!force) {
      log.warn(`Tag ${tagName} already exists`)
      return false
    }
    log.warn(`Tag ${tagName} already exists (will overwrite)`)
  } else {
    log.done('Tag does not exist')
  }

  // Create tag.
  log.progress(`Creating tag ${tagName}`)
  const tagArgs = ['tag', tagName, '-m', `Release ${tagName}`]
  if (force) {
    tagArgs.push('-f')
  }

  const tagCode = await runCommand('git', tagArgs)
  if (tagCode !== 0) {
    log.failed('Tag creation failed')
    return false
  }
  log.done(`Created tag ${tagName}`)

  // Push tag if requested.
  if (push) {
    log.progress('Pushing tag to remote')
    const pushArgs = ['push', 'origin', tagName]
    if (force) {
      pushArgs.push('-f')
    }

    const pushCode = await runCommand('git', pushArgs)
    if (pushCode !== 0) {
      log.failed('Tag push failed')
      return false
    }
    log.done('Pushed tag to remote')
  }

  return true
}

async function main() {
  try {
    // Parse arguments.
    const { values } = parseArgs({
      options: {
        help: {
          type: 'boolean',
          default: false,
        },
        'dry-run': {
          type: 'boolean',
          default: false,
        },
        force: {
          type: 'boolean',
          default: false,
        },
        'skip-checks': {
          type: 'boolean',
          default: false,
        },
        'skip-build': {
          type: 'boolean',
          default: false,
        },
        'skip-git': {
          type: 'boolean',
          default: false,
        },
        'skip-tag': {
          type: 'boolean',
          default: false,
        },
        complex: {
          type: 'boolean',
          default: false,
        },
        tag: {
          type: 'string',
          default: 'latest',
        },
        access: {
          type: 'string',
          default: 'public',
        },
        otp: {
          type: 'string',
        },
      },
      allowPositionals: false,
      strict: false,
    })

    // Show help if requested.
    if (values.help) {
      console.log('\nUsage: pnpm publish [options]')
      console.log('\nOptions:')
      console.log('  --help         Show this help message')
      console.log('  --dry-run      Perform a dry-run without publishing')
      console.log('  --force        Force publish even with warnings')
      console.log('  --skip-checks  Skip pre-publish checks')
      console.log('  --skip-build   Skip build step')
      console.log('  --skip-git     Skip git status checks')
      console.log('  --skip-tag     Skip git tag creation')
      console.log('  --complex      Use complex multi-package flow')
      console.log('  --tag <tag>    npm dist-tag (default: latest)')
      console.log('  --access <access>  Package access level (default: public)')
      console.log('  --otp <otp>    npm one-time password')
      console.log('\nExamples:')
      console.log('  pnpm publish              # Standard publish flow')
      console.log('  pnpm publish --dry-run    # Dry-run to test')
      console.log('  pnpm publish --complex    # Multi-package publish')
      console.log('  pnpm publish --otp 123456 # Publish with OTP')
      process.exitCode = 0
      return
    }

    printHeader('Publish Runner')

    // Get current version.
    const version = await getCurrentVersion()
    log.info(`Current version: ${version}`)

    // Run pre-publish checks unless skipped.
    if (!values['skip-checks']) {
      const checksPass = await runPrePublishChecks({
        skipGitCheck: values['skip-git'],
        skipBranchCheck: values['skip-git'],
        force: values.force
      })
      if (!checksPass && !values.force) {
        log.error('Pre-publish checks failed')
        process.exitCode = 1
        return
      }
    }

    // Build unless skipped.
    if (!values['skip-build']) {
      const buildSuccess = await buildProject()
      if (!buildSuccess && !values.force) {
        log.error('Build failed')
        process.exitCode = 1
        return
      }
    }

    // Publish.
    let publishSuccess = false
    if (values.complex) {
      publishSuccess = await publishComplex({
        dryRun: values['dry-run'],
        tag: values.tag,
        access: values.access,
        otp: values.otp,
        force: values.force
      })
    } else {
      publishSuccess = await publishSimple({
        dryRun: values['dry-run'],
        tag: values.tag,
        access: values.access,
        otp: values.otp,
        force: values.force
      })
    }

    if (!publishSuccess && !values.force) {
      log.error('Publish failed')
      process.exitCode = 1
      return
    }

    // Create git tag unless skipped or dry-run.
    if (!values['skip-tag'] && !values['dry-run']) {
      await createGitTag(version, {
        push: true,
        force: values.force
      })
    }

    printFooter('Publish completed successfully!')
    process.exitCode = 0
  } catch (error) {
    log.error(`Publish runner failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(console.error)