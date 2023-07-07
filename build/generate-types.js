'use strict'

const path = require('node:path')

Promise.resolve().then(async () => {
  const { default: openapiTS } = await import('openapi-typescript')

  const localPath = path.resolve(__dirname, '../openapi.json')
  const output = await openapiTS(localPath, {
    transform (schemaObject) {
      if ('format' in schemaObject && schemaObject.format === 'binary') {
        return 'never'
      }
    }
  })

  // eslint-disable-next-line no-console
  console.log(output)
}).catch(err => {
  // eslint-disable-next-line no-console
  console.error('Failed with error:', err.stack)
  process.exit(1)
})
