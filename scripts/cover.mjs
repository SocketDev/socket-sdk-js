#!/usr/bin/env node
/**
 * @fileoverview Coverage script that runs tests with coverage reporting.
 * Masks test output and shows only the coverage summary.
 *
 * Options:
 *   --code-only  Run only code coverage (skip type coverage)
 *   --type-only  Run only type coverage (skip code coverage)
 *   --summary    Show only coverage summary (hide detailed output)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parseArgs } from '@socketsecurity/lib/argv/parse'
import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { spawn } from '@socketsecurity/lib/spawn'
import { printHeader } from '@socketsecurity/lib/stdio/header'

import { runCommandQuiet } from './utils/run-command.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')

// Initialize logger
const logger = getDefaultLogger()

// ANSI escape regex for stripping color codes
const ansiRegex = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

/** Strip ANSI codes and decorative characters (✧, ︎ variation selector, ⚡) from text. */
const cleanOutput = text =>
  text
    .replace(ansiRegex, '')
    .replace(/(?:\u2727|\uFE0E|\u26A1)\s*/g, '')
    .trim()

/**
 * Run both main and isolated test suites, returning individual and combined
 * results.
 */
async function runTestSuites(mainArgs, isolatedArgs) {
  const run = async args => {
    try {
      return await runCommandQuiet('pnpm', args, {
        cwd: rootPath,
        env: { ...process.env, COVERAGE: 'true' },
      })
    } catch (error) {
      // Command may throw on non-zero exit, but we still want coverage
      return {
        exitCode: 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
      }
    }
  }

  const mainResult = await run(mainArgs)
  const isolatedResult = await run(isolatedArgs)

  const exitCode =
    mainResult.exitCode !== 0 ? mainResult.exitCode : isolatedResult.exitCode

  const combined = {
    exitCode,
    stderr: mainResult.stderr + isolatedResult.stderr,
    stdout: mainResult.stdout + isolatedResult.stdout,
  }

  return { combined, isolatedResult, mainResult }
}

/**
 * Merge coverage-final.json from both suites using max-hit-count strategy.
 * Returns aggregate percentages for statements, branches, functions, and lines.
 */
async function mergeCoverageFinal() {
  const mainFinalPath = path.join(rootPath, 'coverage/coverage-final.json')
  const isolatedFinalPath = path.join(
    rootPath,
    'coverage-isolated/coverage-final.json',
  )

  let mainFinal = {}
  let isolatedFinal = {}
  try {
    mainFinal = JSON.parse(await fs.readFile(mainFinalPath, 'utf8'))
  } catch (e) {
    if (e?.code !== 'ENOENT') {
      logger.warn(`Failed to read ${mainFinalPath}: ${e?.message}`)
    }
  }
  try {
    isolatedFinal = JSON.parse(await fs.readFile(isolatedFinalPath, 'utf8'))
  } catch (e) {
    if (e?.code !== 'ENOENT') {
      logger.warn(`Failed to read ${isolatedFinalPath}: ${e?.message}`)
    }
  }

  if (!Object.keys(mainFinal).length && !Object.keys(isolatedFinal).length) {
    return undefined
  }

  // Merge: for each file, take max of each counter
  const allFiles = new Set([
    ...Object.keys(mainFinal),
    ...Object.keys(isolatedFinal),
  ])
  let totalStatements = 0
  let coveredStatements = 0
  let totalBranches = 0
  let coveredBranches = 0
  let totalFunctions = 0
  let coveredFunctions = 0
  let totalLines = 0
  let coveredLines = 0

  for (const file of allFiles) {
    const m = mainFinal[file]
    const iso = isolatedFinal[file]

    // Merge statement counts (max of both suites) — union of keys
    const stmtMap = { ...m?.statementMap, ...iso?.statementMap }
    const allStmtKeys = new Set([
      ...Object.keys(m?.s ?? {}),
      ...Object.keys(iso?.s ?? {}),
    ])
    const mergedS = {}
    for (const id of allStmtKeys) {
      mergedS[id] = Math.max(m?.s?.[id] ?? 0, iso?.s?.[id] ?? 0)
    }
    totalStatements += allStmtKeys.size
    coveredStatements += Object.values(mergedS).filter(c => c > 0).length

    // Merge branch counts — union of keys
    const allBranchKeys = new Set([
      ...Object.keys(m?.b ?? {}),
      ...Object.keys(iso?.b ?? {}),
    ])
    const mergedB = {}
    for (const id of allBranchKeys) {
      const mArr = m?.b?.[id] ?? []
      const iArr = iso?.b?.[id] ?? []
      const len = Math.max(mArr.length, iArr.length)
      mergedB[id] = Array.from({ length: len }, (_, i) =>
        Math.max(mArr[i] ?? 0, iArr[i] ?? 0),
      )
    }
    for (const id of allBranchKeys) {
      const arr = mergedB[id] || []
      totalBranches += arr.length
      coveredBranches += arr.filter(c => c > 0).length
    }

    // Merge function counts — union of keys
    const allFnKeys = new Set([
      ...Object.keys(m?.f ?? {}),
      ...Object.keys(iso?.f ?? {}),
    ])
    const mergedF = {}
    for (const id of allFnKeys) {
      mergedF[id] = Math.max(m?.f?.[id] ?? 0, iso?.f?.[id] ?? 0)
    }
    totalFunctions += allFnKeys.size
    coveredFunctions += Object.values(mergedF).filter(c => c > 0).length

    // Lines: derive from merged statements (each statement maps to a line)
    const lineSet = new Set()
    const coveredLineSet = new Set()
    for (const [id, loc] of Object.entries(stmtMap)) {
      const line = loc.start.line
      lineSet.add(line)
      if (mergedS[id] > 0) {
        coveredLineSet.add(line)
      }
    }
    totalLines += lineSet.size
    coveredLines += coveredLineSet.size
  }

  const pct = (covered, total) =>
    total > 0 ? ((covered / total) * 100).toFixed(2) : '0.00'

  return {
    branches: pct(coveredBranches, totalBranches),
    functions: pct(coveredFunctions, totalFunctions),
    lines: pct(coveredLines, totalLines),
    statements: pct(coveredStatements, totalStatements),
  }
}

/**
 * Display code coverage results including test summary, v8 report, and
 * aggregate metrics.
 */
/** Parse type-coverage output to extract percentage. */
function parseTypeCoveragePercent(output) {
  const match = output.match(/\([\d\s/]+\)\s+([\d.]+)%/)
  return match ? Number.parseFloat(match[1]) : undefined
}

function displayCodeCoverage(
  mainOutput,
  combinedOutput,
  aggregateCoverage,
  { showDetail, typeCoveragePercent },
) {
  // Extract and display test summary from vitest output
  if (showDetail) {
    const testSummaryMatch = combinedOutput.match(
      /Test Files\s+\d+[^\n]*\n[\s\S]*?Duration\s+[\d.]+m?s[^\n]*/,
    )
    if (testSummaryMatch) {
      logger.log('')
      logger.log(testSummaryMatch[0])
      logger.log('')
    }

    // Extract v8 coverage table for detailed display
    const coverageHeaderMatch = mainOutput.match(
      / % Coverage report from v8\n([-|]+)\n([^\n]+)\n\1/,
    )
    const allFilesMatch = mainOutput.match(
      /All files\s+\|\s+([\d.]+)\s+\|[^\n]*/,
    )
    if (coverageHeaderMatch && allFilesMatch) {
      logger.log(' % Coverage report from v8')
      logger.log(coverageHeaderMatch[1])
      logger.log(coverageHeaderMatch[2])
      logger.log(coverageHeaderMatch[1])
      logger.log(allFilesMatch[0])
      logger.log(coverageHeaderMatch[1])
      logger.log('')
    }
  }

  // Use aggregate coverage (JSON-based) as primary; fall back to regex
  const codeCoveragePercent = aggregateCoverage
    ? Number.parseFloat(aggregateCoverage.statements)
    : (() => {
        const m = mainOutput.match(/All files\s+\|\s+([\d.]+)\s+\|/)
        return m ? Number.parseFloat(m[1]) : 0
      })()

  logger.log(' Coverage Summary')
  logger.log(' ───────────────────────────────')

  if (typeCoveragePercent !== undefined) {
    logger.log(` Type Coverage: ${typeCoveragePercent.toFixed(2)}%`)
  }
  logger.log(` Code Coverage: ${codeCoveragePercent.toFixed(2)}%`)

  if (aggregateCoverage) {
    logger.log('')
    logger.log(' Aggregate Code Coverage (Main + Isolated):')
    logger.log(
      `   Statements: ${aggregateCoverage.statements}% | Branches: ${aggregateCoverage.branches}%`,
    )
    logger.log(
      `   Functions:  ${aggregateCoverage.functions}% | Lines:    ${aggregateCoverage.lines}%`,
    )
  }

  if (typeCoveragePercent !== undefined) {
    const cumulativePercent = (
      (codeCoveragePercent + typeCoveragePercent) /
      2
    ).toFixed(2)
    logger.log(' ───────────────────────────────')
    logger.log(` Cumulative:    ${cumulativePercent}%`)
  }

  logger.log('')
}

// Parse custom flags
const { values } = parseArgs({
  options: {
    'code-only': { type: 'boolean', default: false },
    'type-only': { type: 'boolean', default: false },
    summary: { type: 'boolean', default: false },
  },
  strict: false,
})

printHeader('Test Coverage')
logger.log('')

// Rebuild with source maps enabled for coverage
logger.info('Building with source maps for coverage...')
const buildResult = await spawn('node', ['scripts/build.mjs'], {
  cwd: rootPath,
  stdio: 'inherit',
  env: {
    ...process.env,
    COVERAGE: 'true',
  },
})
if (buildResult.code !== 0) {
  logger.error('Build with source maps failed')
  process.exitCode = 1
}
const buildFailed = buildResult.code !== 0
logger.log('')

// Filter out custom flags that vitest doesn't understand
const customFlags = ['--code-only', '--type-only', '--summary']
const passthroughArgs = process.argv
  .slice(2)
  .filter(arg => !customFlags.includes(arg))

// Build vitest commands for both main and isolated test suites
const mainVitestArgs = [
  'exec',
  'vitest',
  'run',
  '--config',
  '.config/vitest.config.mts',
  '--coverage',
  ...passthroughArgs,
]
const isolatedVitestArgs = [
  'exec',
  'vitest',
  'run',
  '--config',
  '.config/vitest.config.isolated.mts',
  '--coverage',
  ...passthroughArgs,
]
const typeCoverageArgs = ['exec', 'type-coverage']

try {
  let exitCode = 0

  // Handle --type-only flag
  if (values['type-only']) {
    const typeCoverageResult = await runCommandQuiet('pnpm', typeCoverageArgs, {
      cwd: rootPath,
    })
    exitCode = typeCoverageResult.exitCode

    // Display type coverage only
    const typeCoverageOutput = (
      typeCoverageResult.stdout + typeCoverageResult.stderr
    ).trim()
    const typeCoveragePercent = parseTypeCoveragePercent(typeCoverageOutput)

    if (typeCoveragePercent !== undefined) {
      logger.log('')
      logger.log(' Coverage Summary')
      logger.log(' ───────────────────────────────')
      logger.log(` Type Coverage: ${typeCoveragePercent.toFixed(2)}%`)
      logger.log('')
    }
  }
  // Handle --code-only flag and default (code + type coverage)
  else {
    const { combined, mainResult } = await runTestSuites(
      mainVitestArgs,
      isolatedVitestArgs,
    )
    exitCode = combined.exitCode

    const mainOutput = cleanOutput(mainResult.stdout + mainResult.stderr)
    const combinedOutput = cleanOutput(combined.stdout + combined.stderr)

    // Run type coverage unless --code-only
    let typeCoveragePercent
    if (!values['code-only']) {
      const typeCoverageResult = await runCommandQuiet(
        'pnpm',
        typeCoverageArgs,
        { cwd: rootPath },
      )
      const typeCoverageOutput = (
        typeCoverageResult.stdout + typeCoverageResult.stderr
      ).trim()
      typeCoveragePercent = parseTypeCoveragePercent(typeCoverageOutput)
    }

    let aggregateCoverage
    try {
      aggregateCoverage = await mergeCoverageFinal()
    } catch (error) {
      logger.warn(
        `Could not compute aggregate coverage: ${error?.message || 'Unknown error'}`,
      )
    }

    displayCodeCoverage(mainOutput, combinedOutput, aggregateCoverage, {
      showDetail: !values.summary,
      typeCoveragePercent,
    })
  }

  if (buildFailed) {
    exitCode = 1
  }

  if (exitCode === 0) {
    logger.success('Coverage completed successfully')
  } else {
    logger.error('Coverage failed')
  }

  process.exitCode = exitCode
} catch (error) {
  logger.error(`Coverage script failed: ${error.message}`)
  process.exitCode = 1
}
