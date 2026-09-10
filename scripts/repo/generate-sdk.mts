#!/usr/bin/env node
/**
 * @file Generates and verifies v0 and v1 Socket API contract artifacts.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

import { isMainModule } from '../fleet/process/is-main-module.mts'
import { runMain } from '../fleet/process/run-main.mts'
import {
  renderStrictIndexExports,
  renderStrictTypes,
} from './generate-strict-types.mts'
import { renderOpenApiTypes } from './generate-types.mts'
import {
  findOpenApiDrift,
  formatOpenApiArtifact,
  OPENAPI_ARTIFACT_PATHS,
  OPENAPI_INDEX_PATH,
  OPENAPI_STRICT_PATH,
  readOpenApiInputs,
  writeOpenApiArtifacts,
} from './openapi-contracts.mts'

import type { ScriptMeta } from '../fleet/process/run-main.mts'
import type {
  OpenApiArtifact,
  OpenApiInputOptions,
} from './openapi-contracts.mts'

export interface GenerateSdkOptions extends OpenApiInputOptions {
  check?: boolean | undefined
  skipIndex?: boolean | undefined
}

const logger = getDefaultLogger()
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

export async function renderSdkArtifacts(
  options: GenerateSdkOptions,
): Promise<OpenApiArtifact[]> {
  const opts = { __proto__: null, ...options } as typeof options
  const inputs = await readOpenApiInputs(options)
  const artifacts: OpenApiArtifact[] = []
  for (const { contract, document } of inputs) {
    artifacts.push(
      {
        filePath: path.join(opts.rootPath, contract.snapshot),
        content: JSON.stringify(document, null, 2),
      },
      {
        filePath: path.join(opts.rootPath, contract.types),
        content: await renderOpenApiTypes(document, contract.version),
      },
    )
  }
  const v0 = inputs.find(input => input.contract.version === 'v0')!
  artifacts.push({
    filePath: path.join(opts.rootPath, OPENAPI_STRICT_PATH),
    content: await renderStrictTypes(v0.document),
  })
  if (!opts.skipIndex) {
    const filePath = path.join(opts.rootPath, OPENAPI_INDEX_PATH)
    artifacts.push({
      filePath,
      content: renderStrictIndexExports(await readFile(filePath, 'utf8')),
    })
  }
  return Promise.all(
    artifacts.map(async artifact => ({
      __proto__: null,
      ...artifact,
      content: await formatOpenApiArtifact(
        artifact.filePath,
        artifact.content,
        opts.rootPath,
      ),
    })),
  )
}

export async function generateSdkContracts(
  options: GenerateSdkOptions,
): Promise<string[]> {
  const opts = { __proto__: null, ...options } as typeof options
  const artifacts = await renderSdkArtifacts(options)
  const drift = await findOpenApiDrift(artifacts)
  if (!opts.check) {
    await writeOpenApiArtifacts(
      artifacts.filter(artifact => drift.includes(artifact.filePath)),
    )
  }
  return drift
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      check: { type: 'boolean' },
      offline: { type: 'boolean' },
      'skip-index': { type: 'boolean' },
      'list-artifacts': { type: 'boolean' },
      'v0-source': { type: 'string' },
      'v1-source': { type: 'string' },
    },
  })
  if (values['list-artifacts']) {
    process.stdout.write(`${OPENAPI_ARTIFACT_PATHS.join('\n')}\n`)
    return 0
  }
  const drift = await generateSdkContracts({
    rootPath: repositoryRoot,
    check: values.check,
    offline: values.offline || values.check,
    skipIndex: values['skip-index'],
    sources: { v0: values['v0-source'], v1: values['v1-source'] },
  })
  if (values.check && drift.length > 0) {
    logger.error(
      `API contract artifacts differ: ${drift.map(file => path.relative(repositoryRoot, file)).join(', ')}. Run pnpm run generate-sdk --offline.`,
    )
    return 1
  }
  logger.log(
    `API contracts ${values.check ? 'verified' : 'generated'}; ${drift.length} changed artifacts.`,
  )
  return 0
}

const SCRIPT_META: ScriptMeta = {
  describe: 'generates and checks v0 and v1 Socket API contract artifacts',
  help: `Usage: pnpm run generate-sdk [options]

  --offline         Generate from the checked-in snapshots without network access.
  --check           Check local artifacts without writing or downloading.
  --v0-source PATH  Read a local v0 OpenAPI document.
  --v1-source PATH  Read a local v1 OpenAPI document.
  --skip-index      Leave the index export block untouched.
  --list-artifacts  Print the exact generated artifact paths.`,
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
