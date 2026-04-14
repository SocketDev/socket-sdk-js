/**
 * @fileoverview Auto-fix script — runs linters with --fix, then security
 * tools (zizmor, agentshield) if available.
 *
 * Steps:
 *   1. pnpm run lint --fix — oxlint + oxfmt
 *   2. zizmor --fix .github/ — GitHub Actions workflow fixes (if .github/ exists)
 *   3. agentshield scan --fix — Claude config fixes (if .claude/ exists)
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

const WIN32 = process.platform === 'win32'

function run(cmd, args, { label, required = true } = {}) {
  try {
    execFileSync(cmd, args, {
      stdio: 'inherit',
      ...(WIN32 && { shell: true }),
    })
    return 0
  } catch (e) {
    if (required) {
      console.error(`${label || cmd} failed`)
      return e.status ?? 1
    }
    // Non-blocking tools: log warning and continue.
    console.warn(
      `${label || cmd}: ${e.status ? `exited ${e.status}` : e.message} (non-blocking)`,
    )
    return 0
  }
}

// Step 1: Lint fix — delegates to per-package lint scripts.
const lintExit = run(
  'pnpm',
  ['run', 'lint', '--fix', ...process.argv.slice(2)],
  {
    label: 'lint --fix',
  },
)
if (lintExit) {
  process.exitCode = lintExit
}

// Step 2: zizmor — fixes GitHub Actions workflow security issues.
// Only runs if .github/ directory exists (some repos don't have workflows).
if (existsSync('.github')) {
  run('zizmor', ['--fix', '.github/'], {
    label: 'zizmor --fix',
    required: false,
  })
}

// Step 3: AgentShield — fixes Claude config security findings.
// Only runs if .claude/ exists and agentshield binary is installed.
if (existsSync('.claude') && existsSync('node_modules/.bin/agentshield')) {
  run('pnpm', ['exec', 'agentshield', 'scan', '--fix'], {
    label: 'agentshield --fix',
    required: false,
  })
}
