#!/usr/bin/env node
/**
 * @file Runs the repository's complete static and build checks.
 */

import process from 'node:process'

import { isMainModule, runMain } from '../cli.mts'
import { runSequence } from '../run-command.mts'

import type { ScriptMeta } from '../cli.mts'

export const CHECK_COMMANDS = [
  { args: ['run', 'fmt:check'], command: 'pnpm' },
  { args: ['run', 'check:api-contracts'], command: 'pnpm' },
  { args: ['run', 'lint'], command: 'pnpm' },
  { args: ['run', 'repo:type'], command: 'pnpm' },
  { args: ['run', 'build'], command: 'pnpm' },
]

async function main(): Promise<void> {
  const exitCode = await runSequence(CHECK_COMMANDS)
  if (exitCode !== 0) {
    process.exitCode = exitCode
  }
}

const SCRIPT_META: ScriptMeta = {
  describe: 'runs formatting, generated-contract, lint, type, and build checks',
  help: 'Usage: pnpm run check\n\nRuns formatting, generated API contract freshness, lint, type, and build checks in sequence, stopping at the first failure.',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
