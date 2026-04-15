/**
 * @fileoverview Generates strict TypeScript types from OpenAPI schema using AST.
 * Uses openapi-typescript to generate types, then acorn + acorn-typescript to
 * parse and transform them into strict versions with required fields properly marked.
 */
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { tsPlugin } from '@sveltejs/acorn-typescript'
import { Parser } from 'acorn'
import openapiTS from 'openapi-typescript'

import { getDefaultLogger } from '@socketsecurity/lib/logger'

import { getRootPath } from './utils/path-helpers.mts'

const logger = getDefaultLogger()
const rootPath = getRootPath(import.meta.url)
const openApiPath = path.resolve(rootPath, 'openapi.json')
const strictTypesPath = path.resolve(rootPath, 'src/types-strict.ts')

// Create TypeScript-aware parser
const TSParser = Parser.extend(tsPlugin())

/**
 * Configuration for strict type generation.
 * Maps OpenAPI operations to strict type definitions.
 */
const STRICT_TYPE_CONFIG: Record<string, StrictTypeConfig> = {
  // Create Full Scan Options - from CreateOrgFullScan query params
  createFullScanOptions: {
    operationId: 'CreateOrgFullScan',
    extractType: 'queryParams',
    typeName: 'CreateFullScanOptions',
    requiredParams: ['repo'],
    additionalFields: [
      { name: 'pathsRelativeTo', type: 'string | undefined', optional: true },
    ],
  },

  // Full Scan Item - from getOrgFullScanList results array
  fullScanItem: {
    operationId: 'getOrgFullScanList',
    responseCode: 200,
    typeName: 'FullScanItem',
    sourcePath: ['results', 'Array', 'items'],
    requiredFields: [
      'api_url',
      'created_at',
      'html_report_url',
      'id',
      'integration_repo_url',
      'integration_type',
      'organization_id',
      'organization_slug',
      'repo',
      'repository_id',
      'repository_slug',
      'updated_at',
    ],
  },

  // Full Scan List Data - wrapper for list response
  fullScanListData: {
    operationId: 'getOrgFullScanList',
    responseCode: 200,
    typeName: 'FullScanListData',
    sourcePath: [],
    requiredFields: ['results'],
    typeOverrides: {
      results: 'FullScanItem[]',
    },
  },

  // Get Repository Options - from getOrgRepo query params
  getRepositoryOptions: {
    operationId: 'getOrgRepo',
    extractType: 'queryParams',
    typeName: 'GetRepositoryOptions',
  },

  // List Full Scans Options - from getOrgFullScanList query params
  listFullScansOptions: {
    operationId: 'getOrgFullScanList',
    extractType: 'queryParams',
    typeName: 'ListFullScansOptions',
  },

  // List Repositories Options - from getOrgRepoList query params
  listRepositoriesOptions: {
    operationId: 'getOrgRepoList',
    extractType: 'queryParams',
    typeName: 'ListRepositoriesOptions',
  },

  // Organization Item - from getOrganizations response
  organizationItem: {
    operationId: 'getOrganizations',
    responseCode: 200,
    typeName: 'OrganizationItem',
    sourcePath: ['organizations', 'Record', 'value'],
    requiredFields: ['created_at', 'id', 'plan', 'slug', 'updated_at'],
  },

  // Repositories List Data - wrapper for list response
  repositoriesListData: {
    operationId: 'getOrgRepoList',
    responseCode: 200,
    typeName: 'RepositoriesListData',
    sourcePath: [],
    requiredFields: ['results'],
    typeOverrides: {
      results: 'RepositoryListItem[]',
    },
  },

  // Repository List Item - from getOrgRepoList results array
  repositoryListItem: {
    operationId: 'getOrgRepoList',
    responseCode: 200,
    typeName: 'RepositoryListItem',
    sourcePath: ['results', 'Array', 'items'],
    requiredFields: [
      'archived',
      'created_at',
      'default_branch',
      'description',
      'head_full_scan_id',
      'homepage',
      'id',
      'name',
      'slug',
      'updated_at',
      'visibility',
      'workspace',
    ],
  },

  // Repository Item - from getOrgRepo response
  repositoryItem: {
    operationId: 'getOrgRepo',
    responseCode: 200,
    typeName: 'RepositoryItem',
    sourcePath: [],
    requiredFields: [
      'archived',
      'created_at',
      'default_branch',
      'description',
      'head_full_scan_id',
      'homepage',
      'id',
      'integration_meta',
      'name',
      'slig',
      'slug',
      'updated_at',
      'visibility',
      'workspace',
    ],
  },

  // Repository Label Item - from getOrgRepoLabel response
  repositoryLabelItem: {
    operationId: 'getOrgRepoLabel',
    responseCode: 200,
    typeName: 'RepositoryLabelItem',
    sourcePath: [],
    requiredFields: ['id', 'name'],
  },

  // Repository Labels List Data - wrapper for list response
  repositoryLabelsListData: {
    operationId: 'getOrgRepoLabelList',
    responseCode: 200,
    typeName: 'RepositoryLabelsListData',
    sourcePath: [],
    requiredFields: ['results'],
    typeOverrides: {
      results: 'RepositoryLabelItem[]',
    },
  },
}

// Acorn AST nodes use a generic shape; we define a minimal recursive interface
// since acorn does not export typed AST node interfaces for TypeScript syntax.
interface AstNode extends Record<string, unknown> {
  type?: string
  start?: number | null
  end?: number | null
  key?: { name?: string; value?: string | number }
  body?: AstNode[] | AstNode
  members?: AstNode[]
  typeAnnotation?: AstNode
  typeParameters?: { params?: AstNode[] }
  elementType?: AstNode
  id?: { name?: string }
  declaration?: AstNode
}

interface TypeProperty {
  name: string
  optional: boolean
  type: string
}

interface StrictTypeConfig {
  operationId: string
  extractType?: string
  responseCode?: number
  typeName: string
  sourcePath?: string[]
  requiredFields?: string[]
  requiredParams?: string[]
  typeOverrides?: Record<string, string>
  additionalFields?: Array<{ name: string; type: string; optional?: boolean }>
}

/**
 * Extract properties from a type literal node.
 */
function extractProperties(
  node: AstNode,
  source: string,
  config: StrictTypeConfig,
): TypeProperty[] {
  const properties: TypeProperty[] = []
  const bodyProp = node.body
  const innerBody =
    bodyProp && !Array.isArray(bodyProp)
      ? (bodyProp as AstNode).body
      : undefined
  const members: AstNode[] = (node.members ||
    (Array.isArray(innerBody) ? innerBody : [])) as AstNode[]
  const requiredFields = new Set(config.requiredFields || [])
  const typeOverrides = config.typeOverrides || {}

  for (const member of members) {
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
function extractQueryParams(
  operationsNode: AstNode,
  operationId: string,
  source: string,
  config: StrictTypeConfig,
): TypeProperty[] | undefined {
  const opProp = findProperty(operationsNode, operationId)
  if (!opProp) {
    return undefined
  }

  const opType = opProp.typeAnnotation?.typeAnnotation
  if (!opType) {
    return undefined
  }
  const paramsProp = findProperty(opType, 'parameters')
  if (!paramsProp) {
    return undefined
  }

  const paramsType = paramsProp.typeAnnotation?.typeAnnotation
  if (!paramsType) {
    return undefined
  }
  const queryProp = findProperty(paramsType, 'query')
  if (!queryProp) {
    return undefined
  }

  const queryType = queryProp.typeAnnotation?.typeAnnotation
  const properties: TypeProperty[] = []
  const members: AstNode[] = (queryType?.members || []) as AstNode[]
  const requiredParams = new Set(config.requiredParams || [])

  for (const member of members) {
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

  // Add additional fields from config
  if (config.additionalFields) {
    for (const field of config.additionalFields) {
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
function extractResponseType(
  operationsNode: AstNode,
  operationId: string,
  responseCode: number | undefined,
  sourcePath: string[],
  source: string,
  config: StrictTypeConfig,
): TypeProperty[] | undefined {
  const opProp = findProperty(operationsNode, operationId)
  if (!opProp) {
    return undefined
  }

  const opType = opProp.typeAnnotation?.typeAnnotation
  if (!opType) {
    return undefined
  }
  const responsesProp = findProperty(opType, 'responses')
  if (!responsesProp) {
    return undefined
  }

  const responsesType = responsesProp.typeAnnotation?.typeAnnotation
  if (!responsesType || responseCode === undefined) {
    return undefined
  }
  const codeProp = findProperty(responsesType, responseCode)
  if (!codeProp) {
    return undefined
  }

  const codeType = codeProp.typeAnnotation?.typeAnnotation
  if (!codeType) {
    return undefined
  }
  const contentProp = findProperty(codeType, 'content')
  if (!contentProp) {
    return undefined
  }

  const contentType = contentProp.typeAnnotation?.typeAnnotation
  if (!contentType) {
    return undefined
  }
  const jsonProp = findProperty(contentType, 'application/json')
  if (!jsonProp) {
    return undefined
  }

  let targetType = jsonProp.typeAnnotation?.typeAnnotation

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
function findExportByName(ast: AstNode, name: string): AstNode | undefined {
  for (const node of (ast.body || []) as AstNode[]) {
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
function findProperty(
  node: AstNode,
  propName: string | number,
): AstNode | undefined {
  // TSInterfaceBody has .body array, TSTypeLiteral has .members array
  const members: AstNode[] = ((Array.isArray(node.body)
    ? node.body
    : node.members) || []) as AstNode[]
  for (const member of members) {
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
 * Generate type definition string from properties.
 */
function generateTypeDefinition(
  typeName: string,
  properties: TypeProperty[],
  description: string,
): string {
  const lines: string[] = []
  lines.push('/**')
  lines.push(` * ${description}`)
  lines.push(' */')
  lines.push(`export type ${typeName} = {`)

  for (const prop of properties) {
    const opt = prop.optional ? '?' : ''
    lines.push(`  ${prop.name}${opt}: ${prop.type}`)
  }

  lines.push('}')
  return lines.join('\n')
}

/**
 * Generate wrapper result types.
 */
function generateWrapperTypes(): string {
  return `
/**
 * Error result type for all SDK operations.
 */
export type StrictErrorResult = {
  cause?: string | undefined
  data?: undefined | undefined
  error: string
  status: number
  success: false
}

/**
 * Generic strict result type combining success and error.
 */
export type StrictResult<T> =
  | {
      cause?: undefined | undefined
      data: T
      error?: undefined | undefined
      status: number
      success: true
    }
  | StrictErrorResult

/**
 * Strict type for full scan list result.
 */
export type FullScanListResult = {
  cause?: undefined | undefined
  data: FullScanListData
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for single full scan result.
 */
export type FullScanResult = {
  cause?: undefined | undefined
  data: FullScanItem
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Options for streaming a full scan.
 */
export type StreamFullScanOptions = {
  output?: boolean | string | undefined
}

/**
 * Strict type for organizations list result.
 */
export type OrganizationsResult = {
  cause?: undefined | undefined
  data: {
    organizations: OrganizationItem[]
  }
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for repositories list result.
 */
export type RepositoriesListResult = {
  cause?: undefined | undefined
  data: RepositoriesListData
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for delete operation result.
 */
export type DeleteResult = {
  cause?: undefined | undefined
  data: { success: boolean }
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for single repository result.
 */
export type RepositoryResult = {
  cause?: undefined | undefined
  data: RepositoryItem
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for repository labels list result.
 */
export type RepositoryLabelsListResult = {
  cause?: undefined | undefined
  data: RepositoryLabelsListData
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for single repository label result.
 */
export type RepositoryLabelResult = {
  cause?: undefined | undefined
  data: RepositoryLabelItem
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for delete repository label result.
 */
export type DeleteRepositoryLabelResult = {
  cause?: undefined | undefined
  data: { status: string }
  error?: undefined | undefined
  status: number
  success: true
}
`
}

/**
 * Update index.ts to export all generated types.
 */
async function updateIndexExports(): Promise<void> {
  const indexPath = path.resolve(rootPath, 'src/index.ts')
  const indexContent = await fs.readFile(indexPath, 'utf8')

  // Extract type names from generated types
  const typeNames: string[] = []
  for (const config of Object.values(STRICT_TYPE_CONFIG)) {
    typeNames.push(config.typeName)
  }

  // Also add wrapper types
  const wrapperTypes = [
    'DeleteRepositoryLabelResult',
    'DeleteResult',
    'FullScanListResult',
    'FullScanResult',
    'OrganizationsResult',
    'RepositoriesListResult',
    'RepositoryLabelResult',
    'RepositoryLabelsListResult',
    'RepositoryResult',
    'StrictErrorResult',
    'StrictResult',
    'StreamFullScanOptions',
  ]
  typeNames.push(...wrapperTypes)

  // Sort alphabetically
  typeNames.sort()

  // Find the types-strict import section
  const importRegex = /export type \{[^}]*\} from '\.\/types-strict'/s
  const match = indexContent.match(importRegex)

  if (!match) {
    logger.log('  Warning: Could not find types-strict export in index.ts')
    return
  }

  // Build new export statement
  const newExport = `export type {\n  ${typeNames.join(',\n  ')},\n} from './types-strict'`

  // Replace the old export
  const newIndexContent = indexContent.replace(importRegex, newExport)

  // Write back to file
  await fs.writeFile(indexPath, newIndexContent, 'utf8')
  logger.log(`  Updated ${indexPath} with ${typeNames.length} type exports`)
}

/**
 * Main generation function.
 */
async function main(): Promise<void> {
  try {
    logger.log('Generating strict types from OpenAPI schema using AST...')

    // Step 1: Generate TypeScript using openapi-typescript
    logger.log('  Running openapi-typescript...')
    const generatedTS = await openapiTS(openApiPath, {
      transform(schemaObject) {
        if ('format' in schemaObject && schemaObject['format'] === 'binary') {
          return 'never'
        }
        return undefined
      },
    })

    // Step 2: Parse the generated TypeScript with acorn
    logger.log('  Parsing generated TypeScript with acorn...')
    const ast = parseTypeScript(generatedTS)

    // Step 3: Find the operations interface
    const operationsDecl = findExportByName(ast, 'operations')
    if (!operationsDecl) {
      throw new Error('Could not find operations interface in generated types')
    }

    const operationsNode: AstNode = (operationsDecl.body ||
      operationsDecl.typeAnnotation) as AstNode

    // Step 4: Generate each configured type
    const generatedTypes: string[] = []

    for (const [key, config] of Object.entries(STRICT_TYPE_CONFIG)) {
      if (config.extractType === 'queryParams') {
        // Extract query parameters
        const properties = extractQueryParams(
          operationsNode,
          config.operationId,
          generatedTS,
          config,
        )

        if (!properties) {
          logger.log(`  Warning: Could not extract query params for ${key}`)
          continue
        }

        const description = `Options for ${config.typeName
          .replace(/Options$/, '')
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase()
          .trim()}.`

        const typeCode = generateTypeDefinition(
          config.typeName,
          properties,
          description,
        )
        generatedTypes.push(typeCode)
        logger.log(
          `  Generated ${config.typeName} with ${properties.length} params`,
        )
      } else {
        // Extract response type
        const properties = extractResponseType(
          operationsNode,
          config.operationId,
          config.responseCode,
          config.sourcePath || [],
          generatedTS,
          config,
        )

        if (!properties) {
          logger.log(`  Warning: Could not extract response type for ${key}`)
          continue
        }

        const description = `Strict type for ${config.typeName
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase()
          .trim()}.`

        const typeCode = generateTypeDefinition(
          config.typeName,
          properties,
          description,
        )
        generatedTypes.push(typeCode)
        logger.log(
          `  Generated ${config.typeName} with ${properties.length} fields`,
        )
      }
    }

    // Step 5: Build the output file
    const output = `/**
 * @fileoverview Strict type definitions for Socket SDK v3.
 * AUTO-GENERATED from OpenAPI definitions using AST parsing - DO NOT EDIT MANUALLY.
 * These types provide better TypeScript DX by marking guaranteed fields as required
 * and only keeping truly optional fields as optional.
 *
 * Generated by: scripts/generate-strict-types.mts
 */
/* c8 ignore start - Type definitions only, no runtime code to test. */

${generatedTypes.join('\n\n')}
${generateWrapperTypes()}
/* c8 ignore stop */
`

    // Step 6: Write the output file
    await fs.writeFile(strictTypesPath, output, 'utf8')
    logger.log(`  Written to ${strictTypesPath}`)

    // Step 7: Update index.ts exports
    await updateIndexExports()

    // Step 8: Format generated files with Biome
    logger.log('  Formatting generated files...')
    const formatResult = spawnSync(
      'npx',
      ['@biomejs/biome', 'format', '--write', strictTypesPath],
      { cwd: rootPath, encoding: 'utf8' },
    )
    if (formatResult.error) {
      logger.log(
        '  Warning: Could not format files:',
        formatResult.error.message,
      )
    }

    logger.log('Strict type generation complete')
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    logger.error('Strict type generation failed:', error.message)
    logger.error(error.stack)
    process.exitCode = 1
  }
}

/**
 * Navigate to a nested type following a path.
 */
function navigateToPath(node: AstNode, path: string[]): AstNode | undefined {
  let current: AstNode | undefined = unwrapType(node)
  for (const segment of path) {
    if (!current) {
      return undefined
    }
    current = unwrapType(current)
    if (!current) {
      return undefined
    }

    if (segment === 'Array' && current.type === 'TSArrayType') {
      current = unwrapType(current.elementType)
      continue
    }
    if (segment === 'items' && current.type === 'TSTypeLiteral') {
      // Already at the array element type
      continue
    }
    if (segment === 'Record' && current.type === 'TSTypeReference') {
      // For Record<string, T>, get T
      if (current.typeParameters?.params?.[1]) {
        current = unwrapType(current.typeParameters.params[1])
        continue
      }
    }
    if (segment === 'Record' && current.type === 'TSTypeLiteral') {
      // For { [key: string]: T }, get T via index signature
      const indexSig = current.members?.find(m => m.type === 'TSIndexSignature')
      if (indexSig?.typeAnnotation?.typeAnnotation) {
        current = unwrapType(indexSig.typeAnnotation.typeAnnotation)
        continue
      }
    }
    if (segment === 'value') {
      // Already navigated via Record
      continue
    }

    // Navigate to property
    const prop = findProperty(current, segment)
    if (prop?.typeAnnotation?.typeAnnotation) {
      current = unwrapType(prop.typeAnnotation.typeAnnotation)
    } else {
      return undefined
    }
  }
  return current
}

/**
 * Parse TypeScript source into AST.
 */
function parseTypeScript(source: string): AstNode {
  return TSParser.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
  }) as unknown as AstNode
}

/**
 * Convert AST type node to TypeScript string.
 */
function typeNodeToString(node: AstNode | undefined, source: string): string {
  if (!node) {
    return 'unknown'
  }
  return source.slice(node.start!, node.end!)
}

/**
 * Unwrap parenthesized types to get the inner type.
 */
function unwrapType(node: AstNode | undefined): AstNode | undefined {
  if (!node) {
    return undefined
  }
  // Unwrap parenthesized types: (T) -> T
  if (node.type === 'TSParenthesizedType') {
    return unwrapType(node.typeAnnotation)
  }
  return node
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
