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

import path from 'node:path'
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
  process.exit(1)
}
logger.log('')

// Run vitest with coverage enabled, capturing output
// Filter out custom flags that vitest doesn't understand
const customFlags = ['--code-only', '--type-only', '--summary']

// Build vitest commands for both main and isolated test suites
const mainVitestArgs = [
  'exec',
  'vitest',
  'run',
  '--config',
  '.config/vitest.config.mts',
  '--coverage',
  ...process.argv.slice(2).filter(arg => !customFlags.includes(arg)),
]
const isolatedVitestArgs = [
  'exec',
  'vitest',
  'run',
  '--config',
  '.config/vitest.config.isolated.mts',
  '--coverage',
  ...process.argv.slice(2).filter(arg => !customFlags.includes(arg)),
]
const typeCoverageArgs = ['exec', 'type-coverage']

try {
  let exitCode = 0
  let codeCoverageResult
  let typeCoverageResult

  // Handle --type-only flag
  if (values['type-only']) {
    typeCoverageResult = await runCommandQuiet('pnpm', typeCoverageArgs, {
      cwd: rootPath,
    })
    exitCode = typeCoverageResult.exitCode

    // Display type coverage only
    const typeCoverageOutput = (
      typeCoverageResult.stdout + typeCoverageResult.stderr
    ).trim()
    const typeCoverageMatch = typeCoverageOutput.match(
      /\([\d\s/]+\)\s+([\d.]+)%/,
    )

    if (typeCoverageMatch) {
      const typeCoveragePercent = Number.parseFloat(typeCoverageMatch[1])
      logger.log()
      logger.log(' Coverage Summary')
      logger.log(' ───────────────────────────────')
      logger.log(` Type Coverage: ${typeCoveragePercent.toFixed(2)}%`)
      logger.log()
    }
  }
  // Handle --code-only flag
  else if (values['code-only']) {
    // Run main test suite (allow failures for coverage reporting)
    let mainResult
    try {
      mainResult = await runCommandQuiet('pnpm', mainVitestArgs, {
        cwd: rootPath,
        env: { ...process.env, COVERAGE: 'true' },
      })
    } catch (error) {
      // Command may throw on non-zero exit, but we still want coverage
      mainResult = {
        exitCode: 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
      }
    }

    // Run isolated test suite (allow failures for coverage reporting)
    let isolatedResult
    try {
      isolatedResult = await runCommandQuiet('pnpm', isolatedVitestArgs, {
        cwd: rootPath,
        env: { ...process.env, COVERAGE: 'true' },
      })
    } catch (error) {
      // Command may throw on non-zero exit, but we still want coverage
      isolatedResult = {
        exitCode: 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
      }
    }

    // Combine results - fail if either failed
    exitCode =
      mainResult.exitCode !== 0 ? mainResult.exitCode : isolatedResult.exitCode
    codeCoverageResult = {
      stdout: mainResult.stdout + isolatedResult.stdout,
      stderr: mainResult.stderr + isolatedResult.stderr,
      exitCode,
    }

    // Parse coverage from both test suites
    const ansiRegex = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
    const cleanOutput = text =>
      text
        .replace(ansiRegex, '')
        .replace(/(?:✧|︎|⚡)\s*/g, '')
        .trim()

    const mainOutput = cleanOutput(mainResult.stdout + mainResult.stderr)
    const isolatedOutput = cleanOutput(
      isolatedResult.stdout + isolatedResult.stderr,
    )
    const output = cleanOutput(
      codeCoverageResult.stdout + codeCoverageResult.stderr,
    )

    // Extract test summary
    const testSummaryMatch = output.match(
      /Test Files\s+\d+[^\n]*\n[\s\S]*?Duration\s+[\d.]+m?s[^\n]*/,
    )
    if (!values.summary && testSummaryMatch) {
      logger.log()
      logger.log(testSummaryMatch[0])
      logger.log()
    }

    // Extract coverage from both suites for aggregation
    const extractCoverage = text => {
      const match = text.match(
        /All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/,
      )
      return match
        ? {
            statements: Number.parseFloat(match[1]),
            branches: Number.parseFloat(match[2]),
            functions: Number.parseFloat(match[3]),
            lines: Number.parseFloat(match[4]),
          }
        : null
    }

    const mainCoverage = extractCoverage(mainOutput)
    const isolatedCoverage = extractCoverage(isolatedOutput)

    // Extract coverage summary for display (use main suite as primary)
    const coverageHeaderMatch = mainOutput.match(
      / % Coverage report from v8\n([-|]+)\n([^\n]+)\n\1/,
    )
    const allFilesMatch = mainOutput.match(
      /All files\s+\|\s+([\d.]+)\s+\|[^\n]*/,
    )

    if (coverageHeaderMatch && allFilesMatch) {
      if (!values.summary) {
        logger.log(' % Coverage report from v8')
        logger.log(coverageHeaderMatch[1])
        logger.log(coverageHeaderMatch[2])
        logger.log(coverageHeaderMatch[1])
        logger.log(allFilesMatch[0])
        logger.log(coverageHeaderMatch[1])
        logger.log()
      }

      // Compute aggregate coverage from both test suites
      let aggregateCoverage = null
      if (mainCoverage && isolatedCoverage) {
        try {
          // Read coverage JSON files to get line counts for proper weighting
          const fs = await import('node:fs/promises')
          const mainCoverageJson = JSON.parse(
            await fs.readFile(
              path.join(rootPath, 'coverage/coverage-summary.json'),
              'utf8',
            ),
          )
          const isolatedCoverageJson = JSON.parse(
            await fs.readFile(
              path.join(rootPath, 'coverage-isolated/coverage-summary.json'),
              'utf8',
            ),
          )

          const mainTotal = mainCoverageJson.total
          const isolatedTotal = isolatedCoverageJson.total

          // Weight by covered/total lines for accurate aggregate
          const aggregate = (mainMetric, isolatedMetric) => {
            const totalCovered = mainMetric.covered + isolatedMetric.covered
            const totalLines = mainMetric.total + isolatedMetric.total
            return totalLines > 0
              ? ((totalCovered / totalLines) * 100).toFixed(2)
              : '0.00'
          }

          aggregateCoverage = {
            statements: aggregate(
              mainTotal.statements,
              isolatedTotal.statements,
            ),
            branches: aggregate(mainTotal.branches, isolatedTotal.branches),
            functions: aggregate(mainTotal.functions, isolatedTotal.functions),
            lines: aggregate(mainTotal.lines, isolatedTotal.lines),
          }
        } catch (error) {
          // Coverage JSON files not available, skip aggregation
          logger.log(
            `\nNote: Could not compute aggregate coverage: ${error.message}`,
          )
        }
      }

      const codeCoveragePercent = aggregateCoverage
        ? Number.parseFloat(aggregateCoverage.statements)
        : Number.parseFloat(allFilesMatch[1])

      logger.log(' Coverage Summary')
      logger.log(' ───────────────────────────────')
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
      logger.log()
    } else if (exitCode !== 0) {
      logger.log('\n--- Output ---')
      logger.log(output)
    }
  }
  // Default: run both code and type coverage
  else {
    // Run main test suite (allow failures for coverage reporting)
    let mainResult
    try {
      mainResult = await runCommandQuiet('pnpm', mainVitestArgs, {
        cwd: rootPath,
        env: { ...process.env, COVERAGE: 'true' },
      })
    } catch (error) {
      // Command may throw on non-zero exit, but we still want coverage
      mainResult = {
        exitCode: 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
      }
    }

    // Run isolated test suite (allow failures for coverage reporting)
    let isolatedResult
    try {
      isolatedResult = await runCommandQuiet('pnpm', isolatedVitestArgs, {
        cwd: rootPath,
        env: { ...process.env, COVERAGE: 'true' },
      })
    } catch (error) {
      // Command may throw on non-zero exit, but we still want coverage
      isolatedResult = {
        exitCode: 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
      }
    }

    // Combine results - fail if either failed
    exitCode =
      mainResult.exitCode !== 0 ? mainResult.exitCode : isolatedResult.exitCode
    codeCoverageResult = {
      stdout: mainResult.stdout + isolatedResult.stdout,
      stderr: mainResult.stderr + isolatedResult.stderr,
      exitCode,
    }

    // Run type coverage
    typeCoverageResult = await runCommandQuiet('pnpm', typeCoverageArgs, {
      cwd: rootPath,
    })

    // Parse coverage from both test suites
    const ansiRegex = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
    const cleanOutput = text =>
      text
        .replace(ansiRegex, '')
        .replace(/(?:✧|︎|⚡)\s*/g, '')
        .trim()

    const mainOutput = cleanOutput(mainResult.stdout + mainResult.stderr)
    const isolatedOutput = cleanOutput(
      isolatedResult.stdout + isolatedResult.stderr,
    )
    const output = cleanOutput(
      codeCoverageResult.stdout + codeCoverageResult.stderr,
    )

    // Extract test summary
    const testSummaryMatch = output.match(
      /Test Files\s+\d+[^\n]*\n[\s\S]*?Duration\s+[\d.]+m?s[^\n]*/,
    )

    // Extract coverage from both suites for aggregation
    const extractCoverage = text => {
      const match = text.match(
        /All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/,
      )
      return match
        ? {
            statements: Number.parseFloat(match[1]),
            branches: Number.parseFloat(match[2]),
            functions: Number.parseFloat(match[3]),
            lines: Number.parseFloat(match[4]),
          }
        : null
    }

    const mainCoverage = extractCoverage(mainOutput)
    const isolatedCoverage = extractCoverage(isolatedOutput)

    // Extract coverage summary for display (use main suite as primary)
    const coverageHeaderMatch = mainOutput.match(
      / % Coverage report from v8\n([-|]+)\n([^\n]+)\n\1/,
    )
    const allFilesMatch = mainOutput.match(
      /All files\s+\|\s+([\d.]+)\s+\|[^\n]*/,
    )

    // Extract type coverage
    const typeCoverageOutput = (
      typeCoverageResult.stdout + typeCoverageResult.stderr
    ).trim()
    const typeCoverageMatch = typeCoverageOutput.match(
      /\([\d\s/]+\)\s+([\d.]+)%/,
    )

    // Display output
    if (!values.summary && testSummaryMatch) {
      logger.log()
      logger.log(testSummaryMatch[0])
      logger.log()
    }

    if (coverageHeaderMatch && allFilesMatch) {
      if (!values.summary) {
        logger.log(' % Coverage report from v8')
        logger.log(coverageHeaderMatch[1])
        logger.log(coverageHeaderMatch[2])
        logger.log(coverageHeaderMatch[1])
        logger.log(allFilesMatch[0])
        logger.log(coverageHeaderMatch[1])
        logger.log()
      }

      // Compute aggregate coverage from both test suites
      let aggregateCoverage = null
      if (mainCoverage && isolatedCoverage) {
        // Read coverage JSON files to get line counts for proper weighting
        const fs = await import('node:fs/promises')
        const mainCoverageJson = JSON.parse(
          await fs.readFile(
            path.join(rootPath, 'coverage/coverage-summary.json'),
            'utf8',
          ),
        )
        const isolatedCoverageJson = JSON.parse(
          await fs.readFile(
            path.join(rootPath, 'coverage-isolated/coverage-summary.json'),
            'utf8',
          ),
        )

        const mainTotal = mainCoverageJson.total
        const isolatedTotal = isolatedCoverageJson.total

        // Weight by covered/total lines for accurate aggregate
        const aggregate = (mainMetric, isolatedMetric) => {
          const totalCovered = mainMetric.covered + isolatedMetric.covered
          const totalLines = mainMetric.total + isolatedMetric.total
          return totalLines > 0
            ? ((totalCovered / totalLines) * 100).toFixed(2)
            : '0.00'
        }

        aggregateCoverage = {
          statements: aggregate(mainTotal.statements, isolatedTotal.statements),
          branches: aggregate(mainTotal.branches, isolatedTotal.branches),
          functions: aggregate(mainTotal.functions, isolatedTotal.functions),
          lines: aggregate(mainTotal.lines, isolatedTotal.lines),
        }
      }

      // Display cumulative summary
      if (typeCoverageMatch) {
        const codeCoveragePercent = aggregateCoverage
          ? Number.parseFloat(aggregateCoverage.statements)
          : Number.parseFloat(allFilesMatch[1])
        const typeCoveragePercent = Number.parseFloat(typeCoverageMatch[1])
        const cumulativePercent = (
          (codeCoveragePercent + typeCoveragePercent) /
          2
        ).toFixed(2)

        logger.log(' Coverage Summary')
        logger.log(' ───────────────────────────────')
        logger.log(` Type Coverage: ${typeCoveragePercent.toFixed(2)}%`)
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
        logger.log(' ───────────────────────────────')
        logger.log(` Cumulative:    ${cumulativePercent}%`)
        logger.log()
      }
    } else if (exitCode !== 0) {
      logger.log('\n--- Output ---')
      logger.log(output)
    }
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
