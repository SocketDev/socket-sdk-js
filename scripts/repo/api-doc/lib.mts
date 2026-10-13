/**
 * @file Extraction + rendering helpers for the API docs generator. Houses the
 *   domain group definitions, quota labels, the method extractor that walks the
 *   SDK class source, and the markdown renderers consumed by
 *   scripts/repo/gen-api-docs.mts.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { tsPlugin } from '@sveltejs/acorn-typescript'
import { Parser } from 'acorn'
import { findUpSync } from '@socketsecurity/lib-stable/fs/find'
import { isPlainObject } from '@socketsecurity/lib-stable/objects/predicates'

import { MAX_UNFOLDED_CODE_LINES } from '../../fleet/check/long-doc-sections-are-folded.mts'
import { GROUPS, QUOTA_LABELS } from './groups.mts'
import { extractSdkClassMethods } from '../sdk-method-extraction.mts'
import type { AstNode } from '../generate-strict-types-lib.mts'
import type { ExportInfo, PackageExportTarget } from './export-source.mts'

const documentationParser = Parser.extend(tsPlugin())

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

export type PublicExport = ExportInfo

export function extractClassSignature(
  declaration: AstNode,
  source: string,
  signatureForMember: (member: AstNode, source: string) => string,
): string {
  const start = numeric(declaration.start) ?? 0
  const body = asNode(declaration.body)
  const bodyStart = numeric(body?.start)
  const end = numeric(declaration.end) ?? start
  const header = source.slice(start, bodyStart ?? end).trimEnd()
  const members = nodes(body?.body)
    .filter(member => {
      if (member.type === 'StaticBlock') {
        return false
      }
      const key = asNode(member.key)
      const name = typeof key?.['name'] === 'string' ? key['name'] : undefined
      return (
        member['accessibility'] !== 'private' &&
        member['accessibility'] !== 'protected' &&
        key?.type !== 'PrivateIdentifier' &&
        !name?.startsWith('#')
      )
    })
    .map(member => signatureForMember(member, source))
    .filter(Boolean)
  return members.length > 0
    ? `${header} {\n${members.map(member => `  ${member}`).join('\n')}\n}`
    : `${header} {}`
}

export function isGeneratedApiDeclaration(packagePath: string): boolean {
  return packagePath === 'types/api-v1.d.ts' || packagePath === 'types/api.d.ts'
}

export function extractIndexDescription(source: string): string {
  let description = ''
  documentationParser.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
    onComment: (block, text, start) => {
      if (!block || source.slice(0, start).trim()) {
        return
      }
      const lines = text
        .split(/\r?\n/)
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
      const fileIndex = lines.findIndex(line => line.startsWith('@file'))
      if (fileIndex >= 0) {
        const fileTagLine = lines[fileIndex]
        if (fileTagLine === undefined) {
          return
        }
        const fileLine = fileTagLine.slice('@file'.length).trim()
        const followingLines: string[] = []
        for (let i = fileIndex + 1, { length } = lines; i < length; i += 1) {
          const line = lines[i]
          if (line === undefined) {
            continue
          }
          if (line.startsWith('@')) {
            break
          }
          if (line) {
            followingLines.push(line)
          }
        }
        description = [fileLine, ...followingLines].filter(Boolean).join(' ')
      }
    },
  })
  return description
}

function asNode(value: unknown): AstNode | undefined {
  return isAstNode(value) ? value : undefined
}

function isAstNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function nodes(value: unknown): AstNode[] {
  return Array.isArray(value) ? value.filter(isAstNode) : []
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
  const extractedMethods = extractSdkClassMethods(source)
  for (let i = 0, { length } = extractedMethods; i < length; i += 1) {
    const method = extractedMethods[i]
    if (!method) {
      continue
    }
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
  const data: unknown = JSON.parse(readFileSync(dataPath, 'utf8'))
  if (!isQuotaData(data)) {
    throw new Error('Quota data does not match the expected API shape.')
  }
  return data
}

function isQuotaData(value: unknown): value is QuotaData {
  if (!isPlainObject(value) || !isPlainObject(value['api'])) {
    return false
  }
  const api = value['api']
  if (
    !Object.values(api).every(
      entry =>
        isPlainObject(entry) &&
        typeof entry['quota'] === 'number' &&
        Array.isArray(entry['permissions']) &&
        entry['permissions'].every(
          permission => typeof permission === 'string',
        ),
    )
  ) {
    return false
  }
  return true
}

/**
 * Render the full markdown document from extracted methods.
 */
export function renderApiDocs(
  methods: MethodInfo[],
  options: {
    readonly publicExports?: PublicExport[] | undefined
    readonly indexDescription?: string | undefined
    readonly entrypoints?: readonly PackageExportTarget[] | undefined
  } = {},
): string {
  const normalizedOptions = { __proto__: null, ...options }
  const {
    publicExports = [],
    indexDescription = '',
    entrypoints = [],
  } = normalizedOptions
  const sections = documentHeader(methods.length, indexDescription)
  const byName = new Map(methods.map(method => [method.name, method]))
  const groupedNames = new Set(GROUPS.flatMap(group => group.methods))
  const otherMethods = methods.filter(method => !groupedNames.has(method.name))
  appendContents(sections, { hasOtherMethods: otherMethods.length > 0 })
  appendMethodGroups(sections, byName, otherMethods)
  appendEntrypoints(sections, entrypoints)
  appendPublicExports(sections, publicExports)
  return normalizeDocument(sections.join('\n'))
}

function normalizeDocument(document: string): string {
  const output: string[] = []
  let previousWasBlank = false
  const lines = document.split(/\r?\n/)
  for (let i = 0, { length } = lines; i < length; i += 1) {
    const line = lines[i]
    if (line === undefined) {
      continue
    }
    const blank = line.length === 0
    if (blank && previousWasBlank) {
      continue
    }
    output.push(line)
    previousWasBlank = blank
  }
  while (output.at(-1) === '') {
    output.pop()
  }
  return `${output.join('\n')}\n`
}

function documentHeader(
  methodCount: number,
  indexDescription: string,
): string[] {
  const sections = [
    '<!--',
    '  AUTOGENERATED. Do not edit by hand.',
    '  Regenerate with: pnpm run docs:api',
    '  Source: scripts/repo/gen-api-docs.mts',
    '-->',
    '',
    '# API Reference',
    '',
    'Public SDK class methods, exported values, and types. For the runtime model (result shape, pagination, file uploads, escape hatches), see [SDK Concepts](./concepts.md). For quota planning, see [Quota Management](./quota-management.md).',
  ]
  if (indexDescription) {
    sections.push('', indexDescription)
  }
  sections.push('', `There are **${methodCount}** public methods.`, '')
  return sections
}

function appendContents(
  sections: string[],
  options: { readonly hasOtherMethods: boolean },
): void {
  const safeOptions = { __proto__: null, ...options }
  sections.push('## Contents', '')
  for (const group of GROUPS) {
    const anchor = group.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    sections.push(`- [${group.title}](#${anchor})`)
  }
  if (safeOptions.hasOtherMethods) {
    sections.push('- [Other](#other)')
  }
  sections.push(
    '- [Package entrypoints](#package-entrypoints)',
    '- [Exported symbols](#exported-symbols)',
    '',
  )
}

function appendMethodGroups(
  sections: string[],
  byName: ReadonlyMap<string, MethodInfo>,
  otherMethods: readonly MethodInfo[],
): void {
  for (const group of GROUPS) {
    sections.push(`## ${group.title}`, '', group.description, '')
    for (const name of group.methods) {
      const method = byName.get(name)
      if (method) {
        sections.push(renderMethod(method))
      }
    }
  }
  if (otherMethods.length > 0) {
    sections.push(
      '## Other',
      '',
      'Methods not yet placed into a domain group. Add them to `GROUPS` in `scripts/repo/api-doc/groups.mts`.',
      '',
    )
    for (const method of otherMethods) {
      sections.push(renderMethod(method))
    }
  }
}

function appendEntrypoints(
  sections: string[],
  entrypoints: readonly PackageExportTarget[],
): void {
  sections.push(
    '## Package entrypoints',
    '',
    'Public import paths from `package.json`. The package metadata path exposes package metadata rather than callable SDK API.',
    '',
    '| Import path | Target |',
    '| --- | --- |',
  )
  for (const entry of entrypoints) {
    const target = entry.target ?? '`package.json` (metadata)'
    sections.push(`| \`${entry.subpath}\` | ${target} |`)
  }
  sections.push('')
}

function appendPublicExports(
  sections: string[],
  publicExports: readonly PublicExport[],
): void {
  sections.push(
    '## Exported symbols',
    '',
    'Each symbol is scoped to its package import path. Callable helpers and authored types include available signatures and JSDoc. Generated OpenAPI types link to their canonical declarations.',
    '',
  )
  let currentSubpath = ''
  let subpathIsOpen = false
  for (const item of publicExports) {
    if (currentSubpath !== item.subpath) {
      if (subpathIsOpen) {
        sections.push('</details>', '')
      }
      currentSubpath = item.subpath
      sections.push(
        `### \`${currentSubpath}\``,
        '',
        '<details>',
        '<summary>Public exports</summary>',
        '',
      )
      subpathIsOpen = true
    }
    appendPublicExport(sections, item)
  }
  if (subpathIsOpen) {
    sections.push('</details>', '')
  }
  sections.push('')
}

function appendPublicExport(sections: string[], item: PublicExport): void {
  const local =
    item.packagePath.startsWith('src/') || item.packagePath.startsWith('types/')
  const sourceLink = local
    ? `[${item.packagePath}](../${item.packagePath}#L${item.line})`
    : `external package \`${item.packagePath}\``
  sections.push(`#### \`${item.name}\` (${item.kind})`, '')
  if (item.description) {
    sections.push(item.description, '')
  }
  if (item.example) {
    sections.push(
      'Example:',
      '',
      '```typescript',
      item.example.trim(),
      '```',
      '',
    )
  }
  if (item.name === 'SocketSdk') {
    sections.push(
      'Construct with `new SocketSdk(apiToken, options?)`; see [SDK Concepts](./concepts.md) for authentication and configuration.',
    )
  } else if (
    item.packagePath === 'types/api-v1.d.ts' ||
    item.packagePath === 'types/api.d.ts'
  ) {
    sections.push(`Canonical generated API declaration: ${sourceLink}.`)
  } else {
    sections.push(`Declared in ${sourceLink}.`, '')
    if (item.signature) {
      sections.push('```typescript', item.signature, '```')
    }
  }
  sections.push('')
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
