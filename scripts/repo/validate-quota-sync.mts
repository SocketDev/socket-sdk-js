#!/usr/bin/env node
/**
 * @file Validates SDK quota tags against method metadata and explicit OpenAPI
 *   aliases.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { findUpSync } from '@socketsecurity/lib-stable/fs/find'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { isMainModule } from '../fleet/process/is-main-module.mts'
import { runMain } from '../fleet/process/run-main.mts'

import type { ScriptMeta } from '../fleet/process/run-main.mts'
import { OPENAPI_METHOD_ALIASES } from './openapi-contracts.mts'
import { extractSdkClassMethods } from './sdk-method-extraction.mts'

/**
 * An SDK method name, as `getOrgFullScanList`. Named so the table's key says
 * which domain it belongs to. `src/types/keys.mts` carries the shipped twin;
 * a tooling tree must not reach into src/, so this one stands alone.
 */
type ApiMethodName = string

const logger = getDefaultLogger()
const rootPackageJsonPath = findUpSync('package.json', {
  cwd: path.dirname(fileURLToPath(import.meta.url)),
})
if (!rootPackageJsonPath) {
  throw new Error('Unable to locate repository root (package.json not found).')
}
const rootPath = path.dirname(rootPackageJsonPath)
const classPath = path.join(rootPath, 'src/socket-sdk-class.mts')
const dataPath = path.join(
  rootPath,
  'data/api-method-quota-and-permissions.json',
)

export interface DataEntry {
  quota: number
  permissions: string[]
}

export interface QuotaData {
  api: Record<ApiMethodName, DataEntry>
}

export interface MethodInfo {
  name: string
  jsdocQuota: number | undefined
  operationId: string | undefined
  hadOperationIdNone: boolean
}

// ---------------------------------------------------------------------------
// Private entry point.
// ---------------------------------------------------------------------------

function main(): number {
  const warnOnly = process.argv.includes('--warn')
  const data = JSON.parse(readFileSync(dataPath, 'utf8')) as QuotaData
  const methods = extractMethods()
  const errors: string[] = []

  for (const method of methods) {
    validateMethodQuota(method, data, errors)
  }

  if (errors.length > 0) {
    logger.log('')
    logger.error(`Quota-sync errors (${errors.length}):`)
    for (let i = 0, { length } = errors; i < length; i += 1) {
      const e = errors[i]!
      logger.error(`  ${e}`)
    }
    if (!warnOnly) {
      return 1
    }
  }

  if (errors.length === 0) {
    logger.success(
      `Quota sync OK (${methods.length} methods checked against ${Object.keys(data.api).length} data entries).`,
    )
  }
  return 0
}

const SCRIPT_META: ScriptMeta = {
  describe:
    'validates SDK quota tags against method metadata and OpenAPI aliases',
  help: 'Usage: pnpm run check:quota-sync [--warn]\n\nChecks quota metadata without network access. --warn reports errors without failing.',
  json: 'result',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}

// ---------------------------------------------------------------------------
// Exported helpers (alphabetical).
// ---------------------------------------------------------------------------

/**
 * Extract method information from the SDK class source.
 */
export function extractMethods(
  options: { source?: string | undefined } = {},
): MethodInfo[] {
  const { source = readFileSync(classPath, 'utf8') } = options
  return extractSdkClassMethods(source).map(
    ({ hadOperationIdNone, jsdocQuota, name, operationId }) => ({
      __proto__: null,
      hadOperationIdNone,
      jsdocQuota,
      name,
      operationId,
    }),
  )
}

export function resolveDataEntry(
  data: QuotaData,
  operationId: string,
  options: { methodName?: string | undefined } = {},
): { key: string; entry: DataEntry } | undefined {
  const { methodName } = options
  const key =
    methodName &&
    data.api[methodName] &&
    OPENAPI_METHOD_ALIASES[methodName] === operationId
      ? methodName
      : operationId
  const entry = data.api[key]
  return entry ? { key, entry } : undefined
}

export function validateMethodQuota(
  method: MethodInfo,
  data: QuotaData,
  errors: string[],
): void {
  if (!method.operationId && !method.hadOperationIdNone) {
    errors.push(
      `${method.name}: no operation ID. Add a JSDoc \`@operationId <id>\` tag (or \`@operationId none\` if intentional).`,
    )
    return
  }
  const operationId = method.operationId ?? method.name
  const resolved = resolveDataEntry(data, operationId, {
    methodName: method.name,
  })
  if (method.hadOperationIdNone && !resolved) {
    return
  }
  if (!resolved) {
    errors.push(
      `${method.name}: op-id \`${operationId}\` has no quota metadata. Add its method entry to data/api-method-quota-and-permissions.json.`,
    )
    return
  }
  if (method.jsdocQuota === undefined) {
    errors.push(
      `${method.name}: no \`@quota N units\` JSDoc tag (data file says ${resolved.entry.quota}). Add the verified quota tag.`,
    )
  } else if (method.jsdocQuota !== resolved.entry.quota) {
    errors.push(
      `${method.name}: JSDoc \`@quota ${method.jsdocQuota}\` disagrees with data file (${resolved.entry.quota}). Update the quota from the backend contract.`,
    )
  }
}
