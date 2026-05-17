/**
 * @fileoverview TypeScript type generation script for Socket API.
 * Generates type definitions from OpenAPI schema for Socket SDK.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import openapiTS from 'openapi-typescript'

import { getDefaultLogger } from '@socketsecurity/lib/logger'

import { getRootPath } from './utils/path-helpers.mts'

const logger = getDefaultLogger()

const rootPath = getRootPath(import.meta.url)
const openApiJsonPath = path.join(rootPath, 'openapi.json')
const typesPath = path.join(rootPath, 'types/api.d.ts')

async function main(): Promise<void> {
  try {
    const output = await openapiTS(openApiJsonPath, {
      transform(schemaObject) {
        if ('format' in schemaObject && schemaObject['format'] === 'binary') {
          return 'never'
        }
        return undefined
      },
    })
    await fs.writeFile(typesPath, output, 'utf8')
    logger.log(`  Written to ${typesPath}`)
  } catch (e) {
    process.exitCode = 1
    logger.error(
      'Failed with error:',
      e instanceof Error ? e.message : String(e),
    )
  }
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
