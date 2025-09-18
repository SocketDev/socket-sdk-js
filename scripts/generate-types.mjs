import path from 'node:path'
import { fileURLToPath } from 'node:url'

import openapiTS from 'openapi-typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootPath = path.join(__dirname, '..')
const openApiJsonPath = path.join(rootPath, 'openapi.json')

void (async () => {
  try {
    const output = await openapiTS(openApiJsonPath, {
      transform(schemaObject) {
        if ('format' in schemaObject && schemaObject.format === 'binary') {
          return 'never'
        }
      }
    })
    console.log(output)
  } catch (e) {
    process.exitCode = 1
    console.error('Failed with error:', e)
  }
})()
