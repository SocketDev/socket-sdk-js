/**
 * @fileoverview TypeScript type generation script for Socket API.
 * Generates type definitions from OpenAPI schema for Socket SDK.
 */
import path from 'node:path'

import openapiTS from 'openapi-typescript'

import { getDefaultLogger } from '@socketsecurity/lib/logger'

import { getRootPath } from './utils/path-helpers.mjs'

const logger = getDefaultLogger()

const rootPath = getRootPath(import.meta.url)
const openApiJsonPath = path.join(rootPath, 'openapi.json')

async function main() {
  try {
    const output = await openapiTS(openApiJsonPath, {
      transform(schemaObject) {
        if ('format' in schemaObject && schemaObject.format === 'binary') {
          return 'never'
        }
      },
    })
    logger.log(output)
  } catch (e) {
    process.exitCode = 1
    logger.error('Failed with error:', e.message)
  }
}

main().catch(e => {
  logger.error(e)
  process.exitCode = 1
})
