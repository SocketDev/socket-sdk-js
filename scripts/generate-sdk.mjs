#!/usr/bin/env node
/**
 * @fileoverview SDK generation script.
 * Orchestrates the complete SDK generation process:
 * 1. Prettifies the OpenAPI JSON
 * 2. Generates TypeScript types from OpenAPI
 * 3. Formats and lints the generated code
 *
 * Usage:
 *   node scripts/generate-sdk.mjs
 */

import { writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { logger } from '@socketsecurity/registry/lib/logger'
import { getRootPath } from './utils/path-helpers.mjs'
import { runCommand, runPnpmScript } from './utils/run-command.mjs'

const rootPath = getRootPath(import.meta.url)
const typesPath = resolve(rootPath, 'types/api.d.ts')

async function generateTypes() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/generate-types.mjs'], {
      cwd: rootPath,
      stdio: ['inherit', 'pipe', 'inherit'],
    })

    let output = ''

    child.stdout.on('data', data => {
      output += data.toString()
    })

    child.on('exit', code => {
      if (code !== 0) {
        reject(new Error(`Type generation failed with exit code ${code}`))
        return
      }

      try {
        writeFileSync(typesPath, output, 'utf8')
        resolve()
      } catch (error) {
        reject(error)
      }
    })

    child.on('error', reject)
  })
}

async function main() {
  try {
    logger.log('Generating SDK from OpenAPI...')

    // Step 1: Prettify OpenAPI JSON
    logger.log('  1. Prettifying OpenAPI JSON...')
    let exitCode = await runCommand('node', ['scripts/prettify-base-json.mjs'])
    if (exitCode !== 0) {
      process.exitCode = exitCode
      return
    }

    // Step 2: Generate types
    logger.log('  2. Generating TypeScript types...')
    await generateTypes()

    // Step 3: Format and lint generated code (run twice for stability)
    logger.log('  3. Formatting generated code...')
    exitCode = await runPnpmScript('fix')
    if (exitCode !== 0 && exitCode !== 1) {
      // Exit code 1 is okay - it means linters made fixes
      process.exitCode = exitCode
      return
    }

    logger.log('  4. Final formatting pass...')
    exitCode = await runPnpmScript('fix')
    if (exitCode !== 0 && exitCode !== 1) {
      process.exitCode = exitCode
      return
    }

    logger.log('SDK generation complete')
  } catch (error) {
    logger.error('SDK generation failed:', error.message)
    process.exitCode = 1
  }
}

main().catch(console.error)
