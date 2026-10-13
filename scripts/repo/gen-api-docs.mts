#!/usr/bin/env node
/*
 * @file Writes docs/api.md from the SDK class and the quota data file.
 *   `--check` diffs instead of writing and exits 1 on drift.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { findUpSync } from '@socketsecurity/lib-stable/fs/find'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

import {
  extractIndexDescription,
  extractMethods,
  renderApiDocs,
} from './gen-api-docs-lib.mts'
import { extractPackageExports } from './gen-api-docs-exports.mts'
import { packageExportTargets } from './gen-api-docs-export-source.mts'
import { isMainModule } from '../fleet/process/is-main-module.mts'
import type { ScriptMeta } from '../fleet/process/main/run.mts'

import { runMain } from '../fleet/process/main/run.mts'

const logger = getDefaultLogger()
const rootPackageJsonPath = findUpSync('package.json', {
  cwd: path.dirname(fileURLToPath(import.meta.url)),
})
if (!rootPackageJsonPath) {
  throw new Error('Unable to locate repository root (package.json not found).')
}
const rootPath = path.dirname(rootPackageJsonPath)
const outPath = path.join(rootPath, 'docs/api.md')

export function generateApiDocs(): void {
  const check = process.argv.includes('--check')
  const methods = extractMethods()
  const packageJson: unknown = JSON.parse(
    readFileSync(rootPackageJsonPath, 'utf8'),
  )
  if (
    typeof packageJson !== 'object' ||
    packageJson === null ||
    !('exports' in packageJson)
  ) {
    throw new Error('package.json does not define an exports map.')
  }
  const entryPath = path.join(rootPath, 'src/index.mts')
  const entrySource = readFileSync(entryPath, 'utf8')
  const description = extractIndexDescription(entrySource)
  const targets = packageExportTargets(packageJson.exports)
  const publicExports = extractPackageExports(targets, packagePath =>
    readFileSync(path.join(rootPath, packagePath), 'utf8'),
  )
  const next = renderApiDocs(methods, {
    publicExports,
    indexDescription: description,
    entrypoints: targets,
  })

  if (check) {
    const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : ''
    if (current !== next) {
      logger.error(`docs/api.md is out of date. Run: pnpm run docs:api`)
      process.exitCode = 1
      return
    }
    logger.success('docs/api.md is up to date')
    return
  }

  writeFileSync(outPath, next)
  logger.success(
    `Wrote ${path.relative(rootPath, outPath)} (${methods.length} methods)`,
  )
}

const SCRIPT_META: ScriptMeta = {
  describe: 'generate SDK API documentation',
  help: `Usage: node scripts/repo/gen-api-docs.mts [--check]\n\n--check  verify documentation without writing\n--help, -h  show usage\n--describe  show purpose`,
  json: 'result',
}

if (isMainModule(import.meta.url)) {
  runMain(generateApiDocs, SCRIPT_META)
}
