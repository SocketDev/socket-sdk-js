/**
 * @file AST-walking helpers for the strict-type codegen pipeline. Houses the
 *   acorn + acorn-typescript parsing utilities, the type-property extractors,
 *   and the type-definition string builders consumed by
 *   scripts/repo/generate-strict-types.mts.
 */
import { tsPlugin } from '@sveltejs/acorn-typescript'
import { Parser } from 'acorn'

import {
  renderOptionalTypeMembers,
  typeIncludesUndefined,
} from './generate-optional-types.mts'

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
  typeArguments?: { params?: AstNode[] | undefined } | undefined
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
      const typeStr = renderStrictPropertyType(
        member.typeAnnotation?.typeAnnotation,
        source,
        { required: isRequired, override: typeOverrides[name] },
      )

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

export function renderStrictPropertyType(
  node: AstNode | undefined,
  source: string,
  options: { required: boolean; override?: string | undefined },
): string {
  const { required, override } = {
    __proto__: null,
    ...options,
  } as typeof options
  const typeString = override || typeNodeToString(node, source)
  if (required) {
    return typeString
  }
  let annotation = node
  if (override) {
    const ast = parseTypeScript(`type Generated = ${override}`)
    annotation = Array.isArray(ast.body)
      ? ast.body[0]?.typeAnnotation
      : undefined
  }
  if (annotation && typeIncludesUndefined(annotation)) {
    return typeString
  }
  const needsParens =
    annotation?.type === 'TSFunctionType' ||
    annotation?.type === 'TSConstructorType'
  return `${needsParens ? `(${typeString})` : typeString} | undefined`
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
  const queryType = findPropertyTypePath(operationsNode, [
    operationId,
    'parameters',
    'query',
  ])
  if (!queryType) {
    return undefined
  }
  const properties = extractProperties(queryType, source, {
    ...config,
    requiredFields: config.requiredParams,
    typeOverrides: undefined,
  })

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
  const responseType = findPropertyTypePath(operationsNode, [
    operationId,
    'responses',
    responseCode,
    'content',
    'application/json',
  ])
  const targetType = responseType && navigateToPath(responseType, sourcePath)
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
  let current = unwrapType(node)
  for (let i = 0, { length } = nodePath; i < length; i += 1) {
    const segment = nodePath[i]!
    if (!current) {
      return undefined
    }
    current = navigateTypeSegment(current, segment)
  }
  return current
}

export function findPropertyTypePath(
  node: AstNode,
  nodePath: Array<string | number>,
): AstNode | undefined {
  let current: AstNode | undefined = node
  for (let i = 0, { length } = nodePath; i < length; i += 1) {
    const segment = nodePath[i]!
    current =
      current && findProperty(current, segment)?.typeAnnotation?.typeAnnotation
  }
  return current
}

export function recordValueType(node: AstNode): AstNode | undefined {
  if (node.type === 'TSTypeReference') {
    return node.typeArguments?.params?.[1]
  }
  if (node.type === 'TSTypeLiteral') {
    const indexSignature = node.members?.find(
      member => member.type === 'TSIndexSignature',
    )
    return indexSignature?.typeAnnotation?.typeAnnotation
  }
  return undefined
}

export function navigateTypeSegment(
  node: AstNode,
  segment: string,
): AstNode | undefined {
  if (segment === 'Array' && node.type === 'TSArrayType') {
    return unwrapType(node.elementType)
  }
  if (
    segment === 'value' ||
    (segment === 'items' && node.type === 'TSTypeLiteral')
  ) {
    return node
  }
  if (segment === 'Record') {
    const valueType = recordValueType(node)
    if (valueType) {
      return unwrapType(valueType)
    }
  }
  return unwrapType(findProperty(node, segment)?.typeAnnotation?.typeAnnotation)
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
  return renderOptionalTypeMembers(node, source)
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
