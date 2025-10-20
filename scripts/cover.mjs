#!/usr/bin/env node
/**
 * @fileoverview Coverage script that runs tests with coverage reporting.
 * Masks test output and shows only the coverage summary.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { printError, printHeader, printSuccess } from './utils/cli-helpers.mjs'
import { runCommandQuiet } from './utils/run-command.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')

printHeader('Running Coverage')

// Run vitest with coverage enabled via test runner, capturing output
const vitestArgs = [
  'exec',
  'bash',
  'scripts/node-with-loader.sh',
  'scripts/test.mjs',
  '--skip-checks',
  '--cover',
  '--all',
  ...process.argv.slice(2),
]
const typeCoverageArgs = ['exec', 'type-coverage']

try {
  const { exitCode, stdout, stderr } = await runCommandQuiet('pnpm', vitestArgs, {
    cwd: rootPath,
  })

  // Run type coverage
  const typeCoverageResult = await runCommandQuiet('pnpm', typeCoverageArgs, {
    cwd: rootPath,
  })

  // Combine and clean output - remove ANSI color codes and spinner artifacts
  const ansiRegex = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
  const output = (stdout + stderr)
    .replace(ansiRegex, '') // Remove ANSI color codes
    .replace(/(?:✧|︎|⚡)\s*/g, '') // Remove spinner artifacts
    .trim()

  // Extract test summary (Test Files ... Duration)
  const testSummaryMatch = output.match(
    /Test Files\s+\d+[^\n]*\n[\s\S]*?Duration\s+[\d.]+m?s[^\n]*/,
  )

  // Extract coverage summary: header + All files row
  // Match from "% Coverage" header through the All files line and closing border
  const coverageHeaderMatch = output.match(
    / % Coverage report from v8\n([-|]+)\n([^\n]+)\n\1/,
  )
  const allFilesMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|[^\n]*/)

  // Extract type coverage percentage
  const typeCoverageOutput = (
    typeCoverageResult.stdout + typeCoverageResult.stderr
  ).trim()
  const typeCoverageMatch = typeCoverageOutput.match(/\([\d\s/]+\)\s+([\d.]+)%/)

  // Display clean output
  if (testSummaryMatch) {
    console.log()
    console.log(testSummaryMatch[0])
    console.log()
  }

  if (coverageHeaderMatch && allFilesMatch) {
    console.log(' % Coverage report from v8')
    console.log(coverageHeaderMatch[1]) // Top border
    console.log(coverageHeaderMatch[2]) // Header row
    console.log(coverageHeaderMatch[1]) // Middle border
    console.log(allFilesMatch[0]) // All files row
    console.log(coverageHeaderMatch[1]) // Bottom border
    console.log()

    // Display type coverage and cumulative summary
    if (typeCoverageMatch) {
      const codeCoveragePercent = parseFloat(allFilesMatch[1])
      const typeCoveragePercent = parseFloat(typeCoverageMatch[1])
      const cumulativePercent = (
        (codeCoveragePercent + typeCoveragePercent) /
        2
      ).toFixed(2)

      console.log(' Coverage Summary')
      console.log(' ───────────────────────────────')
      console.log(` Type Coverage: ${typeCoveragePercent.toFixed(2)}%`)
      console.log(` Code Coverage: ${codeCoveragePercent.toFixed(2)}%`)
      console.log(' ───────────────────────────────')
      console.log(` Cumulative:    ${cumulativePercent}%`)
      console.log()
    }
  }

  if (exitCode === 0) {
    printSuccess('Coverage completed successfully')
  } else {
    printError('Coverage failed')
    // Show relevant output on failure for debugging
    if (!testSummaryMatch && !coverageHeaderMatch) {
      console.log('\n--- Output ---')
      console.log(output)
    }
  }

  process.exitCode = exitCode
} catch (error) {
  printError(`Coverage script failed: ${error.message}`)
  process.exitCode = 1
}
