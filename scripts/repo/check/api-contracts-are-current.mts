#!/usr/bin/env node
/**
 * @file Checks generated API contracts against the local v0 and v1 snapshots.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

import { isMainModule } from '../../fleet/process/is-main-module.mts'
import { runMain } from '../../fleet/process/run-main.mts'
import { generateSdkContracts } from '../generate-sdk.mts'

import type { ScriptMeta } from '../../fleet/process/run-main.mts'

const logger = getDefaultLogger()

async function main(): Promise<number> {
  const rootPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../..',
  )
  const drift = await generateSdkContracts({
    rootPath,
    offline: true,
    check: true,
  })
  if (drift.length === 0) {
    return 0
  }
  logger.error(
    `API contracts are stale: ${drift.map(file => path.relative(rootPath, file)).join(', ')}. Run pnpm run generate-sdk --offline.`,
  )
  return 1
}

const SCRIPT_META: ScriptMeta = {
  describe:
    'checks generated API artifacts against both local OpenAPI snapshots',
  help: 'Usage: pnpm run check:api-contracts\n\nChecks v0 and v1 contract freshness without writing files or using the network.',
  json: 'result',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
