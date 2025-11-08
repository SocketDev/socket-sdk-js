/**
 * @fileoverview Version bump script with optional AI changelog generation.
 * Creates version bump commits with package.json, lockfile, and changelog updates.
 */

import { spawn } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import semver from 'semver'
import colors from 'yoctocolors-cjs'

import { parseArgs } from '@socketsecurity/lib/argv/parse'
import { getDefaultLogger } from '@socketsecurity/lib/logger'

const logger = getDefaultLogger()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')
const WIN32 = process.platform === 'win32'

// Simple logger with colored output
const log = {
  error: msg => logger.error(`${colors.red('✗')} ${msg}`),
  info: msg => logger.log(msg),
  step: msg => logger.log(`\n${msg}`),
  substep: msg => logger.log(`  ${msg}`),
  success: msg => logger.log(`${colors.green('✓')} ${msg}`),
  progress: msg => process.stdout.write(`  ${colors.cyan('→')} ${msg}\r`),
  done: msg => {
    process.stdout.write('\r\x1b[K')
    logger.log(`  ${colors.green('✓')} ${msg}`)
  },
  failed: msg => {
    process.stdout.write('\r\x1b[K')
    logger.log(`  ${colors.red('✗')} ${msg}`)
  },
}

function printHeader(title) {
  logger.log(`\n${'═'.repeat(60)}`)
  logger.log(`  ${title}`)
  logger.log(`${'═'.repeat(60)}`)
}

function printFooter(message) {
  logger.log(`\n${'═'.repeat(60)}`)
  if (message) {
    logger.log(`  ${colors.green('✓')} ${message}`)
  }
  logger.log(`${'═'.repeat(60)}\n`)
}

/**
 * Prompt user for input.
 */
async function prompt(question, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise(resolve => {
    const displayDefault = defaultValue ? ` (${defaultValue})` : ''
    rl.question(`${question}${displayDefault}: `, answer => {
      rl.close()
      resolve(answer.trim() || defaultValue)
    })
  })
}

/**
 * Prompt user for yes/no confirmation.
 */
async function confirm(question, defaultYes = true) {
  const defaultHint = defaultYes ? 'Y/n' : 'y/N'
  const answer = await prompt(
    `${question} [${defaultHint}]`,
    defaultYes ? 'y' : 'n',
  )
  return answer.toLowerCase().startsWith('y')
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
 * Check if claude-console is available.
 */
async function checkClaude() {
  const checkCommand = WIN32 ? 'where' : 'which'
  const result = await runCommandWithOutput(checkCommand, ['claude-console'])

  if (result.exitCode !== 0) {
    const aliasResult = await runCommandWithOutput(checkCommand, ['claude'])
    if (aliasResult.exitCode !== 0) {
      return false
    }
    return 'claude'
  }
  return 'claude-console'
}

/**
 * Read package.json from the project.
 */
async function readPackageJson() {
  const packageJsonPath = path.join(rootPath, 'package.json')
  const content = await fs.readFile(packageJsonPath, 'utf8')
  return JSON.parse(content)
}

/**
 * Write package.json to the project.
 */
async function writePackageJson(pkgJson) {
  const packageJsonPath = path.join(rootPath, 'package.json')
  await fs.writeFile(packageJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`)
}

/**
 * Get the current version from package.json.
 */
async function getCurrentVersion() {
  const pkgJson = await readPackageJson()
  return pkgJson.version
}

/**
 * Determine the new version based on bump type.
 */
function getNewVersion(currentVersion, bumpType) {
  // Check if bumpType is a valid semver version.
  if (semver.valid(bumpType)) {
    return bumpType
  }

  // Otherwise treat as release type.
  const validTypes = [
    'major',
    'minor',
    'patch',
    'premajor',
    'preminor',
    'prepatch',
    'prerelease',
  ]
  if (!validTypes.includes(bumpType)) {
    throw new Error(
      `Invalid bump type: ${bumpType}. Must be one of: ${validTypes.join(', ')} or a valid semver version`,
    )
  }

  return semver.inc(currentVersion, bumpType)
}

/**
 * Check git working directory is clean.
 */
async function checkGitStatus() {
  const result = await runCommandWithOutput('git', ['status', '--porcelain'])
  return result.stdout.trim() === ''
}

/**
 * Check if on main/master branch.
 */
async function checkGitBranch() {
  const result = await runCommandWithOutput('git', [
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ])
  const branch = result.stdout.trim()
  return branch === 'main' || branch === 'master'
}

/**
 * Get recent commits for changelog context.
 */
async function getRecentCommits(count = 20) {
  const result = await runCommandWithOutput('git', [
    'log',
    `-${count}`,
    '--pretty=format:%h %s',
  ])
  return result.stdout.trim()
}

/**
 * Generate changelog entry using Claude AI.
 */
async function generateChangelog(claudeCmd, currentVersion, newVersion) {
  log.step('Generating changelog with Claude')

  const recentCommits = await getRecentCommits()
  const pkgJson = await readPackageJson()
  const packageName = pkgJson.name || 'this package'

  const prompt = `Generate a changelog entry for ${packageName} version ${newVersion}.

Current version: ${currentVersion}
New version: ${newVersion}

Recent commits since last release:
${recentCommits}

Generate a changelog entry following the Keep a Changelog format (https://keepachangelog.com/).
Include only the entry for this version, not the entire file.
Format it like this:

## [${newVersion}] - ${new Date().toISOString().split('T')[0]}

### Added
- New features

### Changed
- Changes in existing functionality

### Fixed
- Bug fixes

Only include sections that have actual changes. Focus on user-facing changes.
Be concise but informative. Group related changes together.`

  log.progress('Asking Claude to generate changelog')

  const claudeResult = await runCommandWithOutput(claudeCmd, [], {
    input: prompt,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  if (claudeResult.exitCode !== 0) {
    log.failed('Claude failed to generate changelog')
    throw new Error('Claude failed to generate changelog')
  }

  log.done('Changelog generated')
  return claudeResult.stdout.trim()
}

/**
 * Update CHANGELOG.md with new entry.
 */
async function updateChangelog(changelogEntry) {
  const changelogPath = path.join(rootPath, 'CHANGELOG.md')

  let existingContent = ''
  if (existsSync(changelogPath)) {
    existingContent = await fs.readFile(changelogPath, 'utf8')
  } else {
    // Create new changelog with header.
    existingContent = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

`
  }

  // Find insertion point (after header, before first version entry).
  const lines = existingContent.split('\n')
  let insertIndex = lines.length

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## [')) {
      insertIndex = i
      break
    }
  }

  // Insert new entry.
  lines.splice(insertIndex, 0, changelogEntry, '')
  const newContent = lines.join('\n')

  await fs.writeFile(changelogPath, newContent)
}

/**
 * Review changelog with simple prompt.
 */
async function reviewChangelog(changelogEntry) {
  logger.log(`\n${colors.blue('━'.repeat(60))}`)
  logger.log(colors.blue('Proposed Changelog Entry:'))
  logger.log(colors.blue('━'.repeat(60)))
  logger.log(changelogEntry)
  logger.log(`${colors.blue('━'.repeat(60))}\n`)

  const response = await prompt('Accept this changelog? (yes/no/edit)', 'yes')

  if (response.toLowerCase().startsWith('y')) {
    return changelogEntry
  }

  if (response.toLowerCase().startsWith('e')) {
    // Allow manual editing.
    const manualEntry = await prompt(
      'Enter changelog entry (or press Enter to cancel)',
    )
    if (manualEntry) {
      return manualEntry
    }
    throw new Error('Changelog generation cancelled')
  }

  throw new Error('Changelog generation cancelled')
}

async function main() {
  try {
    // Parse arguments.
    const { values } = parseArgs({
      allowPositionals: false,
      options: {
        bump: {
          default: 'patch',
          type: 'string',
        },
        force: {
          default: false,
          type: 'boolean',
        },
        help: {
          default: false,
          type: 'boolean',
        },
        'no-push': {
          default: false,
          type: 'boolean',
        },
        'skip-changelog': {
          default: false,
          type: 'boolean',
        },
        'skip-checks': {
          default: false,
          type: 'boolean',
        },
      },
      strict: false,
    })

    // Show help if requested.
    if (values.help) {
      logger.log('\nUsage: pnpm bump [options]')
      logger.log('\nOptions:')
      logger.log('  --help           Show this help message')
      logger.log('  --bump <type>    Version bump type (default: patch)')
      logger.log(
        '                   Can be: major, minor, patch, premajor, preminor,',
      )
      logger.log(
        '                   prepatch, prerelease, or a specific version',
      )
      logger.log('  --skip-changelog Skip changelog generation with Claude')
      logger.log('  --skip-checks    Skip git status/branch checks')
      logger.log('  --no-push        Do not push changes to remote')
      logger.log('  --force          Force bump even with warnings')
      logger.log('\nExamples:')
      logger.log('  pnpm bump                    # Bump patch version')
      logger.log('  pnpm bump --bump=minor       # Bump minor version')
      logger.log('  pnpm bump --bump=2.0.0       # Set specific version')
      logger.log(
        '  pnpm bump --skip-changelog   # Skip AI changelog generation',
      )
      logger.log('\nRequires:')
      logger.log(
        '  - claude-console (or claude) CLI tool for changelog generation',
      )
      logger.log('  - Clean git working directory')
      logger.log('  - Main/master branch (unless --force)')
      process.exitCode = 0
      return
    }

    printHeader('Version Bump')

    // Check git status unless skipped.
    if (!values['skip-checks']) {
      log.step('Checking prerequisites')

      log.progress('Checking git status')
      const gitClean = await checkGitStatus()
      if (!gitClean && !values.force) {
        log.failed('Git working directory is not clean')
        process.exitCode = 1
        return
      }
      log.done('Git status clean')

      log.progress('Checking git branch')
      const onMainBranch = await checkGitBranch()
      if (!onMainBranch && !values.force) {
        log.failed('Not on main/master branch')
        process.exitCode = 1
        return
      }
      log.done('On main/master branch')
    }

    // Check for Claude if not skipping changelog.
    let claudeCmd = null
    if (!values['skip-changelog']) {
      log.progress('Checking for Claude CLI')
      claudeCmd = await checkClaude()
      if (!claudeCmd) {
        log.failed('claude-console not found')
        log.error(
          'Please install claude-console: npm install -g @anthropic/claude-console',
        )
        log.info('Or use --skip-changelog to skip AI-generated changelog')
        process.exitCode = 1
        return
      }
      log.done(`Found Claude CLI: ${claudeCmd}`)
    }

    // Get current version.
    const currentVersion = await getCurrentVersion()
    log.info(`Current version: ${currentVersion}`)

    // Calculate new version.
    const newVersion = getNewVersion(currentVersion, values.bump)
    if (!newVersion) {
      log.error('Failed to calculate new version')
      process.exitCode = 1
      return
    }
    log.info(`New version: ${newVersion}`)

    // Confirm version bump.
    if (
      !(await confirm(`Bump version from ${currentVersion} to ${newVersion}?`))
    ) {
      log.info('Version bump cancelled')
      process.exitCode = 0
      return
    }

    // Update package.json.
    log.step('Updating version')
    log.progress('Updating package.json')
    const pkgJson = await readPackageJson()
    pkgJson.version = newVersion
    await writePackageJson(pkgJson)
    log.done('Updated package.json')

    // Update lockfile.
    log.progress('Updating lockfile')
    await runCommand('pnpm', ['install', '--lockfile-only'], { stdio: 'pipe' })
    log.done('Updated lockfile')

    // Generate and review changelog.
    let changelogEntry = null
    if (!values['skip-changelog'] && claudeCmd) {
      changelogEntry = await generateChangelog(
        claudeCmd,
        currentVersion,
        newVersion,
      )
      changelogEntry = await reviewChangelog(changelogEntry)

      log.progress('Updating CHANGELOG.md')
      await updateChangelog(changelogEntry)
      log.done('Updated CHANGELOG.md')
    }

    // Create commit.
    log.step('Creating commit')
    const commitMessage = `chore: bump to v${newVersion}`

    log.progress('Staging changes')
    await runCommand('git', ['add', 'package.json', 'pnpm-lock.yaml'])
    if (changelogEntry) {
      await runCommand('git', ['add', 'CHANGELOG.md'])
    }
    log.done('Changes staged')

    log.progress('Creating commit')
    await runCommand('git', ['commit', '-m', commitMessage])
    log.done(`Created commit: ${commitMessage}`)

    // Create tag.
    log.progress('Creating tag')
    const tagName = `v${newVersion}`
    await runCommand('git', ['tag', tagName, '-m', `Release ${tagName}`])
    log.done(`Created tag: ${tagName}`)

    // Push to remote.
    if (!values['no-push']) {
      if (await confirm('Push changes to remote?')) {
        log.step('Pushing to remote')

        log.progress('Pushing commits')
        await runCommand('git', ['push'])
        log.done('Pushed commits')

        log.progress('Pushing tags')
        await runCommand('git', ['push', '--tags'])
        log.done('Pushed tags')
      }
    }

    printFooter(`Version bumped to ${newVersion}!`)

    log.info('Next steps:')
    log.substep('1. Run `pnpm publish` to publish to npm')
    log.substep('2. Create GitHub release if needed')

    process.exitCode = 0
  } catch (error) {
    log.error(`Version bump failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(e => {
  logger.error(e)
  process.exitCode = 1
})
