#!/usr/bin/env node
/**
 * @fileoverview Publish script with provenance support for Socket SDK
 */

import { spawn } from 'node:child_process'
import { parseArgs } from 'node:util'

const CI = !!process.env.CI

/**
 * Run a command and return exit code
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options
    })

    child.on('exit', code => {
      resolve(code || 0)
    })

    child.on('error', error => {
      reject(error)
    })
  })
}

async function main() {
  try {
    const { values } = parseArgs({
      options: {
        help: {
          type: 'boolean',
          default: false
        },
        'dry-run': {
          type: 'boolean',
          default: false
        },
        'skip-checks': {
          type: 'boolean',
          default: false
        },
        'skip-build': {
          type: 'boolean',
          default: false
        },
        tag: {
          type: 'string',
          default:
            process.env.DIST_TAG || process.env.NPM_CONFIG_TAG || 'latest'
        },
        access: {
          type: 'string',
          default: 'public'
        }
      },
      allowPositionals: false,
      strict: false
    })

    if (values.help) {
      console.log('\nUsage: node scripts/publish.mjs [options]')
      console.log('\nOptions:')
      console.log('  --help           Show this help message')
      console.log('  --dry-run        Perform a dry-run without publishing')
      console.log('  --skip-checks    Skip pre-publish checks')
      console.log('  --skip-build     Skip build step (not allowed in CI)')
      console.log(
        '  --tag <tag>      npm dist-tag (default: $DIST_TAG or "latest")'
      )
      console.log('  --access <level> Package access level (default: public)')
      console.log('\nEnvironment Variables:')
      console.log('  DIST_TAG         Default npm dist-tag to use')
      console.log('  NPM_CONFIG_TAG   Alternative env var for npm dist-tag')
      process.exitCode = 0
      return
    }

    // Check CI restrictions
    if (CI && values['skip-build']) {
      console.error('✗ --skip-build is not allowed in CI')
      process.exitCode = 1
      return
    }

    console.log('\n📦 Publishing @socketsecurity/sdk\n')

    // Run checks unless skipped
    if (!values['skip-checks']) {
      console.log('Running checks...')
      const checkCode = await runCommand('npm', ['run', 'check'])
      if (checkCode !== 0) {
        console.error('✗ Checks failed')
        process.exitCode = 1
        return
      }
      console.log('✓ Checks passed\n')

      console.log('Running tests...')
      const testCode = await runCommand('npm', ['run', 'test'])
      if (testCode !== 0) {
        console.error('✗ Tests failed')
        process.exitCode = 1
        return
      }
      console.log('✓ Tests passed\n')
    }

    // Build unless skipped
    if (!values['skip-build']) {
      console.log('Building package...')
      const buildCode = await runCommand('npm', ['run', 'build'])
      if (buildCode !== 0) {
        console.error('✗ Build failed')
        process.exitCode = 1
        return
      }
      console.log('✓ Build complete\n')
    }

    // Prepare publish args
    const publishArgs = [
      'publish',
      '--access',
      values.access,
      '--tag',
      values.tag
    ]

    // Add provenance by default (works with trusted publishers in CI)
    if (!values['dry-run']) {
      publishArgs.push('--provenance')
    }

    if (values['dry-run']) {
      publishArgs.push('--dry-run')
    }

    // Publish
    console.log(
      values['dry-run']
        ? 'Running dry-run publish...'
        : `Publishing to npm with tag "${values.tag}"...`
    )
    const publishCode = await runCommand('npm', publishArgs)

    if (publishCode !== 0) {
      console.error('✗ Publish failed')
      process.exitCode = 1
      return
    }

    if (values['dry-run']) {
      console.log('\n✓ Dry-run publish complete')
    } else {
      console.log('\n✓ Published successfully!')
    }

    process.exitCode = 0
  } catch (error) {
    console.error(`✗ Publish failed: ${error.message}`)
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
