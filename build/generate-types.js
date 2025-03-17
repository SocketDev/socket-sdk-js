'use strict'

const path = require('node:path')

void (async () => {
  try {
    const { default: openapiTS } = await import('openapi-typescript')
    const localPath = path.join(__dirname, '../openapi.json')
    const output = await openapiTS(localPath, {
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
