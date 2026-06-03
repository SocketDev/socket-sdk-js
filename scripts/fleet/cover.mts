#!/usr/bin/env node
/**
 * @file Coverage runner — builds with source maps, runs vitest with coverage,
 *   masks test output, and prints a coverage summary. Runs the main suite and,
 *   when the repo ships one, an isolated suite (forks, full isolation for tests
 *   that mock globals / chdir / mutate process.env); the two coverage reports
 *   are merged with a max-hit-count strategy. Byte-identical across every fleet
 *   repo (sync-scaffolding flags drift). Config discovery is repo-first:
 *   `.config/repo/vitest.config.mts` then legacy `.config/vitest.config.mts`;
 *   the isolated suite runs only when `.config/repo/vitest.config.isolated.mts`
 *   (or the legacy `.config/` location) exists. Options: --code-only run only
 *   code coverage (skip type coverage); --type-only run only type coverage;
 *   --summary hide the detailed v8 table, show only the summary.
 */

import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parseArgs } from '@socketsecurity/lib-stable/argv/parse'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { printHeader } from '@socketsecurity/lib-stable/stdio/header'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// This script lives at scripts/fleet/, so the repo root is two levels up.
const rootPath = path.join(__dirname, '..', '..')

const logger = getDefaultLogger()

const ansiRegex = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

export interface SuiteResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface TestSuitesResult {
  combined: SuiteResult
  isolatedResult: SuiteResult | undefined
  mainResult: SuiteResult
}

export interface CoverageLocation {
  start: { line: number; column: number }
  end: { line: number; column: number }
}

export interface CoverageFileFinal {
  s?: Record<string, number> | undefined
  b?: Record<string, number[]> | undefined
  f?: Record<string, number> | undefined
  statementMap?: Record<string, CoverageLocation> | undefined
}

export interface AggregateCoverage {
  branches: string
  functions: string
  lines: string
  statements: string
}

// Resolve a config basename repo-first: prefer `.config/repo/<name>`, fall back
// to the legacy top-level `.config/<name>`. Returns the repo-root-relative path
// vitest should load, or undefined when neither location has the file.
export function resolveConfig(basename: string): string | undefined {
  const candidates = [
    path.join('.config', 'repo', basename),
    path.join('.config', basename),
  ]
  for (let i = 0, { length } = candidates; i < length; i += 1) {
    const rel = candidates[i]!
    if (existsSync(path.join(rootPath, rel))) {
      return rel
    }
  }
  return undefined
}

// Strip ANSI codes and decorative characters (✧, ︎ variation selector, ⚡) from
// text.
export function cleanOutput(text: string): string {
  return text
    .replace(ansiRegex, '')
    .replace(/(?:⚡|✧|︎)\s*/g, '')
    .trim()
}

// Run a command quietly, capturing stdout/stderr and never throwing — a
// non-zero exit becomes an exitCode in the returned result so callers can still
// parse coverage output. Replaces the old repo-local run-command helper with a
// direct lib-stable spawn so the runner is self-contained and cascade-portable.
export async function runQuiet(
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv | undefined },
): Promise<SuiteResult> {
  try {
    const result = await spawn('pnpm', args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
    })
    return {
      exitCode: result.code ?? 0,
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
    }
  } catch (e) {
    const err = e as Record<string, unknown>
    return {
      exitCode: 1,
      stdout: (err['stdout'] as string) || '',
      stderr: (err['stderr'] as string) || (err['message'] as string) || '',
    }
  }
}

export function parseTypeCoveragePercent(output: string): number | undefined {
  const match = output.match(/\([\d\s/]+\)\s+([\d.]+)%/)
  return match?.[1] ? Number.parseFloat(match[1]) : undefined
}

// Run the main suite and, when isolatedArgs is provided, the isolated suite.
// Returns individual results plus a combined view; isolatedResult is undefined
// when the repo ships no isolated suite.
export async function runTestSuites(
  mainArgs: string[],
  isolatedArgs: string[] | undefined,
): Promise<TestSuitesResult> {
  const run = (args: string[]): Promise<SuiteResult> =>
    runQuiet(args, {
      cwd: rootPath,
      env: { ...process.env, COVERAGE: 'true' },
    })

  const mainResult = await run(mainArgs)
  const isolatedResult = isolatedArgs ? await run(isolatedArgs) : undefined

  const exitCode =
    mainResult.exitCode !== 0
      ? mainResult.exitCode
      : (isolatedResult?.exitCode ?? 0)

  const combined: SuiteResult = {
    exitCode,
    stderr: mainResult.stderr + (isolatedResult?.stderr ?? ''),
    stdout: mainResult.stdout + (isolatedResult?.stdout ?? ''),
  }

  return { combined, isolatedResult, mainResult }
}

// Merge coverage-final.json from the main and isolated suites using a
// max-hit-count strategy. Returns aggregate percentages, or undefined when
// neither report exists.
export async function mergeCoverageFinal(): Promise<
  AggregateCoverage | undefined
> {
  const mainFinalPath = path.join(rootPath, 'coverage/coverage-final.json')
  const isolatedFinalPath = path.join(
    rootPath,
    'coverage-isolated/coverage-final.json',
  )

  let mainFinal: Record<string, CoverageFileFinal> = {}
  let isolatedFinal: Record<string, CoverageFileFinal> = {}
  try {
    mainFinal = JSON.parse(await fs.readFile(mainFinalPath, 'utf8')) as Record<
      string,
      CoverageFileFinal
    >
  } catch (e) {
    const err = e as NodeJS.ErrnoException | null
    if (err?.code !== 'ENOENT') {
      logger.warn(`Failed to read ${mainFinalPath}: ${err?.message}`)
    }
  }
  try {
    isolatedFinal = JSON.parse(
      await fs.readFile(isolatedFinalPath, 'utf8'),
    ) as Record<string, CoverageFileFinal>
  } catch (e) {
    const err = e as NodeJS.ErrnoException | null
    if (err?.code !== 'ENOENT') {
      logger.warn(`Failed to read ${isolatedFinalPath}: ${err?.message}`)
    }
  }

  if (!Object.keys(mainFinal).length && !Object.keys(isolatedFinal).length) {
    return undefined
  }

  const allFiles = [
    ...new Set([...Object.keys(mainFinal), ...Object.keys(isolatedFinal)]),
  ]
  let totalStatements = 0
  let coveredStatements = 0
  let totalBranches = 0
  let coveredBranches = 0
  let totalFunctions = 0
  let coveredFunctions = 0
  let totalLines = 0
  let coveredLines = 0

  for (let fi = 0, { length: flen } = allFiles; fi < flen; fi += 1) {
    const file = allFiles[fi]!
    const main = mainFinal[file]
    const iso = isolatedFinal[file]

    const stmtMap = { ...main?.statementMap, ...iso?.statementMap }
    const allStmtKeys = [
      ...new Set([...Object.keys(main?.s ?? {}), ...Object.keys(iso?.s ?? {})]),
    ]
    const mergedS: Record<string, number> = {}
    for (let i = 0, { length } = allStmtKeys; i < length; i += 1) {
      const id = allStmtKeys[i]!
      mergedS[id] = Math.max(main?.s?.[id] ?? 0, iso?.s?.[id] ?? 0)
    }
    totalStatements += allStmtKeys.length
    coveredStatements += Object.values(mergedS).filter(c => c > 0).length

    const allBranchKeys = [
      ...new Set([...Object.keys(main?.b ?? {}), ...Object.keys(iso?.b ?? {})]),
    ]
    const mergedB: Record<string, number[]> = {}
    for (let i = 0, { length } = allBranchKeys; i < length; i += 1) {
      const id = allBranchKeys[i]!
      const mainArr = main?.b?.[id] ?? []
      const isoArr = iso?.b?.[id] ?? []
      const len = Math.max(mainArr.length, isoArr.length)
      mergedB[id] = Array.from({ length: len }, (value, j) =>
        Math.max(mainArr[j] ?? 0, isoArr[j] ?? 0),
      )
    }
    for (let i = 0, { length } = allBranchKeys; i < length; i += 1) {
      const id = allBranchKeys[i]!
      const arr = mergedB[id] || []
      totalBranches += arr.length
      coveredBranches += arr.filter(c => c > 0).length
    }

    const allFnKeys = [
      ...new Set([...Object.keys(main?.f ?? {}), ...Object.keys(iso?.f ?? {})]),
    ]
    const mergedF: Record<string, number> = {}
    for (let i = 0, { length } = allFnKeys; i < length; i += 1) {
      const id = allFnKeys[i]!
      mergedF[id] = Math.max(main?.f?.[id] ?? 0, iso?.f?.[id] ?? 0)
    }
    totalFunctions += allFnKeys.length
    coveredFunctions += Object.values(mergedF).filter(c => c > 0).length

    const lineSet = new Set<number>()
    const coveredLineSet = new Set<number>()
    const stmtEntries = Object.entries(stmtMap)
    for (let i = 0, { length } = stmtEntries; i < length; i += 1) {
      const entry = stmtEntries[i]!
      const id = entry[0]
      const loc = entry[1]
      const line = loc.start.line
      lineSet.add(line)
      if ((mergedS[id] ?? 0) > 0) {
        coveredLineSet.add(line)
      }
    }
    totalLines += lineSet.size
    coveredLines += coveredLineSet.size
  }

  function pct(covered: number, total: number): string {
    return total > 0 ? ((covered / total) * 100).toFixed(2) : '0.00'
  }

  return {
    branches: pct(coveredBranches, totalBranches),
    functions: pct(coveredFunctions, totalFunctions),
    lines: pct(coveredLines, totalLines),
    statements: pct(coveredStatements, totalStatements),
  }
}

// Print the test summary, optional v8 detail table, and the coverage summary.
export function displayCodeCoverage(
  mainOutput: string,
  combinedOutput: string,
  aggregateCoverage: AggregateCoverage | undefined,
  {
    showDetail,
    typeCoveragePercent,
  }: { showDetail: boolean; typeCoveragePercent: number | undefined },
): void {
  if (showDetail) {
    const testSummaryMatch = combinedOutput.match(
      /Test Files\s+\d+[^\n]*\n[\s\S]*?Duration\s+[\d.]+m?s[^\n]*/,
    )
    if (testSummaryMatch) {
      logger.log('')
      logger.log(testSummaryMatch[0])
      logger.log('')
    }

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

  const codeCoveragePercent = aggregateCoverage
    ? Number.parseFloat(aggregateCoverage.statements)
    : (() => {
        const m = mainOutput.match(/All files\s+\|\s+([\d.]+)\s+\|/)
        return m?.[1] ? Number.parseFloat(m[1]) : 0
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

export async function main(): Promise<void> {
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

  logger.info('Building with source maps for coverage…')
  const buildResult = await spawn('node', ['scripts/build.mts'], {
    cwd: rootPath,
    stdio: 'inherit',
    env: {
      ...process.env,
      COVERAGE: 'true',
    },
  })
  const buildFailed = buildResult.code !== 0
  if (buildFailed) {
    logger.error('Build with source maps failed')
    process.exitCode = 1
  }
  logger.log('')

  const customFlags = ['--code-only', '--type-only', '--summary']
  const passthroughArgs = process.argv
    .slice(2)
    .filter(arg => !customFlags.includes(arg))

  const mainConfig = resolveConfig('vitest.config.mts')
  const isolatedConfig = resolveConfig('vitest.config.isolated.mts')

  const mainVitestArgs = [
    'exec',
    'vitest',
    'run',
    ...(mainConfig ? ['--config', mainConfig] : []),
    '--coverage',
    ...passthroughArgs,
  ]
  const isolatedVitestArgs = isolatedConfig
    ? [
        'exec',
        'vitest',
        'run',
        '--config',
        isolatedConfig,
        '--coverage',
        ...passthroughArgs,
      ]
    : undefined
  const typeCoverageArgs = ['exec', 'type-coverage']

  try {
    let exitCode = 0

    if (values['type-only']) {
      const typeCoverageResult = await runQuiet(typeCoverageArgs, {
        cwd: rootPath,
      })
      exitCode = typeCoverageResult.exitCode

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
    } else {
      const { combined, mainResult } = await runTestSuites(
        mainVitestArgs,
        isolatedVitestArgs,
      )
      exitCode = combined.exitCode

      const mainOutput = cleanOutput(mainResult.stdout + mainResult.stderr)
      const combinedOutput = cleanOutput(combined.stdout + combined.stderr)

      let typeCoveragePercent: number | undefined
      if (!values['code-only']) {
        const typeCoverageResult = await runQuiet(typeCoverageArgs, {
          cwd: rootPath,
        })
        const typeCoverageOutput = (
          typeCoverageResult.stdout + typeCoverageResult.stderr
        ).trim()
        typeCoveragePercent = parseTypeCoveragePercent(typeCoverageOutput)
      }

      let aggregateCoverage: AggregateCoverage | undefined
      try {
        aggregateCoverage = await mergeCoverageFinal()
      } catch (e) {
        logger.warn(
          `Could not compute aggregate coverage: ${e instanceof Error ? e.message : 'Unknown error'}`,
        )
      }

      displayCodeCoverage(mainOutput, combinedOutput, aggregateCoverage, {
        showDetail: !values['summary'],
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
  } catch (e) {
    logger.error(
      `Coverage script failed: ${e instanceof Error ? e.message : String(e)}`,
    )
    process.exitCode = 1
  }
}

await main()
