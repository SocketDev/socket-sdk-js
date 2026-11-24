#!/usr/bin/env node
/**
 * @file Runs the checks required before opening an OpenAPI update pull request.
 */

import process from 'node:process'

import { isMainModule } from '../cli.mts'
import { runMain } from '../cli.mts'
import { runSequence } from '../run-command.mts'

import type { ScriptMeta } from '../cli.mts'

async function main(): Promise<void> {
  const exitCode = await runSequence([
    {
      args: ['run', 'check:api-contracts'],
      command: 'pnpm',
    },
    {
      args: ['run', 'check'],
      command: 'pnpm',
    },
    {
      args: ['test'],
      command: 'pnpm',
    },
    {
      args: ['run', 'check:package-artifact'],
      command: 'pnpm',
    },
  ])
  if (exitCode !== 0) {
    process.exitCode = exitCode
  }
}

const SCRIPT_META: ScriptMeta = {
  describe: 'runs the full preflight for generated OpenAPI pull requests',
  help: 'Usage: pnpm run check:openapi-pr\n\nRuns contract freshness, repository checks, tests, and package-artifact validation before opening or updating an automated OpenAPI pull request.',
  json: 'result',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
