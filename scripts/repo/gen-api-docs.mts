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
import { format } from 'oxfmt'

import {
  extractIndexDescription,
  extractMethods,
  renderApiDocs,
} from './api-doc/lib.mts'
import { extractPackageExports } from './api-doc/exports.mts'
import { packageExportTargets } from './api-doc/export-source.mts'
import { isMainModule } from './cli.mts'
import { runMain } from './cli.mts'
import type { ScriptMeta } from './cli.mts'
import type { FormatConfig } from 'oxfmt'

const logger = getDefaultLogger()
const rootPackageJsonPath = findUpSync('package.json', {
  cwd: path.dirname(fileURLToPath(import.meta.url)),
})
if (!rootPackageJsonPath) {
  throw new Error('Unable to locate repository root (package.json not found).')
}
const rootPath = path.dirname(rootPackageJsonPath)
const outPath = path.join(rootPath, 'docs/api.md')

export async function generateApiDocs(): Promise<void> {
  const check = process.argv.includes('--check')
  const methods = extractMethods()
  const packageJson: unknown = JSON.parse(
    readFileSync(path.join(rootPath, 'package.json'), 'utf8'),
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
  const rendered = renderApiDocs(methods, {
    publicExports,
    indexDescription: description,
    entrypoints: targets,
  })
  const next = await formatApiDocs(rendered)

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

  writeFileSync(outPath, next, { encoding: 'utf8' })
  logger.success(
    `Wrote ${path.relative(rootPath, outPath)} (${methods.length} methods)`,
  )
}

async function formatApiDocs(rendered: string): Promise<string> {
  const configPath = path.join(rootPath, '.config/repo/oxfmtrc.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as FormatConfig
  const result = await format(outPath, rendered, config)
  if (result.errors.length > 0) {
    throw new Error(
      'API documentation formatting failed because the generated output contains syntax errors.',
    )
  }
  return result.code
}

const SCRIPT_META: ScriptMeta = {
  describe: 'generate SDK API documentation',
  help: `Usage: node scripts/repo/gen-api-docs.mts [--check]\n\n--check  verify documentation without writing\n--help, -h  show usage\n--describe  show purpose`,
  json: 'result',
}

if (isMainModule(import.meta.url)) {
  runMain(generateApiDocs, SCRIPT_META)
}
