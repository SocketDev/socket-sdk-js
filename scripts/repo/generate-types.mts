/**
 * @file TypeScript type generation script for Socket API. Generates type
 *   definitions from OpenAPI schema for Socket SDK.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import openapiTS from 'openapi-typescript'

import { errorMessage } from '@socketsecurity/lib-stable/errors/message'
import { findUpSync } from '@socketsecurity/lib-stable/fs/find'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { isMainModule } from '../fleet/_shared/is-main-module.mts'

const logger = getDefaultLogger()

const rootPackageJsonPath = findUpSync('package.json', {
  cwd: path.dirname(fileURLToPath(import.meta.url)),
})
if (!rootPackageJsonPath) {
  throw new Error('Unable to locate repository root (package.json not found).')
}
const rootPath = path.dirname(rootPackageJsonPath)
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
    logger.error('Failed with error:', errorMessage(e))
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((e: unknown) => {
    logger.error(e)
    process.exitCode = 1
  })
}
