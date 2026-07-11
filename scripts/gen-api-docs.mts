#!/usr/bin/env node
/**
 * @file Generates docs/api.md from src/socket-sdk-class.mts and
 *   data/api-method-quota-and-permissions.json. The doc is a
 *   one-line-per-method reference grouped by domain. Quota costs come from the
 *   SDK's own quota API. Resolution rules for the OpenAPI operation ID (used to
 *   look up quota):
 *
 *   1. JSDoc `@operationId <id>` tag — explicit override. `none` means skip.
 *   2. First `<'opId'>` type generic in the method body (e.g.,
 *      `#handleApiError<'createOrgRepo'>`).
 *   3. The method name itself, if it appears as a key in the data file. Usage:
 *      node scripts/gen-api-docs.mts # write the file node
 *      scripts/gen-api-docs.mts --check # diff only, exit 1 on drift
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

import { extractMethods, render } from './gen-api-docs-lib.mts'
import { getRootPath } from './utils/path-helpers.mts'

const logger = getDefaultLogger()
const rootPath = getRootPath(import.meta.url)
const outPath = path.join(rootPath, 'docs/api.md')

function main(): void {
  const check = process.argv.includes('--check')
  const methods = extractMethods()
  const next = render(methods)

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

main()
