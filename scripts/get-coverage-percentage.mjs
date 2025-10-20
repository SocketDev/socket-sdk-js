import { existsSync } from 'node:fs'
import path from 'node:path'

import colors from 'yoctocolors-cjs'

import { getSpinner } from '@socketsecurity/lib/constants/process'
import { getCodeCoverage } from '@socketsecurity/lib/cover/code'
import { getTypeCoverage } from '@socketsecurity/lib/cover/type'
import { logger } from '@socketsecurity/lib/logger'
import { parseArgs } from '@socketsecurity/lib/parse-args'

const indent = '  '

/**
 * Logs coverage percentage data including code and type coverage metrics.
 * Supports multiple output formats: default (formatted), JSON, and simple.
 */
async function logCoveragePercentage(argv) {
  const spinner = getSpinner()

  // Check if coverage data exists to determine whether to generate or read it.
  const coverageJsonPath = path.join(
    process.cwd(),
    'coverage',
    'coverage-final.json',
  )

  // Get code coverage metrics (statements, branches, functions, lines).
  let codeCoverage
  try {
    // Only show spinner in default output mode (not JSON or simple).
    if (!argv.json && !argv.simple) {
      if (!existsSync(coverageJsonPath)) {
        spinner.start('Generating coverage data...')
      } else {
        spinner.start('Reading coverage data...')
      }
    }

    codeCoverage = await getCodeCoverage()

    if (!argv.json && !argv.simple) {
      spinner.stop()
    }
  } catch (e) {
    if (!argv.json && !argv.simple) {
      spinner.stop()
    }
    logger.error('Failed to get code coverage:', e.message)
    throw e
  }

  // Get type coverage (optional - if it fails, we continue without it).
  // Type coverage is non-fatal because it's a secondary metric and may fail
  // in environments where dependencies are not fully available.
  let typeCoveragePercent = null
  try {
    typeCoveragePercent = await getTypeCoverage()
  } catch (e) {
    logger.error('Failed to get type coverage:', e.message)
    // Continue without type coverage - it's not critical.
  }

  // Calculate overall percentage (average of all metrics including type coverage if available).
  const codeCoverageMetrics = [
    parseFloat(codeCoverage.statements.percent),
    parseFloat(codeCoverage.branches.percent),
    parseFloat(codeCoverage.functions.percent),
    parseFloat(codeCoverage.lines.percent),
  ]

  let overall
  if (typeCoveragePercent !== null) {
    // Include type coverage in the overall calculation.
    const allMetrics = [...codeCoverageMetrics, typeCoveragePercent]
    overall = (
      allMetrics.reduce((a, b) => a + b, 0) / allMetrics.length
    ).toFixed(2)
  } else {
    // Fallback to just code coverage metrics when type coverage is unavailable.
    overall = (
      codeCoverageMetrics.reduce((a, b) => a + b, 0) /
      codeCoverageMetrics.length
    ).toFixed(2)
  }

  // Select an emoji based on overall coverage percentage for visual feedback.
  const COVERAGE_EMOJI_THRESHOLDS = [
    { threshold: 99, emoji: ' 🚀' },
    { threshold: 95, emoji: ' 🎯' },
    { threshold: 90, emoji: ' ✨' },
    { threshold: 80, emoji: ' 💪' },
    { threshold: 70, emoji: ' 📈' },
    { threshold: 60, emoji: ' ⚡' },
    { threshold: 50, emoji: ' 🔨' },
    { threshold: 0, emoji: ' ⚠️' },
  ]

  const overallNum = parseFloat(overall)
  const emoji =
    COVERAGE_EMOJI_THRESHOLDS.find(({ threshold }) => overallNum >= threshold)
      ?.emoji || ''

  // Output the coverage data in the requested format.
  if (argv.json) {
    // JSON format: structured output for programmatic consumption.
    const jsonOutput = {
      statements: codeCoverage.statements,
      branches: codeCoverage.branches,
      functions: codeCoverage.functions,
      lines: codeCoverage.lines,
    }

    if (typeCoveragePercent !== null) {
      jsonOutput.types = {
        percent: typeCoveragePercent.toFixed(2),
      }
    }

    jsonOutput.overall = overall

    console.log(JSON.stringify(jsonOutput, null, 2))
  } else if (argv.simple) {
    // Simple format: just the statement coverage percentage.
    console.log(codeCoverage.statements.percent)
  } else {
    // Default format: human-readable formatted output.
    logger.info('Coverage Summary:')
    logger.info(
      `${indent}Statements: ${codeCoverage.statements.percent}% (${codeCoverage.statements.covered}/${codeCoverage.statements.total})`,
    )
    logger.info(
      `${indent}Branches:   ${codeCoverage.branches.percent}% (${codeCoverage.branches.covered}/${codeCoverage.branches.total})`,
    )
    logger.info(
      `${indent}Functions:  ${codeCoverage.functions.percent}% (${codeCoverage.functions.covered}/${codeCoverage.functions.total})`,
    )
    logger.info(
      `${indent}Lines:      ${codeCoverage.lines.percent}% (${codeCoverage.lines.covered}/${codeCoverage.lines.total})`,
    )

    if (typeCoveragePercent !== null) {
      logger.info(`${indent}Types:      ${typeCoveragePercent.toFixed(2)}%`)
    }

    logger.info('')
    logger.info(colors.bold(`Current coverage: ${overall}% overall!${emoji}`))
  }
}

// Main entry point - parse command line arguments and display coverage.
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      json: {
        type: 'boolean',
        short: 'j',
        default: false,
      },
      simple: {
        type: 'boolean',
        short: 's',
        default: false,
      },
    },
    strict: false,
  })
  await logCoveragePercentage(values)
}

main().catch(console.error)
