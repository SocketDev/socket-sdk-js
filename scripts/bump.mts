/**
 * @fileoverview Version bump script with AI-powered changelog generation.
 * Creates version bump commits with package.json, lockfile, and changelog updates.
 * Includes interactive mode for reviewing and refining AI-generated changelogs.
 */

import { spawn } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import type { ReleaseType } from 'semver'

import semver from 'semver'

import { parseArgs } from '@socketsecurity/lib/argv/parse'
import { getDefaultLogger } from '@socketsecurity/lib/logger'

const logger = getDefaultLogger()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')
const WIN32 = process.platform === 'win32'

// Check if prompts are available for interactive mode.
// First check for local registry build, then check for installed package.
const localPromptsPath = path.join(
  rootPath,
  'registry',
  'dist',
  'lib',
  'cli',
  'prompts.js',
)
const packagePromptsPath = path.join(
  rootPath,
  'node_modules',
  '@socketsecurity',
  'registry',
  'dist',
  'lib',
  'cli',
  'prompts.js',
)

let promptsPath: string | undefined
if (existsSync(localPromptsPath)) {
  promptsPath = localPromptsPath
} else if (existsSync(packagePromptsPath)) {
  promptsPath = packagePromptsPath
}

const hasInteractivePrompts = !!promptsPath

interface InteractivePrompts {
  select: (options: {
    message: string
    choices: Array<{ value: string; name: string }>
  }) => Promise<string>
  confirm: (options: { message: string; default?: boolean }) => Promise<boolean>
  input: (options: {
    message: string
    validate?: (value: string) => boolean | string
  }) => Promise<string>
}

// Conditionally import interactive prompts.
let prompts: InteractivePrompts | undefined
if (hasInteractivePrompts) {
  try {
    prompts = (await import(promptsPath!)) as InteractivePrompts
  } catch {
    // Fall back to basic prompts if import fails.
  }
}

// Simple inline logger.
const log = {
  info: (msg: string) => logger.log(msg),
  error: (msg: string) => logger.fail(msg),
  success: (msg: string) => logger.success(msg),
  step: (msg: string) => logger.log(`\n${msg}`),
  substep: (msg: string) => logger.substep(msg),
  progress: (msg: string) => logger.progress(msg),
  done: (msg: string) => {
    logger.clearLine()
    logger.substep(msg)
  },
  failed: (msg: string) => {
    logger.clearLine()
    logger.substep(msg)
  },
  warn: (msg: string) => logger.warn(msg),
}

function printHeader(title: string): void {
  logger.log(`\n${'─'.repeat(60)}`)
  logger.log(`  ${title}`)
  logger.log(`${'─'.repeat(60)}`)
}

function printFooter(message?: string): void {
  logger.log(`\n${'─'.repeat(60)}`)
  if (message) {
    logger.substep(message)
  }
}

/**
 * Create readline interface for user input.
 */
function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

/**
 * Prompt user for input.
 */
async function prompt(question: string, defaultValue = ''): Promise<string> {
  const rl = createReadline()
  return new Promise<string>(resolve => {
    const displayDefault = defaultValue ? ` (${defaultValue})` : ''
    rl.question(`${question}${displayDefault}: `, (answer: string) => {
      rl.close()
      resolve(answer.trim() || defaultValue)
    })
  })
}

/**
 * Prompt user for yes/no confirmation.
 */
async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const defaultHint = defaultYes ? 'Y/n' : 'y/N'
  const answer = await prompt(
    `${question} [${defaultHint}]`,
    defaultYes ? 'y' : 'n',
  )
  return answer.toLowerCase().startsWith('y')
}

interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

async function runCommand(
  command: string,
  args: string[] = [],
  options: Record<string, unknown> = {},
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: rootPath,
      ...(WIN32 && { shell: true }),
      ...options,
    })

    child.on('exit', (code: number | null) => {
      resolve(code || 0)
    })

    child.on('error', (e: Error) => {
      reject(e)
    })
  })
}

async function runCommandWithOutput(
  command: string,
  args: string[] = [],
  options: Record<string, unknown> = {},
): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    const child = spawn(command, args, {
      cwd: rootPath,
      ...(WIN32 && { shell: true }),
      ...options,
    })

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data
      })
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data
      })
    }

    child.on('exit', (code: number | null) => {
      resolve({ exitCode: code || 0, stdout, stderr })
    })

    child.on('error', (e: Error) => {
      reject(e)
    })
  })
}

/**
 * Check if claude-console is available.
 */
async function checkClaude(): Promise<string | false> {
  const checkCommand = WIN32 ? 'where' : 'which'
  const result = await runCommandWithOutput(checkCommand, ['claude-console'])

  if (result.exitCode !== 0) {
    // Also check common aliases.
    const aliasResult = await runCommandWithOutput(checkCommand, ['claude'])
    if (aliasResult.exitCode !== 0) {
      return false
    }
    return 'claude'
  }
  return 'claude-console'
}

interface BumpPackageJson {
  name?: string
  version: string
  [key: string]: unknown
}

/**
 * Read package.json from the project.
 */
async function readPackageJson(pkgPath = rootPath): Promise<BumpPackageJson> {
  const packageJsonPath = path.join(pkgPath, 'package.json')
  const content = await fs.readFile(packageJsonPath, 'utf8')
  try {
    return JSON.parse(content)
  } catch (e) {
    throw new Error(
      `Failed to parse ${packageJsonPath}: ${e instanceof Error ? e.message : 'Unknown error'}`,
      { cause: e },
    )
  }
}

/**
 * Write package.json to the project.
 */
async function writePackageJson(
  pkgJson: BumpPackageJson,
  pkgPath = rootPath,
): Promise<void> {
  const packageJsonPath = path.join(pkgPath, 'package.json')
  await fs.writeFile(packageJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`)
}

/**
 * Get the current version from package.json.
 */
async function getCurrentVersion(pkgPath = rootPath): Promise<string> {
  const pkgJson = await readPackageJson(pkgPath)
  return pkgJson.version
}

/**
 * Determine the new version based on bump type.
 */
function getNewVersion(
  currentVersion: string,
  bumpType: string,
): string | null {
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

  return semver.inc(currentVersion, bumpType as ReleaseType)
}

/**
 * Check if the working directory is clean.
 */
async function checkGitStatus(): Promise<boolean> {
  const result = await runCommandWithOutput('git', ['status', '--porcelain'])
  if (result.stdout.trim()) {
    log.error('Working directory is not clean')
    log.info('Uncommitted changes:')
    logger.log(result.stdout)
    return false
  }
  return true
}

/**
 * Check if we're on the main/master branch.
 */
async function checkGitBranch(): Promise<boolean> {
  const result = await runCommandWithOutput('git', [
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ])
  const branch = result.stdout.trim()
  if (branch !== 'main' && branch !== 'master') {
    log.warn(`Not on main/master branch (current: ${branch})`)
    return false
  }
  return true
}

/**
 * Get the last few commits for context.
 */
async function getRecentCommits(count = 20): Promise<string> {
  const result = await runCommandWithOutput('git', [
    'log',
    '--oneline',
    '--no-decorate',
    `-${count}`,
  ])
  return result.stdout.trim()
}

/**
 * Check if this is the registry package.
 */
function isRegistryPackage(): boolean {
  return existsSync(path.join(rootPath, 'registry', 'package.json'))
}

/**
 * Get package name for commit message.
 */
async function getPackageName(): Promise<string> {
  if (isRegistryPackage()) {
    return 'registry package'
  }
  const pkgJson = await readPackageJson()
  return pkgJson.name || 'package'
}

/**
 * Generate changelog using Claude.
 */
async function generateChangelog(
  claudeCmd: string,
  currentVersion: string,
  newVersion: string,
): Promise<string> {
  log.step('Generating changelog with Claude')

  // Get recent commits for context.
  const recentCommits = await getRecentCommits()
  const packageName = await getPackageName()

  // Create a temporary file with the prompt.
  const promptPath = path.join(rootPath, '.claude-bump-prompt.tmp')
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

### Removed
- Removed features

Only include sections that have actual changes. Focus on user-facing changes.
Be concise but informative. Group related changes together.`

  await fs.writeFile(promptPath, prompt)

  // Call Claude to generate the changelog.
  log.progress('Asking Claude to generate changelog')

  const claudeResult = await runCommandWithOutput(claudeCmd, [], {
    input: prompt,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  // Clean up temp file.
  try {
    await fs.unlink(promptPath)
  } catch {}

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
async function updateChangelog(changelogEntry: string): Promise<void> {
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

  // Insert new entry after the header but before existing entries.
  const headerEnd = existingContent.indexOf('\n## ')
  if (headerEnd > 0) {
    // Insert before first version entry.
    existingContent =
      existingContent.slice(0, headerEnd) +
      '\n' +
      changelogEntry +
      '\n' +
      existingContent.slice(headerEnd)
  } else {
    // Append to end.
    existingContent += `\n${changelogEntry}\n`
  }

  await fs.writeFile(changelogPath, existingContent)
}

/**
 * Review and refine changelog with user feedback.
 * Uses interactive prompts if available, falls back to basic readline prompts.
 */
async function reviewChangelog(
  claudeCmd: string,
  changelogEntry: string,
  interactive = false,
): Promise<string> {
  logger.log(`\n${'━'.repeat(60)}`)
  logger.log('Proposed Changelog Entry:')
  logger.log('━'.repeat(60))
  logger.log(changelogEntry)
  logger.log(`${'━'.repeat(60)}\n`)

  // Use interactive prompts if available and requested.
  if (interactive && prompts) {
    return await interactiveReviewChangelog(claudeCmd, changelogEntry)
  }

  // Fall back to basic prompts.
  while (true) {
    const response = await prompt('Accept this changelog? (yes/no/edit)', 'yes')

    if (response.toLowerCase().startsWith('y')) {
      return changelogEntry
    }

    if (response.toLowerCase() === 'edit') {
      const feedback = await prompt(
        'Provide feedback for Claude to refine the changelog',
      )

      if (!feedback) {
        continue
      }

      log.progress('Refining changelog with Claude')

      const refinePrompt = `Please refine this changelog entry based on the following feedback:

Current changelog entry:
${changelogEntry}

Feedback:
${feedback}

Provide the refined changelog entry in the same format.`

      const refineResult = await runCommandWithOutput(claudeCmd, [], {
        input: refinePrompt,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      if (refineResult.exitCode === 0) {
        changelogEntry = refineResult.stdout.trim()
        log.done('Changelog refined')

        logger.log(`\n${'━'.repeat(60)}`)
        logger.log('Refined Changelog Entry:')
        logger.log('━'.repeat(60))
        logger.log(changelogEntry)
        logger.log(`${'━'.repeat(60)}\n`)
      } else {
        log.failed('Failed to refine changelog')
      }
    } else if (response.toLowerCase() === 'no') {
      // Allow manual editing.
      const manualEntry = await prompt(
        'Enter changelog manually (or press Enter to cancel)',
      )
      if (manualEntry) {
        return manualEntry
      }
      throw new Error('Changelog generation cancelled')
    }
  }
}

/**
 * Interactive review using advanced prompts.
 * Provides a better user experience with select menus and structured feedback.
 */
async function interactiveReviewChangelog(
  claudeCmd: string,
  changelogEntry: string,
): Promise<string> {
  let currentEntry = changelogEntry
  let regenerateCount = 0

  while (true) {
    // Show the current changelog.
    logger.log('\nCurrent Changelog Entry:')
    logger.log('─'.repeat(60))
    logger.log(currentEntry)
    logger.log(`${'─'.repeat(60)}\n`)

    // Offer action choices.
    const action = await prompts!.select({
      message: 'What would you like to do?',
      choices: [
        { value: 'accept', name: 'Accept this changelog' },
        {
          value: 'regenerate',
          name: 'Regenerate entirely (fresh perspective)',
        },
        { value: 'refine', name: 'Refine with specific feedback' },
        { value: 'add', name: 'Add missing information' },
        { value: 'simplify', name: 'Simplify and make more concise' },
        { value: 'technical', name: 'Make more technical/detailed' },
        { value: 'manual', name: 'Write manually' },
        { value: 'cancel', name: 'Cancel' },
      ],
    })

    if (action === 'accept') {
      return currentEntry
    }

    if (action === 'cancel') {
      const confirmCancel = await prompts!.confirm({
        message: 'Are you sure you want to cancel the version bump?',
        default: false,
      })
      if (confirmCancel) {
        throw new Error('Version bump cancelled by user')
      }
      continue
    }

    if (action === 'manual') {
      logger.log(
        '\nEnter the changelog manually (paste and press Enter twice when done):',
      )
      const rl = createReadline()
      let manualEntry = ''
      return new Promise<string>((resolve, reject) => {
        rl.on('line', (line: string) => {
          if (line === '' && manualEntry.endsWith('\n')) {
            rl.close()
            resolve(manualEntry.trim())
          } else {
            manualEntry += `${line}\n`
          }
        })
        rl.on('close', () => {
          if (manualEntry.trim()) {
            resolve(manualEntry.trim())
          } else {
            reject(new Error('No manual entry provided'))
          }
        })
      })
    }

    // Handle AI-based refinements.
    let feedbackPrompt = ''

    if (action === 'regenerate') {
      regenerateCount++
      feedbackPrompt = `Generate a completely different changelog entry. This is attempt #${regenerateCount + 1}.
Try a different perspective or focus on different aspects of the changes.

Original entry for reference:
${changelogEntry}

Generate a fresh changelog entry with the same version information but different wording and potentially different emphasis.`
    } else if (action === 'refine') {
      const feedback = await prompts!.input({
        message: 'Describe what changes you want:',
        validate: value => (value.trim() ? true : 'Please provide feedback'),
      })

      feedbackPrompt = `Refine this changelog based on the feedback:

Current entry:
${currentEntry}

Feedback: ${feedback}

Provide the refined changelog entry.`
    } else if (action === 'add') {
      const additions = await prompts!.input({
        message: 'What information is missing?',
        validate: value =>
          value.trim() ? true : 'Please describe what to add',
      })

      feedbackPrompt = `Add the following information to the changelog:

Current entry:
${currentEntry}

Information to add: ${additions}

Provide the updated changelog with the new information integrated appropriately.`
    } else if (action === 'simplify') {
      feedbackPrompt = `Simplify and make this changelog more concise:

Current entry:
${currentEntry}

Make it shorter and clearer, focusing only on the most important changes. Remove any redundancy or overly technical details that aren't essential for users.`
    } else if (action === 'technical') {
      feedbackPrompt = `Make this changelog more technical and detailed:

Current entry:
${currentEntry}

Add technical details, specific file changes, implementation details, and any breaking changes or migration notes. Be more precise about what changed internally.`
    }

    // Send to Claude for refinement.
    if (feedbackPrompt) {
      log.progress('Updating changelog with Claude')

      const refineResult = await runCommandWithOutput(claudeCmd, [], {
        input: feedbackPrompt,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      if (refineResult.exitCode === 0) {
        currentEntry = refineResult.stdout.trim()
        log.done('Changelog updated')
      } else {
        log.failed('Failed to update changelog')
        const retry = await prompts!.confirm({
          message: 'Failed to update. Try again?',
          default: true,
        })
        if (!retry) {
          return currentEntry
        }
      }
    }
  }
}

async function main(): Promise<void> {
  try {
    // Parse arguments.
    const { values } = parseArgs({
      options: {
        help: {
          type: 'boolean',
          default: false,
        },
        bump: {
          type: 'string',
          default: 'patch',
        },
        interactive: {
          type: 'boolean',
          // Default to true when prompts are available
          default: hasInteractivePrompts,
        },
        'no-interactive': {
          type: 'boolean',
          default: false,
        },
        'skip-changelog': {
          type: 'boolean',
          default: false,
        },
        'skip-checks': {
          type: 'boolean',
          default: false,
        },
        'no-push': {
          type: 'boolean',
          default: false,
        },
        force: {
          type: 'boolean',
          default: false,
        },
      },
      allowPositionals: false,
      strict: false,
    })

    // Show help if requested.
    if (values['help']) {
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
      logger.log('  --interactive    Force interactive changelog review')
      logger.log('  --no-interactive Disable interactive mode')
      logger.log('  --skip-changelog Skip changelog generation with Claude')
      logger.log('  --skip-checks    Skip git status/branch checks')
      logger.log('  --no-push        Do not push changes to remote')
      logger.log('  --force          Force bump even with warnings')
      logger.log('\nExamples:')
      logger.log(
        '  pnpm bump                    # Bump patch (interactive by default)',
      )
      logger.log('  pnpm bump --bump=minor       # Bump minor version')
      logger.log('  pnpm bump --no-interactive   # Use basic prompts')
      logger.log('  pnpm bump --bump=2.0.0       # Set specific version')
      logger.log(
        '  pnpm bump --skip-changelog   # Skip AI changelog generation',
      )
      logger.log('\nRequires:')
      logger.log('  - claude-console (or claude) CLI tool installed')
      logger.log('  - Clean git working directory')
      logger.log('  - Main/master branch (unless --force)')
      if (hasInteractivePrompts) {
        logger.log('\nInteractive mode: Available ✓ (default)')
      } else {
        logger.log('\nInteractive mode: Not available')
        logger.log('  (install @socketsecurity/lib or build local registry)')
      }
      process.exitCode = 0
      return
    }

    printHeader('Version Bump')

    // Handle interactive mode conflicts
    if (values['no-interactive']) {
      values['interactive'] = false
    }

    // Check git status unless skipped.
    if (!values['skip-checks']) {
      log.step('Checking prerequisites')

      log.progress('Checking git status')
      const gitClean = await checkGitStatus()
      if (!gitClean && !values['force']) {
        log.failed('Git working directory is not clean')
        process.exitCode = 1
        return
      }
      log.done('Git status clean')

      log.progress('Checking git branch')
      const onMainBranch = await checkGitBranch()
      if (!onMainBranch && !values['force']) {
        log.failed('Not on main/master branch')
        process.exitCode = 1
        return
      }
      log.done('On main/master branch')
    }

    // Check for Claude if not skipping changelog.
    let claudeCmd: string | false | undefined
    if (!values['skip-changelog']) {
      log.progress('Checking for Claude CLI')
      claudeCmd = await checkClaude()
      if (!claudeCmd) {
        log.failed('claude-console not found')
        log.error(
          'Please install claude-console: https://github.com/anthropics/claude-console',
        )
        log.info('Install with: npm install -g @anthropic/claude-console')
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
    const newVersion = getNewVersion(currentVersion, values['bump'] as string)
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

    // Check for interactive mode availability.
    // Only warn if explicitly requested via --interactive flag
    const explicitlyRequestedInteractive =
      process.argv.includes('--interactive')
    if (values['interactive'] && !hasInteractivePrompts) {
      if (explicitlyRequestedInteractive) {
        log.warn('Interactive mode requested but prompts not available')
        log.info(
          'To enable: install @socketsecurity/lib or build local registry',
        )
      }
      values['interactive'] = false
    }

    // Generate and review changelog.
    let changelogEntry: string | undefined
    if (!values['skip-changelog'] && claudeCmd) {
      changelogEntry = await generateChangelog(
        claudeCmd,
        currentVersion,
        newVersion,
      )
      changelogEntry = await reviewChangelog(
        claudeCmd,
        changelogEntry,
        !!values['interactive'],
      )

      log.progress('Updating CHANGELOG.md')
      await updateChangelog(changelogEntry)
      log.done('Updated CHANGELOG.md')
    }

    // Create commit.
    log.step('Creating commit')
    const packageName = await getPackageName()
    const commitMessage =
      packageName === 'registry package'
        ? `Bump registry package to v${newVersion}`
        : `Bump to v${newVersion}`

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

    log.info('\nNext steps:')
    log.substep('1. Run `pnpm publish` to publish to npm')
    log.substep('2. Create GitHub release if needed')

    process.exitCode = 0
  } catch (e) {
    log.error(
      `Version bump failed: ${e instanceof Error ? e.message : String(e)}`,
    )
    process.exitCode = 1
  }
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
