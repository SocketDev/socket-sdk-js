/**
 * @fileoverview Auto-fix script — runs linters with --fix, then security
 * tools (zizmor, agentshield) if available.
 *
 * Steps:
 *   1. pnpm run lint --fix — oxlint + oxfmt
 *   2. zizmor --fix .github/ — GitHub Actions workflow fixes (if .github/ exists)
 *   3. agentshield scan --fix — Claude config fixes (if .claude/ exists)
 */

import { existsSync } from 'node:fs'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { spawn } from '@socketsecurity/lib/spawn'

const WIN32 = process.platform === 'win32'
const logger = getDefaultLogger()

interface RunOptions {
  label?: string
  required?: boolean
}

async function run(
  cmd: string,
  args: string[],
  { label, required = true }: RunOptions = {},
): Promise<number> {
  try {
    const result = await spawn(cmd, args, {
      shell: WIN32,
      stdio: 'inherit',
    })
    if (result.code !== 0 && required) {
      logger.error(`${label || cmd} failed (exit ${result.code})`)
      return result.code
    }
    if (result.code !== 0) {
      // Non-blocking: log warning and continue.
      logger.warn(`${label || cmd}: exited ${result.code} (non-blocking)`)
    }
    return 0
  } catch (e) {
    if (!required) {
      logger.warn(
        `${label || cmd}: ${e instanceof Error ? e.message : String(e)} (non-blocking)`,
      )
      return 0
    }
    throw e
  }
}

async function main(): Promise<void> {
  // Step 1: Lint fix — delegates to per-package lint scripts.
  const lintExit = await run(
    'pnpm',
    ['run', 'lint', '--fix', ...process.argv.slice(2)],
    { label: 'lint --fix' },
  )
  if (lintExit) {
    process.exitCode = lintExit
  }

  // Step 2: zizmor — fixes GitHub Actions workflow security issues.
  // Only runs if .github/ directory exists (some repos don't have workflows).
  if (existsSync('.github')) {
    await run('zizmor', ['--fix', '.github/'], {
      label: 'zizmor --fix',
      required: false,
    })
  }

  // Step 3: AgentShield — fixes Claude config security findings.
  // Only runs if .claude/ exists and agentshield binary is installed.
  if (existsSync('.claude') && existsSync('node_modules/.bin/agentshield')) {
    await run('pnpm', ['exec', 'agentshield', 'scan', '--fix'], {
      label: 'agentshield --fix',
      required: false,
    })
  }
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
