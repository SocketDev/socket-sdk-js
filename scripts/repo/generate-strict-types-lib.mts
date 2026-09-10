/**
 * @file AST-walking helpers for the strict-type codegen pipeline. Houses the
 *   acorn + acorn-typescript parsing utilities, the type-property extractors,
 *   and the type-definition string builders consumed by
 *   scripts/repo/generate-strict-types.mts.
 */
import { tsPlugin } from '@sveltejs/acorn-typescript'
import { Parser } from 'acorn'

import type {
  StrictTypeConfig,
  TypeProperty,
} from './generate-strict-types-emit.mts'

// Create TypeScript-aware parser
const TSParser = Parser.extend(tsPlugin())

// Acorn AST nodes use a generic shape; we define a minimal recursive interface
// since acorn does not export typed AST node interfaces for TypeScript syntax.
export interface AstNode extends Record<string, unknown> {
  type?: string | undefined
  start?: number | null | undefined
  end?: number | null | undefined
  key?:
    | { name?: string | undefined; value?: string | number | undefined }
    | undefined
  body?: AstNode[] | AstNode | undefined
  members?: AstNode[] | undefined
  typeAnnotation?: AstNode | undefined
  typeParameters?: { params?: AstNode[] | undefined } | undefined
  elementType?: AstNode | undefined
  id?: { name?: string | undefined } | undefined
  declaration?: AstNode | undefined
}

/**
 * Extract properties from a type literal node.
 */
export function extractProperties(
  node: AstNode,
  source: string,
  config: StrictTypeConfig,
): TypeProperty[] {
  const properties: TypeProperty[] = []
  const bodyProp = node.body
  const innerBody =
    bodyProp && !Array.isArray(bodyProp) ? bodyProp.body : undefined
  const members: AstNode[] =
    node.members || (Array.isArray(innerBody) ? innerBody : [])
  const requiredFields = new Set(config.requiredFields || [])
  const typeOverrides = config.typeOverrides || {}

  for (let i = 0, { length } = members; i < length; i += 1) {
    const member = members[i]!
    if (member.type === 'TSPropertySignature' && member.key?.name) {
      const name = member.key.name
      const isRequired = requiredFields.has(name)
      let typeStr =
        typeOverrides[name] ||
        typeNodeToString(member.typeAnnotation?.typeAnnotation, source)

      // Add | undefined for optional fields
      if (!isRequired && !typeStr.includes('| undefined')) {
        typeStr = `${typeStr} | undefined`
      }

      properties.push({
        name,
        optional: !isRequired,
        type: typeStr,
      })
    }
  }

  // Sort properties alphabetically
  properties.sort((a, b) => a.name.localeCompare(b.name))
  return properties
}

/**
 * Extract query parameters from operation.
 */
export function extractQueryParams(
  operationsNode: AstNode,
  operationId: string,
  source: string,
  config: StrictTypeConfig,
): TypeProperty[] | undefined {
  const paramsType = findPropertyTypePath(operationsNode, [
    operationId,
    'parameters',
  ])
  if (!paramsType) {
    return undefined
  }
  const queryProp = findProperty(paramsType, 'query')
  if (!queryProp) {
    return undefined
  }

  const queryType = queryProp.typeAnnotation?.typeAnnotation
  const properties: TypeProperty[] = []
  const members: AstNode[] = queryType?.members || []
  const requiredParams = new Set(config.requiredParams || [])

  for (let i = 0, { length } = members; i < length; i += 1) {
    const member = members[i]!
    if (member.type === 'TSPropertySignature' && member.key?.name) {
      const name = member.key.name
      const isRequired = requiredParams.has(name)
      let typeStr = typeNodeToString(
        member.typeAnnotation?.typeAnnotation,
        source,
      )
      // Add | undefined for optional params only
      if (!isRequired && !typeStr.includes('| undefined')) {
        typeStr = `${typeStr} | undefined`
      }
      properties.push({
        name,
        optional: !isRequired,
        type: typeStr,
      })
    }
  }

  appendAdditionalProperties(properties, config)

  // Sort properties alphabetically
  properties.sort((a, b) => a.name.localeCompare(b.name))
  return properties
}

/**
 * Extract response type from operation.
 */
export function extractResponseType(
  operationsNode: AstNode,
  operationId: string,
  responseCode: number | undefined,
  sourcePath: string[],
  source: string,
  config: StrictTypeConfig,
): TypeProperty[] | undefined {
  if (responseCode === undefined) {
    return undefined
  }
  let targetType = findPropertyTypePath(operationsNode, [
    operationId,
    'responses',
    responseCode,
    'content',
    'application/json',
  ])

  // Navigate to nested path if specified
  if (targetType && sourcePath && sourcePath.length > 0) {
    targetType = navigateToPath(targetType, sourcePath)
  }

  if (!targetType) {
    return undefined
  }

  return extractProperties(targetType, source, config)
}

/**
 * Find an export declaration by name in the AST.
 */
export function findExportByName(
  ast: AstNode,
  name: string,
): AstNode | undefined {
  const body = (ast.body || []) as AstNode[]
  for (let i = 0, { length } = body; i < length; i += 1) {
    const node = body[i]!
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration?.type === 'TSInterfaceDeclaration' &&
      node.declaration.id?.name === name
    ) {
      return node.declaration
    }
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration?.type === 'TSTypeAliasDeclaration' &&
      node.declaration.id?.name === name
    ) {
      return node.declaration
    }
  }
  return undefined
}

/**
 * Find a property in a type literal or interface body.
 */
export function findProperty(
  node: AstNode,
  propName: string | number,
): AstNode | undefined {
  // TSInterfaceBody has .body array, TSTypeLiteral has .members array
  const members: AstNode[] =
    (Array.isArray(node.body) ? node.body : node.members) || []
  for (let i = 0, { length } = members; i < length; i += 1) {
    const member = members[i]!
    if (member.type === 'TSPropertySignature') {
      // Key can be Identifier (name) or Literal (value for numbers/strings)
      const keyName = member.key?.name ?? member.key?.value
      if (keyName === propName) {
        return member
      }
    }
  }
  return undefined
}

/**
 * Navigate to a nested type following a path.
 */
export function navigateToPath(
  node: AstNode,
  nodePath: string[],
): AstNode | undefined {
  let current: AstNode | undefined = unwrapType(node)
  for (let i = 0, { length } = nodePath; i < length; i += 1) {
    const segment = nodePath[i]!
    if (!current) {
      return undefined
    }
    current = unwrapType(current)
    if (!current) {
      return undefined
    }

    current = navigateTypeSegment(current, segment)
  }
  return current
}

function appendAdditionalProperties(
  properties: TypeProperty[],
  config: StrictTypeConfig,
): void {
  // Add additional fields from config
  if (config.additionalFields) {
    const additional = config.additionalFields
    for (let i = 0, { length } = additional; i < length; i += 1) {
      const field = additional[i]!
      properties.push({
        name: field.name,
        optional: field.optional !== false,
        type: field.type,
      })
    }
  }
}

function findRecordValueType(current: AstNode): AstNode | undefined {
  if (current.type === 'TSTypeReference') {
    // For Record<string, T>, get T
    if (current.typeParameters?.params?.[1]) {
      return current.typeParameters.params[1]
    }
  }
  if (current.type === 'TSTypeLiteral') {
    // For { [key: string]: T }, get T via index signature
    const indexSig = current.members?.find(m => m.type === 'TSIndexSignature')
    if (indexSig?.typeAnnotation?.typeAnnotation) {
      return indexSig.typeAnnotation.typeAnnotation
    }
  }
  return undefined
}

function navigateTypeSegment(
  current: AstNode,
  segment: string,
): AstNode | undefined {
  if (segment === 'Array' && current.type === 'TSArrayType') {
    return unwrapType(current.elementType)
  }
  if (segment === 'items' && current.type === 'TSTypeLiteral') {
    // Already at the array element type
    return current
  }
  if (segment === 'Record') {
    const valueType = findRecordValueType(current)
    if (valueType) {
      return unwrapType(valueType)
    }
  }
  if (segment === 'value') {
    // Already navigated via Record
    return current
  }

  // Navigate to property
  const prop = findProperty(current, segment)
  if (prop?.typeAnnotation?.typeAnnotation) {
    return unwrapType(prop.typeAnnotation.typeAnnotation)
  } else {
    return undefined
  }
}

function findPropertyTypePath(
  node: AstNode,
  segments: Array<string | number>,
): AstNode | undefined {
  let current: AstNode | undefined = node
  for (let i = 0, { length } = segments; i < length; i += 1) {
    const segment = segments[i]!
    if (!current) {
      return undefined
    }
    current = findProperty(current, segment)?.typeAnnotation?.typeAnnotation
  }
  return current
}

/**
 * Parse TypeScript source into AST.
 */
export function parseTypeScript(source: string): AstNode {
  return TSParser.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
  }) as unknown as AstNode
}

/**
 * Convert AST type node to TypeScript string.
 */
export function typeNodeToString(
  node: AstNode | undefined,
  source: string,
): string {
  if (!node) {
    return 'unknown'
  }
  return source.slice(node.start!, node.end!)
}

/**
 * Unwrap parenthesized types to get the inner type.
 */
export function unwrapType(node: AstNode | undefined): AstNode | undefined {
  if (!node) {
    return undefined
  }
  // Unwrap parenthesized types: (T) -> T
  if (node.type === 'TSParenthesizedType') {
    return unwrapType(node.typeAnnotation)
  }
  return node
}
