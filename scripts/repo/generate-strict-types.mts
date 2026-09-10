/**
 * @file Generates strict TypeScript types from OpenAPI schema using AST. Uses
 *   openapi-typescript to generate types, then acorn + acorn-typescript to
 *   parse and transform them into strict versions with required fields properly
 *   marked.
 */
// The sync API keeps the generation and validation stages serial.
// oxlint-disable-next-line socket/prefer-async-spawn -- serial codegen
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import openapiTS from 'openapi-typescript'

import { findUpSync } from '@socketsecurity/lib-stable/fs/find'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

import {
  generateTypeDefinition,
  generateWrapperTypes,
  wrapperTypeNames,
} from './generate-strict-types-emit.mts'
import {
  extractQueryParams,
  extractResponseType,
  findExportByName,
  parseTypeScript,
} from './generate-strict-types-lib.mts'

import type { StrictTypeConfig } from './generate-strict-types-emit.mts'
import type { AstNode } from './generate-strict-types-lib.mts'
import { isMainModule } from '../fleet/process/is-main-module.mts'
import { runMain } from '../fleet/process/run-main.mts'

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
const openApiPath = path.resolve(rootPath, 'openapi.json')
const strictTypesPath = path.resolve(rootPath, 'src/types/strict.mts')
const indexExportsPath = path.resolve(rootPath, 'src/index.mts')

/**
 * Configuration for strict type generation. Maps OpenAPI operations to strict
 * type definitions.
 */
const STRICT_TYPE_CONFIG: Record<ApiMethodName, StrictTypeConfig> = {
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
export async function updateIndexExports(
  options: { indexPath?: string | undefined } = {},
): Promise<void> {
  const indexPath = options.indexPath ?? indexExportsPath
  const indexContent = await fs.readFile(indexPath, 'utf8')

  // Extract type names from generated types
  const typeNames: string[] = []
  const configs = Object.values(STRICT_TYPE_CONFIG)
  for (let i = 0, { length } = configs; i < length; i += 1) {
    typeNames.push(configs[i]!.typeName)
  }

  // Also add wrapper types — derived from the emit template so a wrapper
  // added or renamed there can never silently miss its index export.
  typeNames.push(...wrapperTypeNames())

  // Sort alphabetically
  typeNames.sort()

  // Match the generated strict-type export block.
  const importRegex = /export type \{[^}]*\} from '\.\/types\/strict\.mts'/s
  const match = indexContent.match(importRegex)

  if (!match) {
    throw new Error('Missing strict-type export block in src/index.mts')
  }

  // Build new export statement
  const newExport = `export type {\n  ${typeNames.join(',\n  ')},\n} from './types/strict.mts'`

  // Replace the old export
  const newIndexContent = indexContent.replace(importRegex, () => newExport)

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
 * Generated by: scripts/repo/generate-strict-types.mts
 */
/* c8 ignore start - Type definitions only, no runtime code to test. */

import type { OrganizationSlug } from './keys.mts'

${generatedTypes.join('\n\n')}
${generateWrapperTypes()}
/* c8 ignore stop */
`

    // Step 6: Write the output file
    await fs.writeFile(strictTypesPath, output, 'utf8')
    logger.log(`  Written to ${strictTypesPath}`)

    // Update index.mts exports.
    await updateIndexExports()

    // Apply autofixable lint rules first: the OpenAPI source emits nested
    // optional properties as `type?: 'x'`, but socket/optional-explicit-undefined
    // requires `type?: 'x' | undefined`. The fix is deterministic, so run it
    // before formatting so regeneration stays lint-clean.
    logger.log('  Applying lint autofixes…')
    logger.substep('Fixing + formatting generated files…')
    const generatedPaths = [strictTypesPath, indexExportsPath]
    const validationCommands = [
      ['run', 'lint', '--fix', ...generatedPaths],
      ['run', 'format', ...generatedPaths],
      ['run', 'lint', ...generatedPaths],
    ]
    for (let i = 0, { length } = validationCommands; i < length; i += 1) {
      const args = validationCommands[i]!
      const fixResult = spawnSync('pnpm', args, {
        cwd: rootPath,
        stdio: 'inherit',
      })
      if (fixResult.error || fixResult.status !== 0) {
        throw new Error(
          `pnpm ${args.join(' ')} failed (${fixResult.error?.message ?? `exit ${fixResult.status}`}) — repair the generator output, do not hand-format.`,
        )
      }
    }

    logger.log('Strict type generation complete')
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    logger.error('Strict type generation failed:', error.message)
    logger.error(error.stack)
    process.exitCode = 1
  }
}

const SCRIPT_META = {
  describe: 'generate strict SDK operation types',
  help: `Usage: node scripts/repo/generate-strict-types.mts\n\n--help, -h  show usage\n--describe  show purpose`,
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
