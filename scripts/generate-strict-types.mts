/**
 * @file Generates strict TypeScript types from OpenAPI schema using AST. Uses
 *   openapi-typescript to generate types, then acorn + acorn-typescript to
 *   parse and transform them into strict versions with required fields properly
 *   marked.
 */
// oxlint-disable-next-line socket/prefer-async-spawn -- single one-shot oxfmt invocation; sync API keeps this codegen pipeline strictly serial.
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import openapiTS from 'openapi-typescript'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

import {
  generateTypeDefinition,
  generateWrapperTypes,
} from './generate-strict-types-emit.mts'
import {
  extractQueryParams,
  extractResponseType,
  findExportByName,
  parseTypeScript,
} from './generate-strict-types-lib.mts'
import { getRootPath } from './utils/path-helpers.mts'

import type { StrictTypeConfig } from './generate-strict-types-emit.mts'
import type { AstNode } from './generate-strict-types-lib.mts'

const logger = getDefaultLogger()
const rootPath = getRootPath(import.meta.url)
const openApiPath = path.resolve(rootPath, 'openapi.json')
const strictTypesPath = path.resolve(rootPath, 'src/types-strict.mts')

/**
 * Configuration for strict type generation. Maps OpenAPI operations to strict
 * type definitions.
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
}

/**
 * Update index.mts to export all generated types.
 */
export async function updateIndexExports(): Promise<void> {
  const indexPath = path.resolve(rootPath, 'src/index.mts')
  const indexContent = await fs.readFile(indexPath, 'utf8')

  // Extract type names from generated types
  const typeNames: string[] = []
  const configs = Object.values(STRICT_TYPE_CONFIG)
  for (let i = 0, { length } = configs; i < length; i += 1) {
    typeNames.push(configs[i]!.typeName)
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
    logger.log('Generating strict types from OpenAPI schema using AST…')

    // Step 1: Generate TypeScript using openapi-typescript
    logger.log('  Running openapi-typescript…')
    const generatedTS = await openapiTS(openApiPath, {
      transform(schemaObject) {
        if ('format' in schemaObject && schemaObject['format'] === 'binary') {
          return 'never'
        }
        return undefined
      },
    })

    // Step 2: Parse the generated TypeScript with acorn
    logger.log('  Parsing generated TypeScript with acorn…')
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

    const configEntries = Object.entries(STRICT_TYPE_CONFIG)
    for (let i = 0, { length } = configEntries; i < length; i += 1) {
      const entry = configEntries[i]!
      const key = entry[0]
      const config = entry[1]
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

    // Apply autofixable lint rules first: the OpenAPI source emits nested
    // optional properties as `type?: 'x'`, but socket/optional-explicit-undefined
    // requires `type?: 'x' | undefined`. The fix is deterministic, so run it
    // before formatting so regeneration stays lint-clean.
    logger.log('  Applying lint autofixes…')
    const lintResult = spawnSync(
      'node_modules/.bin/oxlint',
      ['-c', '.config/fleet/oxlintrc.json', '--fix', strictTypesPath],
      { cwd: rootPath, encoding: 'utf8' },
    )
    if (lintResult.error) {
      logger.log(
        '  Warning: Could not apply lint autofixes:',
        lintResult.error.message,
      )
    }

    logger.log('  Formatting generated files…')
    const formatResult = spawnSync(
      'node_modules/.bin/oxfmt',
      ['-c', '.config/fleet/oxfmtrc.json', strictTypesPath],
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

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
