/**
 * @fileoverview Publish runner for Socket SDK.
 * Validates build artifacts exist, then publishes to npm.
 * Build and checks should be run separately (e.g., via ci:validate).
 */

import { spawn } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parseArgs } from '@socketsecurity/lib/argv/parse'
import { getDefaultLogger } from '@socketsecurity/lib/logger'

const logger = getDefaultLogger()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')
const WIN32 = process.platform === 'win32'

// Simple inline logger.
const log = {
  done: msg => {
    logger.clearLine()
    logger.substep(msg)
  },
  error: msg => logger.fail(msg),
  failed: msg => {
    logger.clearLine()
    logger.substep(msg)
  },
  info: msg => logger.log(msg),
  progress: msg => logger.progress(msg),
  step: msg => logger.log(`\n${msg}`),
  substep: msg => logger.substep(msg),
  success: msg => logger.success(msg),
  warn: msg => logger.warn(msg),
}

function printHeader(title) {
  logger.log(`\n${'─'.repeat(60)}`)
  logger.log(`  ${title}`)
  logger.log(`${'─'.repeat(60)}`)
}

function printFooter(message) {
  logger.log(`\n${'─'.repeat(60)}`)
  if (message) {
    logger.substep(message)
  }
}

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootPath,
      stdio: 'inherit',
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
      resolve({ exitCode: code || 0, stderr, stdout })
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
  try {
    return JSON.parse(content)
  } catch (e) {
    throw new Error(
      `Failed to parse ${packageJsonPath}: ${e?.message || 'Unknown error'}`,
      { cause: e },
    )
  }
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
  const result = await runCommandWithOutput(
    'npm',
    ['view', `${packageName}@${version}`, 'version'],
    { stdio: 'pipe' },
  )

  return result.exitCode === 0
}

/**
 * Check if this is the registry package.
 */
function isRegistryPackage() {
  // socket-registry has a registry subdirectory with hundreds of packages.
  return existsSync(path.join(rootPath, 'registry', 'package.json'))
}

/**
 * Validate that build artifacts exist based on package.json exports.
 */
async function validateBuildArtifacts() {
  log.step('Validating build artifacts')

  const pkgJson = await readPackageJson()
  const missing = []

  // Check exports from package.json.
  if (pkgJson.exports) {
    for (const [exportPath, exportValue] of Object.entries(pkgJson.exports)) {
      // Skip package.json export.
      if (exportPath === './package.json') {
        continue
      }

      // Handle both string and object export values.
      const files =
        typeof exportValue === 'string'
          ? [exportValue]
          : Object.values(exportValue).filter(v => typeof v === 'string')

      for (const file of files) {
        const filePath = path.join(rootPath, file)
        if (!existsSync(filePath)) {
          missing.push(file)
        }
      }
    }
  }

  // Check main entry point.
  if (pkgJson.main) {
    const mainPath = path.join(rootPath, pkgJson.main)
    if (!existsSync(mainPath)) {
      missing.push(pkgJson.main)
    }
  }

  // Check types entry point.
  if (pkgJson.types) {
    const typesPath = path.join(rootPath, pkgJson.types)
    if (!existsSync(typesPath)) {
      missing.push(pkgJson.types)
    }
  }

  if (missing.length > 0) {
    log.error('Missing build artifacts:')
    for (const file of missing) {
      logger.substep(`  ${file}`)
    }
    return false
  }

  log.success('Build artifacts validated')
  return true
}

/**
 * Publish a single package.
 */
async function publishPackage(options = {}) {
  const { access = 'public', dryRun = false, otp, tag = 'latest' } = options

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

  // Add provenance by default (works with trusted publishers).
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
 * Push existing git tag if it exists locally but not remotely.
 * Tags should be created with version bump commits, not by this script.
 */
async function pushExistingTag(version, options = {}) {
  const { force = false } = options

  const tagName = `v${version}`

  log.step('Checking git tag')

  // Check if tag exists locally.
  log.progress(`Checking for local tag ${tagName}`)
  const localTagResult = await runCommandWithOutput('git', [
    'tag',
    '-l',
    tagName,
  ])
  if (!localTagResult.stdout.trim()) {
    log.done('No local tag to push')
    return true
  }
  log.done(`Local tag ${tagName} exists`)

  // Check if tag exists on remote.
  log.progress(`Checking remote for tag ${tagName}`)
  const remoteTagResult = await runCommandWithOutput('git', [
    'ls-remote',
    '--tags',
    'origin',
    tagName,
  ])
  if (remoteTagResult.stdout.trim()) {
    log.done('Tag already exists on remote')
    return true
  }

  // Push existing tag to remote.
  log.progress(`Pushing tag ${tagName} to remote`)
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

  return true
}

async function main() {
  try {
    // Parse arguments.
    const { values } = parseArgs({
      options: {
        access: {
          default: 'public',
          type: 'string',
        },
        'dry-run': {
          default: false,
          type: 'boolean',
        },
        force: {
          default: false,
          type: 'boolean',
        },
        help: {
          default: false,
          type: 'boolean',
        },
        otp: {
          type: 'string',
        },
        'skip-tag': {
          default: false,
          type: 'boolean',
        },
        tag: {
          default: 'latest',
          type: 'string',
        },
      },
      allowPositionals: false,
      strict: false,
    })

    // Show help if requested.
    if (values.help) {
      logger.log('\nUsage: pnpm publish [options]')
      logger.log('\nOptions:')
      logger.log('  --help         Show this help message')
      logger.log('  --dry-run      Perform a dry-run without publishing')
      logger.log('  --force        Force publish even with warnings')
      logger.log('  --skip-tag     Skip git tag push')
      logger.log('  --tag <tag>    npm dist-tag (default: latest)')
      logger.log('  --access <access>  Package access level (default: public)')
      logger.log('  --otp <otp>    npm one-time password')
      logger.log('\nExamples:')
      logger.log('  pnpm publish              # Validate artifacts and publish')
      logger.log('  pnpm publish --dry-run    # Dry-run to test')
      logger.log('  pnpm publish --otp 123456 # Publish with OTP')
      process.exitCode = 0
      return
    }

    printHeader('Publish Runner')

    // Get current version.
    const version = await getCurrentVersion()
    log.info(`Current version: ${version}`)

    // Validate that build artifacts exist.
    const artifactsExist = await validateBuildArtifacts()
    if (!artifactsExist && !values.force) {
      log.error('Build artifacts missing - run pnpm build first')
      process.exitCode = 1
      return
    }

    // Publish.
    const publishSuccess = await publishPackage({
      access: values.access,
      dryRun: values['dry-run'],
      force: values.force,
      otp: values.otp,
      tag: values.tag,
    })

    if (!publishSuccess && !values.force) {
      log.error('Publish failed')
      process.exitCode = 1
      return
    }

    // Push git tag if it exists (but not for registry packages with hundreds of packages).
    // Tags are created by version bump commits, not by this script.
    if (!values['skip-tag'] && !values['dry-run'] && !isRegistryPackage()) {
      await pushExistingTag(version, {
        force: values.force,
      })
    }

    printFooter('Publish completed successfully!')
    process.exitCode = 0
  } catch (error) {
    log.error(`Publish runner failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(e => {
  logger.error(e)
  process.exitCode = 1
})
