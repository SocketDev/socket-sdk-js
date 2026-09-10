/**
 * @file Public SocketSdk method extraction from its TypeScript class syntax.
 */
import { parseTypeScript } from './generate-strict-types-lib.mts'

import type { AstNode } from './generate-strict-types-lib.mts'

export interface SdkMethodSource {
  name: string
  isGenerator: boolean
  signature: string
  summary: string
  operationId: string | undefined
  hadOperationIdNone: boolean
  jsdocQuota: number | undefined
}

export function extractSdkClassMethods(source: string): SdkMethodSource[] {
  const ast = parseTypeScript(source)
  const statements = Array.isArray(ast.body) ? ast.body : []
  const methods: SdkMethodSource[] = []
  for (const statement of statements) {
    const declaration = statement.declaration ?? statement
    if (
      declaration.type !== 'ClassDeclaration' ||
      declaration.id?.name !== 'SocketSdk'
    ) {
      continue
    }
    const body = declaration.body
    const members =
      body && !Array.isArray(body) && Array.isArray(body.body) ? body.body : []
    for (const member of members) {
      const method = extractSdkMethod(member, source)
      if (method) {
        methods.push(method)
      }
    }
  }
  return methods
}

export function extractSdkMethod(
  member: AstNode,
  source: string,
): SdkMethodSource | undefined {
  if (!isPublicSdkMethod(member)) {
    return undefined
  }
  const key = member.key as AstNode | undefined
  const name = key?.['name']
  const value = member['value'] as AstNode | undefined
  const body = value?.body
  if (
    typeof name !== 'string' ||
    typeof member.start !== 'number' ||
    typeof member.end !== 'number' ||
    !body ||
    Array.isArray(body) ||
    typeof body.start !== 'number'
  ) {
    return undefined
  }
  const signature = source
    .slice(member.start, body.start)
    .trimEnd()
    .split(/\r?\n/)
    .map((line, index) => (index ? line.replace(/^ {2}/, '') : line))
    .join('\n')
  const jsdoc = readSdkMethodJsdoc(source, member.start)
  return {
    ...readSdkMethodMetadata(jsdoc, source.slice(member.start, member.end)),
    name,
    isGenerator:
      value?.['generator'] === true || signature.includes('AsyncGenerator<'),
    signature,
  }
}

export function isPublicSdkMethod(member: AstNode): boolean {
  const key = member.key as AstNode | undefined
  return (
    member.type === 'MethodDefinition' &&
    member['kind'] === 'method' &&
    !member['computed'] &&
    key?.type !== 'PrivateIdentifier' &&
    member['accessibility'] !== 'private' &&
    member['accessibility'] !== 'protected'
  )
}

export function readSdkMethodMetadata(
  jsdoc: string,
  body: string,
): Pick<
  SdkMethodSource,
  'summary' | 'operationId' | 'hadOperationIdNone' | 'jsdocQuota'
> {
  const operationTag = jsdoc.match(/@operationId\s+(?<operationId>\S+)/)
    ?.groups?.['operationId']
  const hadOperationIdNone = operationTag === 'none'
  const generic = body.match(
    /<['"](?<operationId>[a-zA-Z][a-zA-Z0-9_-]*)['"][,>]/,
  )?.groups?.['operationId']
  const quota = jsdoc.match(/@quota\s+(?<quota>\d+)\s*units?/)?.groups?.[
    'quota'
  ]
  const summary =
    jsdoc
      .replace(/^\/\*\*|\*\/$/g, '')
      .split(/\r?\n/)
      .map(line => line.replace(/^\s*\*\s?/, '').trim())
      .find(line => line && !line.startsWith('@')) ?? ''
  return {
    summary,
    operationId: hadOperationIdNone ? undefined : (operationTag ?? generic),
    hadOperationIdNone,
    jsdocQuota: quota === undefined ? undefined : Number(quota),
  }
}

export function readSdkMethodJsdoc(
  source: string,
  methodStart: number,
): string {
  const prefix = source.slice(0, methodStart)
  const end = prefix.lastIndexOf('*/')
  if (end < 0 || prefix.slice(end + 2).trim()) {
    return ''
  }
  const start = prefix.lastIndexOf('/**', end)
  return start < 0 || prefix.indexOf('*/', start) !== end
    ? ''
    : prefix.slice(start, end + 2)
}
