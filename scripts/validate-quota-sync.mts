#!/usr/bin/env node
/**
 * @file Validates that quota information is consistent across the three sources
 *   of truth:
 *
 *   1. The `@quota N units` JSDoc tag on each public method in
 *      `src/socket-sdk-class.ts`.
 *   2. The `data/api-method-quota-and-permissions.json` data file.
 *   3. The OpenAPI operation ID referenced from the method (via `@operationId`
 *      JSDoc tag, the first `<'opId'>` type generic in the body, or the method
 *      name itself). Usage: node scripts/validate-quota-sync.mts # report +
 *      exit non-zero node scripts/validate-quota-sync.mts --warn # report only,
 *      exit 0
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger'

import { getRootPath } from './utils/path-helpers.mts'

const logger = getDefaultLogger()
const rootPath = getRootPath(import.meta.url)
const classPath = path.join(rootPath, 'src/socket-sdk-class.ts')
const dataPath = path.join(
  rootPath,
  'data/api-method-quota-and-permissions.json',
)

// Type generics in the SDK class that reference op-ids whose casing or naming
// doesn't match `api-method-quota-and-permissions.json`. Clearing these is a
// follow-up: either rename the type generic or rename the data-file entry.
const KNOWN_NAME_DRIFT: ReadonlySet<string> = new Set([
  'batchOrgPackageFetch:batchPackageFetchByOrg',
  'createFullScan:CreateOrgFullScan',
  'createOrgFullScanFromArchive:CreateOrgFullScanArchive',
  'createOrgWebhook:createOrgWebhook',
  'deleteOrgWebhook:deleteOrgWebhook',
  'downloadOrgFullScanFilesAsTar:downloadOrgFullScanFilesAsTar',
  'getDiffScanGfm:GetDiffScanGfm',
  'getFullScan:getOrgFullScan',
  'getIssuesByNpmPackage:getIssuesByNPMPackage',
  'getOrgAlertFullScans:alertFullScans',
  'getOrgAlertsList:alertsList',
  'getOrgTelemetryConfig:getOrgTelemetryConfig',
  'getOrgWebhook:getOrgWebhook',
  'getOrgWebhooksList:getOrgWebhooksList',
  'getScoreByNpmPackage:getScoreByNPMPackage',
  'getSupportedFiles:getSupportedFiles',
  'rescanFullScan:rescanOrgFullScan',
  'streamFullScan:getOrgFullScan',
  'updateOrgTelemetryConfig:updateOrgTelemetryConfig',
  'updateOrgWebhook:updateOrgWebhook',
])

interface DataEntry {
  quota: number
  permissions: string[]
}

interface QuotaData {
  api: Record<string, DataEntry>
}

interface MethodInfo {
  name: string
  jsdocQuota: number | undefined
  operationId: string | undefined
  hadOperationIdNone: boolean
}

// ---------------------------------------------------------------------------
// Private entry point.
// ---------------------------------------------------------------------------

function main(): void {
  const warnOnly = process.argv.includes('--warn')
  const data = JSON.parse(readFileSync(dataPath, 'utf8')) as QuotaData
  const methods = extractMethods()
  const errors: string[] = []
  const warnings: string[] = []

  for (let i = 0, { length } = methods; i < length; i += 1) {
    const m = methods[i]!
    if (!m.operationId && !m.hadOperationIdNone) {
      errors.push(
        `${m.name}: no operation ID. Add a JSDoc \`@operationId <id>\` tag (or \`@operationId none\` if intentional).`,
      )
      continue
    }
    if (m.hadOperationIdNone) {
      continue
    }

    const resolved = resolveDataEntry(data, m.operationId!)
    const driftKey = `${m.name}:${m.operationId}`
    if (!resolved) {
      if (KNOWN_NAME_DRIFT.has(driftKey)) {
        warnings.push(
          `${m.name}: op-id \`${m.operationId}\` not found in data file (known drift).`,
        )
      } else {
        errors.push(
          `${m.name}: op-id \`${m.operationId}\` is not present in data/api-method-quota-and-permissions.json.`,
        )
      }
      continue
    }

    if (resolved.key !== m.operationId) {
      if (!KNOWN_NAME_DRIFT.has(driftKey)) {
        errors.push(
          `${m.name}: op-id \`${m.operationId}\` only resolves case-insensitively to \`${resolved.key}\`. Reconcile the casing.`,
        )
        continue
      }
      warnings.push(
        `${m.name}: op-id \`${m.operationId}\` differs in casing from data key \`${resolved.key}\` (known drift).`,
      )
    }

    if (m.jsdocQuota === undefined) {
      warnings.push(
        `${m.name}: no \`@quota N units\` JSDoc tag (data file says ${resolved.entry.quota}).`,
      )
    } else if (m.jsdocQuota !== resolved.entry.quota) {
      errors.push(
        `${m.name}: JSDoc \`@quota ${m.jsdocQuota}\` disagrees with data file (${resolved.entry.quota}).`,
      )
    }
  }

  if (warnings.length > 0) {
    logger.log('')
    logger.warn(`Quota-sync warnings (${warnings.length}):`)
    for (let i = 0, { length } = warnings; i < length; i += 1) {
      const w = warnings[i]!
      logger.warn(`  ${w}`)
    }
  }

  if (errors.length > 0) {
    logger.log('')
    logger.error(`Quota-sync errors (${errors.length}):`)
    for (let i = 0, { length } = errors; i < length; i += 1) {
      const e = errors[i]!
      logger.error(`  ${e}`)
    }
    if (!warnOnly) {
      process.exitCode = 1
      return
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    logger.success(
      `Quota sync OK (${methods.length} methods checked against ${Object.keys(data.api).length} data entries).`,
    )
  } else if (errors.length === 0) {
    logger.success(`Quota sync passed with ${warnings.length} warning(s).`)
  }
}

main()

// ---------------------------------------------------------------------------
// Exported helpers (alphabetical).
// ---------------------------------------------------------------------------

/**
 * Extract method information from the SDK class source.
 */
export function extractMethods(): MethodInfo[] {
  const src = readFileSync(classPath, 'utf8')
  const lines = src.split('\n')
  const out: MethodInfo[] = []
  const seen = new Set<string>()

  let i = 0
  while (i < lines.length) {
    const match = lines[i]!.match(/^  async \*?([a-zA-Z][a-zA-Z0-9_]*)[<(]/)
    if (!match) {
      i++
      continue
    }
    const name = match[1]!
    if (seen.has(name)) {
      i++
      continue
    }
    seen.add(name)

    let sigEnd = i
    while (sigEnd < lines.length) {
      const line = lines[sigEnd]!
      if (
        line.match(/\)\s*:\s*[^=]+\{$/) ||
        line === '  ) {' ||
        line.endsWith(' {')
      ) {
        break
      }
      sigEnd++
    }
    let bodyEnd = sigEnd + 1
    while (bodyEnd < lines.length && lines[bodyEnd] !== '  }') {
      bodyEnd++
    }
    const body = lines.slice(i, bodyEnd + 1).join('\n')

    let jsdocEnd = i - 1
    while (jsdocEnd >= 0 && lines[jsdocEnd]!.trim() === '') {
      jsdocEnd--
    }
    let jsdocQuota: number | undefined
    let operationId: string | undefined
    let hadOperationIdNone = false
    if (jsdocEnd >= 0 && lines[jsdocEnd]!.trim() === '*/') {
      let jsdocStart = jsdocEnd
      while (jsdocStart >= 0 && lines[jsdocStart]!.trim() !== '/**') {
        jsdocStart--
      }
      const jsdoc = lines.slice(jsdocStart, jsdocEnd + 1).join('\n')
      const qMatch = jsdoc.match(/@quota\s+(\d+)\s*units?/)
      if (qMatch) {
        jsdocQuota = Number(qMatch[1])
      }
      const opMatch = jsdoc.match(/@operationId\s+(\S+)/)
      if (opMatch) {
        if (opMatch[1] === 'none') {
          hadOperationIdNone = true
        } else {
          operationId = opMatch[1]
        }
      }
    }
    if (!operationId && !hadOperationIdNone) {
      const generic = body.match(/<'([a-zA-Z][a-zA-Z0-9]*)'[,>]/)
      if (generic) {
        operationId = generic[1]
      }
    }
    out.push({ hadOperationIdNone, jsdocQuota, name, operationId })
    i = bodyEnd + 1
  }
  return out
}

/**
 * Resolve an op-id against the data file (exact match first, case-insensitive
 * fallback).
 */
export function resolveDataEntry(
  data: QuotaData,
  opId: string,
): { key: string; entry: DataEntry } | undefined {
  if (data.api[opId]) {
    return { entry: data.api[opId]!, key: opId }
  }
  const lower = opId.toLowerCase()
  const entries = Object.entries(data.api)
  for (let i = 0, { length } = entries; i < length; i += 1) {
    const entry = entries[i]!
    const key = entry[0]
    const value = entry[1]
    if (key.toLowerCase() === lower) {
      return { entry: value, key }
    }
  }
  return undefined
}
