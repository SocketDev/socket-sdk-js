/**
 * @fileoverview Test runner for the project.
 * Handles test execution with Vitest, including:
 * - Force flag processing for running all tests
 * - Glob pattern expansion for test file selection
 * - Cross-platform compatibility (Windows/Unix)
 * - Memory optimization for CI environments
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WIN32 from '@socketsecurity/registry/lib/constants/WIN32'
import { logger } from '@socketsecurity/registry/lib/logger'
import fastGlob from 'fast-glob'

import { getDirname } from './utils/path-helpers.mjs'

const __dirname = getDirname(import.meta.url)
const rootPath = path.join(__dirname, '..')
const nodeModulesBinPath = path.join(rootPath, 'node_modules', '.bin')

async function main() {
  try {
    // Separate force flag from other arguments.
    let args = process.argv.slice(2)

    // Remove the -- separator if it's the first argument.
    if (args[0] === '--') {
      args = args.slice(1)
    }

    // Check if --force is present anywhere in the arguments.
    const forceIndex = args.indexOf('--force')
    const hasForce = forceIndex !== -1

    if (hasForce) {
      // Remove --force from arguments.
      args.splice(forceIndex, 1)
    }

    const spawnEnv = {
      ...process.env,
      ...(hasForce ? { FORCE_TEST: '1' } : {}),
      // Increase Node.js heap size to prevent out of memory errors in tests.
      // Use 8GB in CI environments, 4GB locally.
      // Add --max-semi-space-size to improve GC performance for RegExp-heavy tests.
      NODE_OPTIONS:
        `${process.env.NODE_OPTIONS || ''} --max-old-space-size=${process.env.CI ? 8192 : 4096} --max-semi-space-size=512`.trim(),
    }

    // Handle Windows vs Unix for vitest executable.
    const vitestCmd = WIN32 ? 'vitest.cmd' : 'vitest'
    const vitestPath = path.join(nodeModulesBinPath, vitestCmd)

    // Expand glob patterns in arguments.
    const expandedArgs = []
    for (const arg of args) {
      // Check if the argument looks like a glob pattern.
      if (arg.includes('*') && !arg.startsWith('-')) {
        const files = fastGlob.sync(arg, { cwd: rootPath })
        expandedArgs.push(...files)
      } else {
        expandedArgs.push(arg)
      }
    }

    // Pass remaining arguments to vitest.
    const vitestArgs = ['run', ...expandedArgs]

    const spawnOptions = {
      cwd: rootPath,
      env: spawnEnv,
      stdio: 'inherit',
    }

    const child = spawn(vitestPath, vitestArgs, spawnOptions)

    child.on('exit', code => {
      process.exitCode = code || 0
    })
  } catch (e) {
    logger.error('Error running tests:', e.message)
    process.exitCode = 1
  }
}

main().catch(console.error)
