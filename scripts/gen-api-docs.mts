#!/usr/bin/env node
/**
 * @fileoverview Generates docs/api.md from src/socket-sdk-class.ts and
 * data/api-method-quota-and-permissions.json. The doc is a one-line-per-method
 * reference grouped by domain. Quota costs come from the SDK's own quota API.
 *
 * Resolution rules for the OpenAPI operation ID (used to look up quota):
 *   1. JSDoc `@operationId <id>` tag — explicit override. `none` means skip.
 *   2. First `<'opId'>` type generic in the method body (e.g.,
 *      `#handleApiError<'createOrgRepo'>`).
 *   3. The method name itself, if it appears as a key in the data file.
 *
 * Usage:
 *   node scripts/gen-api-docs.mts          # write the file
 *   node scripts/gen-api-docs.mts --check  # diff only, exit 1 on drift
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib/logger'

import { getRootPath } from './utils/path-helpers.mts'

const logger = getDefaultLogger()
const rootPath = getRootPath(import.meta.url)
const classPath = path.join(rootPath, 'src/socket-sdk-class.ts')
const dataPath = path.join(
  rootPath,
  'data/api-method-quota-and-permissions.json',
)
const outPath = path.join(rootPath, 'docs/api.md')

interface QuotaData {
  api: Record<string, { quota: number; permissions: string[] }>
}

interface MethodInfo {
  name: string
  isGenerator: boolean
  signature: string
  summary: string
  operationId: string | undefined
  quota: number | undefined
  permissions: string[]
}

// Group definitions, in render order. Each entry's `methods` list controls
// inclusion + ordering inside the group. Any method not listed below falls
// through to the catch-all "Other" group so additions surface immediately.
const GROUPS: Array<{
  title: string
  description: string
  methods: string[]
}> = [
  {
    title: 'Full scans',
    description:
      'Create, fetch, list, and delete organization-level full security scans.',
    methods: [
      'createFullScan',
      'createOrgFullScanFromArchive',
      'getFullScan',
      'getFullScanMetadata',
      'listFullScans',
      'streamFullScan',
      'downloadOrgFullScanFilesAsTar',
      'rescanFullScan',
      'deleteFullScan',
    ],
  },
  {
    title: 'Diff scans',
    description: 'Compare two scans and inspect the diff.',
    methods: [
      'createOrgDiffScanFromIds',
      'getDiffScanById',
      'getDiffScanGfm',
      'listOrgDiffScans',
      'deleteOrgDiffScan',
    ],
  },
  {
    title: 'Repositories',
    description: 'Manage repositories tracked by the organization.',
    methods: [
      'createRepository',
      'getRepository',
      'listRepositories',
      'updateRepository',
      'deleteRepository',
    ],
  },
  {
    title: 'Repository labels',
    description: 'Per-repo labels for filtering and grouping.',
    methods: [
      'createRepositoryLabel',
      'getRepositoryLabel',
      'listRepositoryLabels',
      'updateRepositoryLabel',
      'deleteRepositoryLabel',
    ],
  },
  {
    title: 'Organizations',
    description: 'Org listing, analytics, and entitlements.',
    methods: [
      'listOrganizations',
      'getOrgAnalytics',
      'getRepoAnalytics',
      'getEnabledEntitlements',
      'getEntitlements',
    ],
  },
  {
    title: 'Alerts & triage',
    description: 'Surface and triage alerts across an organization.',
    methods: [
      'getOrgAlertsList',
      'getOrgAlertFullScans',
      'getOrgTriage',
      'updateOrgAlertTriage',
      'getOrgFixes',
    ],
  },
  {
    title: 'Webhooks',
    description: 'Manage outbound webhooks for organization events.',
    methods: [
      'createOrgWebhook',
      'getOrgWebhook',
      'getOrgWebhooksList',
      'updateOrgWebhook',
      'deleteOrgWebhook',
    ],
  },
  {
    title: 'Patches',
    description: 'Browse and download Socket security patches.',
    methods: ['viewPatch', 'downloadPatch', 'streamPatchesFromScan'],
  },
  {
    title: 'API tokens',
    description:
      'Provision, rotate, and revoke API tokens for the organization.',
    methods: [
      'getAPITokens',
      'postAPIToken',
      'postAPITokenUpdate',
      'postAPITokensRotate',
      'postAPITokensRevoke',
    ],
  },
  {
    title: 'Policies',
    description: 'Read and update license + security policy settings.',
    methods: [
      'getOrgLicensePolicy',
      'updateOrgLicensePolicy',
      'getOrgSecurityPolicy',
      'updateOrgSecurityPolicy',
      'postSettings',
    ],
  },
  {
    title: 'Telemetry',
    description: 'Inspect and configure organization telemetry.',
    methods: [
      'getOrgTelemetryConfig',
      'updateOrgTelemetryConfig',
      'postOrgTelemetry',
    ],
  },
  {
    title: 'Audit log',
    description: 'Fetch organization audit log events.',
    methods: ['getAuditLogEvents'],
  },
  {
    title: 'Packages',
    description: 'Per-package and batch package analysis.',
    methods: [
      'getScoreByNpmPackage',
      'getIssuesByNpmPackage',
      'batchPackageFetch',
      'batchOrgPackageFetch',
      'batchPackageStream',
      'checkMalware',
      'searchDependencies',
    ],
  },
  {
    title: 'Dependencies & manifests',
    description: 'Upload manifests and snapshot dependency graphs.',
    methods: [
      'uploadManifestFiles',
      'createDependenciesSnapshot',
      'getSupportedFiles',
    ],
  },
  {
    title: 'Exports',
    description: 'Export full scans in industry-standard formats.',
    methods: ['exportCDX', 'exportSPDX', 'exportOpenVEX'],
  },
  {
    title: 'Quota',
    description: 'Inspect current API quota.',
    methods: ['getQuota'],
  },
  {
    title: 'Escape hatches',
    description: 'Raw HTTP access for endpoints the SDK does not wrap.',
    methods: ['getApi', 'sendApi'],
  },
]

const QUOTA_LABELS: Record<number, string> = {
  0: 'Free',
  10: 'Standard',
  100: 'Expensive',
}

// ---------------------------------------------------------------------------
// Private entry point.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Exported helpers (alphabetical).
// ---------------------------------------------------------------------------

/**
 * Extract public method records from the SDK class source.
 * Looks for top-level `async name(...)` / `async *name(...)` / `async name<T>(...)`
 * with a JSDoc block immediately above.
 */
export function extractMethods(): MethodInfo[] {
  const src = readFileSync(classPath, 'utf8')
  const lines = src.split('\n')
  const data = loadQuotaData()
  const methods: MethodInfo[] = []
  const seen = new Set<string>()

  let i = 0
  while (i < lines.length) {
    const match = lines[i]!.match(/^  async (\*)?([a-zA-Z][a-zA-Z0-9_]*)[<(]/)
    if (!match) {
      i++
      continue
    }

    const isGenerator = match[1] === '*'
    const name = match[2]!

    if (seen.has(name)) {
      i++
      continue
    }
    seen.add(name)

    // Walk through the signature: track ()/{} depth so nested object-literal
    // option params don't trip the "body starts" detector.
    let sigEnd = i
    let parenDepth = 0
    let braceDepth = 0
    let sawCloseParen = false
    while (sigEnd < lines.length) {
      const line = lines[sigEnd]!
      for (const ch of line) {
        if (ch === '(') {
          parenDepth++
        } else if (ch === ')') {
          parenDepth--
          if (parenDepth === 0) {
            sawCloseParen = true
          }
        } else if (ch === '{') {
          braceDepth++
        } else if (ch === '}') {
          braceDepth--
        }
      }
      if (
        sawCloseParen &&
        parenDepth === 0 &&
        braceDepth === 1 &&
        line.endsWith('{')
      ) {
        break
      }
      sigEnd++
      if (sigEnd - i > 80) {
        break
      }
    }
    const sigLines = lines.slice(i, sigEnd + 1).slice()
    const last = sigLines[sigLines.length - 1]!
    sigLines[sigLines.length - 1] = last.replace(/\s*\{$/, '')
    const signature = sigLines.map(l => l.replace(/^ {2}/, '')).join('\n')

    let bodyEnd = sigEnd + 1
    while (bodyEnd < lines.length && lines[bodyEnd] !== '  }') {
      bodyEnd++
    }
    const body = lines.slice(i, bodyEnd + 1).join('\n')

    let jsdocEnd = i - 1
    while (jsdocEnd >= 0 && lines[jsdocEnd]!.trim() === '') {
      jsdocEnd--
    }
    let summary = ''
    let operationId: string | undefined
    if (jsdocEnd >= 0 && lines[jsdocEnd]!.trim() === '*/') {
      let jsdocStart = jsdocEnd
      while (jsdocStart >= 0 && lines[jsdocStart]!.trim() !== '/**') {
        jsdocStart--
      }
      const jsdoc = lines.slice(jsdocStart, jsdocEnd + 1).join('\n')
      for (let k = jsdocStart + 1; k < jsdocEnd; k++) {
        const text = lines[k]!.replace(/^\s*\*\s?/, '').trim()
        if (text && !text.startsWith('@')) {
          summary = text
          break
        }
      }
      const opTag = jsdoc.match(/@operationId\s+(\S+)/)
      if (opTag) {
        operationId = opTag[1] === 'none' ? undefined : opTag[1]
      }
    }

    if (!operationId) {
      const generic = body.match(/<'([a-zA-Z][a-zA-Z0-9]*)'[,>]/)
      if (generic) {
        operationId = generic[1]
      }
    }
    if (!operationId && data.api[name]) {
      operationId = name
    }

    let quota: number | undefined
    let permissions: string[] = []
    if (operationId) {
      let entry = data.api[operationId]
      if (!entry) {
        const lower = operationId.toLowerCase()
        for (const [key, value] of Object.entries(data.api)) {
          if (key.toLowerCase() === lower) {
            entry = value
            break
          }
        }
      }
      if (entry) {
        quota = entry.quota
        permissions = entry.permissions
      }
    }

    methods.push({
      isGenerator,
      name,
      operationId,
      permissions,
      quota,
      signature,
      summary,
    })
    i = bodyEnd + 1
  }
  return methods
}

/**
 * Load and parse the quota data file.
 */
export function loadQuotaData(): QuotaData {
  return JSON.parse(readFileSync(dataPath, 'utf8')) as QuotaData
}

/**
 * Render the full markdown document from extracted methods.
 */
export function render(methods: MethodInfo[]): string {
  const byName = new Map(methods.map(m => [m.name, m]))
  const sections: string[] = []
  sections.push('<!--')
  sections.push('  AUTOGENERATED — do not edit by hand.')
  sections.push('  Regenerate with: pnpm run docs:api')
  sections.push('  Source: scripts/gen-api-docs.mts')
  sections.push('-->')
  sections.push('')
  sections.push('# API Reference')
  sections.push('')
  sections.push(
    'Every public method on `SocketSdk`, grouped by domain. For the runtime model (result shape, pagination, file uploads, escape hatches), see [SDK Concepts](./concepts.md). For quota planning, see [Quota Management](./quota-management.md).',
  )
  sections.push('')
  sections.push(`There are **${methods.length}** public methods.`)
  sections.push('')
  sections.push('## Contents')
  sections.push('')
  for (const group of GROUPS) {
    const anchor = group.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    sections.push(`- [${group.title}](#${anchor})`)
  }
  const inGroups = new Set<string>()
  for (const g of GROUPS) {
    for (const n of g.methods) {
      inGroups.add(n)
    }
  }
  const otherMethods = methods.filter(m => !inGroups.has(m.name))
  if (otherMethods.length > 0) {
    sections.push('- [Other](#other)')
  }
  sections.push('')

  for (const group of GROUPS) {
    sections.push(`## ${group.title}`)
    sections.push('')
    sections.push(group.description)
    sections.push('')
    for (const methodName of group.methods) {
      const m = byName.get(methodName)
      if (!m) {
        continue
      }
      sections.push(renderMethod(m))
    }
  }

  if (otherMethods.length > 0) {
    sections.push('## Other')
    sections.push('')
    sections.push(
      'Methods not yet placed into a domain group. Add them to `GROUPS` in `scripts/gen-api-docs.mts`.',
    )
    sections.push('')
    for (const m of otherMethods) {
      sections.push(renderMethod(m))
    }
  }

  return (
    sections
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  )
}

/**
 * Render a single method's reference block.
 */
export function renderMethod(m: MethodInfo): string {
  const sigBlock = '```typescript\n' + m.signature + '\n```'
  const summary = m.summary || '_(no description in source)_'
  const parts: string[] = []
  parts.push(`### \`${m.name}\``)
  parts.push('')
  parts.push(summary)
  parts.push('')
  parts.push(sigBlock)
  parts.push('')

  const meta: string[] = []
  if (m.quota === undefined) {
    meta.push('**Quota:** _not tracked_')
  } else {
    const label = QUOTA_LABELS[m.quota] ?? `${m.quota} units`
    meta.push(`**Quota:** \`${m.quota}\` (${label})`)
  }
  if (m.operationId) {
    meta.push(`**OpenAPI:** \`${m.operationId}\``)
  }
  if (m.permissions.length > 0) {
    meta.push(
      `**Permissions:** ${m.permissions.map(p => '`' + p + '`').join(', ')}`,
    )
  }
  parts.push(meta.join(' · '))
  parts.push('')

  return parts.join('\n')
}
