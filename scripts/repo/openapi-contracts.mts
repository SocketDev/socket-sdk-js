/**
 * @file Shared inputs, validation, and rendering for Socket API contracts.
 */

import crypto from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { httpJson } from '@socketsecurity/lib-stable/http-request'
import { format } from 'oxfmt'

import type { OpenAPI3 } from 'openapi-typescript'
import type { FormatConfig } from 'oxfmt'
import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'

export type OpenApiVersion = 'v0' | 'v1'

export interface OpenApiContract {
  version: OpenApiVersion
  url: string
  snapshot: string
  types: string
}

export const OPENAPI_CONTRACTS: readonly OpenApiContract[] = [
  {
    version: 'v0',
    url: 'https://api.socket.dev/v0/openapi',
    snapshot: 'openapi.json',
    types: 'types/api.d.ts',
  },
  {
    version: 'v1',
    url: 'https://api.socket.dev/v1/openapi',
    snapshot: 'openapi-v1.json',
    types: 'types/api-v1.d.ts',
  },
]

export const OPENAPI_STRICT_PATH = 'src/types/strict.mts'
export const OPENAPI_INDEX_PATH = 'src/index.mts'

export const OPENAPI_ARTIFACT_PATHS: readonly string[] = [
  ...OPENAPI_CONTRACTS.flatMap(contract => [contract.snapshot, contract.types]),
  OPENAPI_STRICT_PATH,
  OPENAPI_INDEX_PATH,
]

export const OPENAPI_METHOD_ALIASES: Readonly<Record<string, string>> = {
  batchOrgPackageFetch: 'batchPackageFetchByOrg',
  createFullScan: 'CreateOrgFullScan',
  createOrgFullScanFromArchive: 'CreateOrgFullScanArchive',
  createRepository: 'createOrgRepo',
  deleteFullScan: 'deleteOrgFullScan',
  deleteRepository: 'deleteOrgRepo',
  getDiffScanGfm: 'GetDiffScanGfm',
  getFullScan: 'getOrgFullScan',
  getFullScanMetadata: 'getOrgFullScanMetadata',
  getIssuesByNpmPackage: 'getIssuesByNPMPackage',
  getOrgAlertFullScans: 'alertFullScans',
  getOrgAlertsList: 'alertsList',
  getRepository: 'getOrgRepo',
  getScoreByNpmPackage: 'getScoreByNPMPackage',
  listFullScans: 'getOrgFullScanList',
  listOrganizations: 'getOrganizations',
  listRepositories: 'getOrgRepoList',
  rescanFullScan: 'rescanOrgFullScan',
  streamFullScan: 'getOrgFullScan',
  updateRepository: 'updateOrgRepo',
}

export interface OpenApiInputOptions {
  rootPath: string
  offline?: boolean | undefined
  sources?: Partial<Record<OpenApiVersion, string | undefined>> | undefined
  download?: ((url: string) => Promise<unknown>) | undefined
}

export interface OpenApiInput {
  contract: OpenApiContract
  document: OpenAPI3
}

export interface OpenApiArtifact {
  filePath: string
  content: string
}

export function isOpenApiObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateOpenApiReferences(value: unknown): void {
  if (Array.isArray(value)) {
    for (let index = 0, { length } = value; index < length; index += 1) {
      validateOpenApiReferences(value[index])
    }
    return
  }
  if (!isOpenApiObject(value)) {
    return
  }
  const reference = value['$ref']
  if (typeof reference === 'string' && !reference.startsWith('#/')) {
    throw new Error(
      'Invalid OpenAPI reference: expected a local #/ reference. Bundle external schemas before generation.',
    )
  }
  const values = Object.values(value)
  for (let index = 0, { length } = values; index < length; index += 1) {
    validateOpenApiReferences(values[index])
  }
}

function validateOpenApiPaths(paths: Record<string, unknown>): void {
  const methods = new Set([
    'delete',
    'get',
    'head',
    'options',
    'patch',
    'post',
    'put',
    'trace',
  ])
  let operationCount = 0
  for (const [route, item] of Object.entries(paths)) {
    if (route.startsWith('x-')) {
      continue
    }
    if (!route.startsWith('/') || !isOpenApiObject(item)) {
      throw new Error(
        'Invalid OpenAPI path: expected a route and path object. Supply a complete API snapshot.',
      )
    }
    for (const [method, operation] of Object.entries(item)) {
      if (!methods.has(method)) {
        continue
      }
      if (
        !isOpenApiObject(operation) ||
        !isOpenApiObject(operation['responses']) ||
        Object.keys(operation['responses']).length === 0
      ) {
        throw new Error(
          `Invalid OpenAPI operation at ${method} ${route}: expected declared responses. Supply a complete API snapshot.`,
        )
      }
      operationCount += 1
    }
  }
  if (operationCount === 0) {
    throw new Error(
      'Invalid OpenAPI paths: expected at least one HTTP operation. Supply a complete API snapshot.',
    )
  }
}

function validateOpenApiDocumentShape(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (
    !isOpenApiObject(value) ||
    typeof value['openapi'] !== 'string' ||
    !/^3\.\d+\.\d+$/.test(value['openapi']) ||
    !isOpenApiObject(value['info']) ||
    typeof value['info']['title'] !== 'string' ||
    typeof value['info']['version'] !== 'string' ||
    !isOpenApiObject(value['paths']) ||
    Object.keys(value['paths']).length === 0
  ) {
    throw new Error(
      'Invalid OpenAPI document: expected an OpenAPI 3 schema with info and nonempty paths. Supply a complete API snapshot.',
    )
  }
  validateOpenApiPaths(value['paths'])
}

export function normalizeOpenApiDocument(value: unknown): OpenAPI3 {
  validateOpenApiDocumentShape(value)
  validateOpenApiReferences(value)
  const document = JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  const components = document['components']
  const schemas = isOpenApiObject(components)
    ? components['schemas']
    : undefined
  const purlError = isOpenApiObject(schemas)
    ? schemas['PurlErrorSchema']
    : undefined
  if (isOpenApiObject(purlError) && Array.isArray(purlError['required'])) {
    purlError['required'] = purlError['required'].filter(
      name => name !== 'retryable',
    )
  }
  return document as unknown as OpenAPI3
}

export async function readOpenApiInputs(
  options: OpenApiInputOptions,
): Promise<OpenApiInput[]> {
  const opts = { __proto__: null, ...options } as typeof options
  const download = opts.download ?? httpJson
  return Promise.all(
    OPENAPI_CONTRACTS.map(async contract => {
      const source = opts.sources?.[contract.version]
      const localPath =
        source ??
        (opts.offline ? path.join(opts.rootPath, contract.snapshot) : undefined)
      const value: unknown = localPath
        ? JSON.parse(await readFile(localPath, 'utf8'))
        : await download(contract.url)
      return {
        __proto__: null,
        contract,
        document: normalizeOpenApiDocument(value),
      }
    }),
  )
}

export async function formatOpenApiArtifact(
  filePath: string,
  content: string,
  rootPath: string,
): Promise<string> {
  const configPath = path.join(rootPath, '.config/fleet/oxfmtrc.json')
  const config = JSON.parse(await readFile(configPath, 'utf8')) as FormatConfig
  const result = await format(filePath, content, config)
  if (result.errors.length > 0) {
    throw new Error(
      `OpenAPI generation failed in ${filePath}: output contains syntax errors. Repair the generator before writing artifacts.`,
    )
  }
  return result.code
}

export async function findOpenApiDrift(
  artifacts: readonly OpenApiArtifact[],
): Promise<string[]> {
  const drift: string[] = []
  for (const artifact of artifacts) {
    let current: string | undefined
    try {
      current = await readFile(artifact.filePath, 'utf8')
    } catch (error) {
      if (!isOpenApiObject(error) || error['code'] !== 'ENOENT') {
        throw error
      }
    }
    if (current !== artifact.content) {
      drift.push(artifact.filePath)
    }
  }
  return drift
}

export async function writeOpenApiArtifacts(
  artifacts: readonly OpenApiArtifact[],
): Promise<void> {
  for (const artifact of artifacts) {
    const temporaryPath = `${artifact.filePath}.${crypto.randomUUID()}.openapi-tmp`
    try {
      await writeFile(temporaryPath, artifact.content, 'utf8')
      await rename(temporaryPath, artifact.filePath)
    } finally {
      await safeDelete(temporaryPath)
    }
  }
}
