/**
 * @file Renders strict Socket API types and their package exports.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderOpenApiDocumentTypes } from './generate-types.mts'

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
import { OPENAPI_INDEX_PATH } from './openapi-contracts.mts'

import type { OpenAPI3 } from 'openapi-typescript'
import type { StrictTypeConfig } from './generate-strict-types-emit.mts'
import type { AstNode } from './generate-strict-types-lib.mts'

type ApiMethodName = string

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

export function renderStrictIndexExports(indexContent: string): string {
  const typeNames = [
    ...Object.values(STRICT_TYPE_CONFIG).map(config => config.typeName),
    ...wrapperTypeNames(),
  ].toSorted()
  const importRegex =
    /export type \{[^}]*\} from ['"]\.\/types\/strict\.mts['"]/s
  if (!importRegex.test(indexContent)) {
    throw new Error(
      'Missing strict-type export block in src/index.mts. Restore the generated export block before generation.',
    )
  }
  const newExport = `export type {\n  ${typeNames.join(',\n  ')},\n} from './types/strict.mts'`
  return indexContent.replace(importRegex, () => newExport)
}

export async function updateIndexExports(
  options: { indexPath?: string | undefined } = {},
): Promise<void> {
  const indexPath =
    options.indexPath ??
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../..',
      OPENAPI_INDEX_PATH,
    )
  const content = renderStrictIndexExports(await readFile(indexPath, 'utf8'))
  await writeFile(indexPath, content, 'utf8')
}

function renderStrictType(
  config: StrictTypeConfig,
  operationsNode: AstNode,
  generatedTypes: string,
): string {
  const properties =
    config.extractType === 'queryParams'
      ? extractQueryParams(
          operationsNode,
          config.operationId,
          generatedTypes,
          config,
        )
      : extractResponseType(
          operationsNode,
          config.operationId,
          config.responseCode,
          config.sourcePath ?? [],
          generatedTypes,
          config,
        )
  if (!properties) {
    throw new Error(
      `Strict type generation failed for ${config.operationId}: expected fields for ${config.typeName}. Update its extraction configuration.`,
    )
  }
  const description = `Strict type for ${config.typeName
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim()}.`
  return generateTypeDefinition(config.typeName, properties, description)
}

export async function renderStrictTypes(document: OpenAPI3): Promise<string> {
  const generatedTypes = await renderOpenApiDocumentTypes(document)
  const operations = findExportByName(
    parseTypeScript(generatedTypes),
    'operations',
  )
  if (!operations) {
    throw new Error(
      'Strict type generation failed: expected an operations interface. Supply the v0 OpenAPI document.',
    )
  }
  const operationsNode = (operations.body ??
    operations.typeAnnotation) as AstNode
  const types = Object.values(STRICT_TYPE_CONFIG).map(config =>
    renderStrictType(config, operationsNode, generatedTypes),
  )
  return `/**
 * @file Strict type definitions generated from the v0 OpenAPI contract.
 * Generated by scripts/repo/generate-strict-types.mts.
 */
/* c8 ignore start - Type definitions only, no runtime code to test. */

import type { OrganizationSlug } from './keys.mts'

${types.join('\n\n')}
${generateWrapperTypes()}
/* c8 ignore stop */
`
}
