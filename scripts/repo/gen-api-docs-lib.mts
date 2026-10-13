/**
 * @file Extraction + rendering helpers for the API docs generator. Houses the
 *   domain group definitions, quota labels, the method extractor that walks the
 *   SDK class source, and the markdown renderers consumed by
 *   scripts/repo/gen-api-docs.mts.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { findUpSync } from '@socketsecurity/lib-stable/fs/find'

import { MAX_UNFOLDED_CODE_LINES } from '../fleet/check/long-doc-sections-are-folded.mts'
import { GROUPS, QUOTA_LABELS } from './gen-api-docs-groups.mts'
import { extractSdkClassMethods } from './sdk-method-extraction.mts'
import { parseTypeScript } from './generate-strict-types-lib.mts'

import type { AstNode } from './generate-strict-types-lib.mts'

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

export interface QuotaData {
  api: Record<string, { quota: number; permissions: string[] }>
}

export interface MethodInfo {
  name: string
  isGenerator: boolean
  signature: string
  summary: string
  operationId: string | undefined
  quota: number | undefined
  permissions: string[]
}

export interface PublicExport {
  name: string
  kind: 'value' | 'type'
  modulePath: string
  line: number | undefined
}

/**
 * Extract public ordinary, async, and generator methods from the SocketSdk
 * class and attach adjacent JSDoc metadata.
 */
export function extractMethods(
  options: { source?: string | undefined; data?: QuotaData | undefined } = {},
): MethodInfo[] {
  const { source = readFileSync(classPath, 'utf8'), data = loadQuotaData() } =
    options
  const methods: MethodInfo[] = []
  const names = new Set<string>()
  for (const method of extractSdkClassMethods(source)) {
    const { name, isGenerator, signature, summary, hadOperationIdNone } = method
    if (names.has(name)) {
      continue
    }
    names.add(name)
    const operationId =
      method.operationId ??
      (!hadOperationIdNone && data.api[name] ? name : undefined)
    const entry = operationId
      ? Object.entries(data.api).find(
          ([key]) => key.toLowerCase() === operationId.toLowerCase(),
        )?.[1]
      : undefined
    methods.push({
      name,
      isGenerator,
      signature,
      summary,
      operationId,
      quota: entry?.quota,
      permissions: entry?.permissions ?? [],
    })
  }
  return methods
}

/**
 * Load and parse the quota data file.
 */
export function loadQuotaData(): QuotaData {
  return JSON.parse(readFileSync(dataPath, 'utf8')) as QuotaData
}

export function extractPublicExports(source: string): PublicExport[] {
  const exports: PublicExport[] = []
  const ast = parseTypeScript(source)
  const declarations = Array.isArray(ast.body) ? ast.body : []
  const declarationCache = new Map<string, string>()
  for (const statement of declarations) {
    if (
      statement.type !== 'ExportNamedDeclaration' &&
      statement.type !== 'ExportAllDeclaration'
    ) {
      continue
    }
    const modulePath = (statement.source as AstNode | undefined)?.['value']
    if (typeof modulePath !== 'string') {
      continue
    }
    const specifiers = Array.isArray(statement.specifiers)
      ? statement.specifiers
      : []
    const isTypeOnly = statement['exportKind'] === 'type'
    if (
      statement.type === 'ExportAllDeclaration' ||
      (specifiers.length === 0 && isTypeOnly)
    ) {
      const exportName =
        statement.type === 'ExportAllDeclaration' && statement.exported
          ? String((statement.exported as AstNode)['name'] ?? 'namespace')
          : `All ${isTypeOnly ? 'types' : 'exports'} from ${modulePath}`
      exports.push({
        name: exportName,
        kind: isTypeOnly ? 'type' : 'value',
        modulePath,
        line: undefined,
      })
      continue
    }
    let declarationSource = declarationCache.get(modulePath)
    if (declarationSource === undefined) {
      const sourcePath = path.join(rootPath, 'src', modulePath.slice(2))
      try {
        declarationSource = readFileSync(sourcePath, 'utf8')
        declarationCache.set(modulePath, declarationSource)
      } catch {
        declarationSource = ''
      }
    }
    for (const specifier of specifiers) {
      const exported = specifier.exported as AstNode | undefined
      const name = exported?.['name'] ?? exported?.['value']
      if (typeof name !== 'string') {
        continue
      }
      const local = specifier.local as AstNode | undefined
      const localName = local?.['name'] ?? local?.['value']
      const declaration = String(localName ?? name)
      exports.push({
        name,
        kind:
          isTypeOnly || specifier['exportKind'] === 'type' ? 'type' : 'value',
        modulePath,
        line: findDeclarationLine(declarationSource, declaration),
      })
    }
  }
  return exports.toSorted((a, b) => a.name.localeCompare(b.name))
}

function findDeclarationLine(source: string, name: string): number | undefined {
  if (!source) {
    return undefined
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(
    `\\b(?:export\\s+)?(?:declare\\s+)?(?:abstract\\s+)?(?:async\\s+)?(?:class|const|enum|function|interface|type|var|let)\\s+${escaped}\\b`,
  ).exec(source)
  return match ? source.slice(0, match.index).split('\n').length : undefined
}

/**
 * Render the full markdown document from extracted methods.
 */
export function renderApiDocs(
  methods: MethodInfo[],
  publicExports: PublicExport[] = [],
  indexDescription = '',
): string {
  const byName = new Map(methods.map(m => [m.name, m]))
  const sections: string[] = []
  sections.push('<!--')
  sections.push('  AUTOGENERATED. Do not edit by hand.')
  sections.push('  Regenerate with: pnpm run docs:api')
  sections.push('  Source: scripts/repo/gen-api-docs.mts')
  sections.push('-->')
  sections.push('')
  sections.push('# API Reference')
  sections.push('')
  sections.push(
    'Public SDK class methods, exported values, and types. For the runtime model (result shape, pagination, file uploads, escape hatches), see [SDK Concepts](./concepts.md). For quota planning, see [Quota Management](./quota-management.md).',
  )
  if (indexDescription) {
    sections.push('')
    sections.push(indexDescription)
  }
  sections.push('')
  sections.push(`There are **${methods.length}** public methods.`)
  sections.push('')
  sections.push('## Contents')
  sections.push('')
  for (let i = 0, { length } = GROUPS; i < length; i += 1) {
    const group = GROUPS[i]!
    const anchor = group.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    sections.push(`- [${group.title}](#${anchor})`)
  }
  const inGroups = new Set<string>()
  for (let i = 0, { length } = GROUPS; i < length; i += 1) {
    const g = GROUPS[i]!
    const methodNames = g.methods
    for (let j = 0, { length: jlen } = methodNames; j < jlen; j += 1) {
      inGroups.add(methodNames[j]!)
    }
  }
  const otherMethods = methods.filter(m => !inGroups.has(m.name))
  if (otherMethods.length > 0) {
    sections.push('- [Other](#other)')
  }
  sections.push('- [Package exports](#package-exports)')
  sections.push('')

  for (let i = 0, { length } = GROUPS; i < length; i += 1) {
    const group = GROUPS[i]!
    sections.push(`## ${group.title}`)
    sections.push('')
    sections.push(group.description)
    sections.push('')
    const methodNames = group.methods
    for (let j = 0, { length: jlen } = methodNames; j < jlen; j += 1) {
      const m = byName.get(methodNames[j]!)
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
      'Methods not yet placed into a domain group. Add them to `GROUPS` in `scripts/repo/gen-api-docs.mts`.',
    )
    sections.push('')
    for (let i = 0, { length } = otherMethods; i < length; i += 1) {
      const m = otherMethods[i]!
      sections.push(renderMethod(m))
    }
  }

  sections.push('## Package exports')
  sections.push('')
  sections.push(
    'Values and types exported from `src/index.mts`. Source links point to their declaration modules. See the linked declarations for signatures, fields, and type relationships.',
  )
  sections.push('')
  sections.push('| Export | Kind | Declaration |')
  sections.push('| --- | --- | --- |')
  for (const item of publicExports) {
    const fragment = item.line ? `#L${item.line}` : ''
    sections.push(
      `| \`${item.name}\` | ${item.kind} | [${item.modulePath}](../src/${item.modulePath.replace('./', '')}${fragment}) |`,
    )
  }
  sections.push('')

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
  parts.push(
    sigBlock.split(/\r?\n/).length > MAX_UNFOLDED_CODE_LINES
      ? `<details>\n<summary>Signature</summary>\n\n${sigBlock}\n\n</details>`
      : sigBlock,
  )
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
