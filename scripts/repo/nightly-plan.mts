/**
 * @file Plan the npm nightly version and write skip and version for the workflow.
 */

import { readFileSync } from 'node:fs'
import process from 'node:process'

import { isMainModule } from '../fleet/process/is-main-module.mts'
import { runMain } from '../fleet/process/run-main.mts'
import type { ScriptMeta } from '../fleet/process/run-main.mts'
import {
  getScriptArgs,
  getScriptLogger,
} from '../fleet/process/script-output.mts'
import type { ScriptResult } from '../fleet/process/script-result.mts'

import { planNpmNightly, utcNightlyDay } from './nightly/plan.mts'

async function main(): Promise<ScriptResult> {
  const plan = await planNpmNightly({
    argv: getScriptArgs(),
    day: utcNightlyDay(new Date()),
    manifestText: readFileSync('package.json', 'utf8'),
    outputPath: process.env['GITHUB_OUTPUT'],
  })
  const skip = plan.skip ? 'true' : 'false'
  getScriptLogger().log(`nightly plan skip=${skip} version=${plan.version}`)
  return { exitCode: 0, data: { skip, version: plan.version } }
}

const SCRIPT_META: ScriptMeta = {
  describe:
    'plans the npm nightly version and writes skip and version outputs',
  help: `Usage: pnpm run release:nightly:plan --ecosystem npm

  --ecosystem <name>  registry to plan (npm)
  --json              print the plan as JSON`,
  json: 'result',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
