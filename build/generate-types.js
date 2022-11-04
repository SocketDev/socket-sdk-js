'use strict'

Promise.resolve().then(async () => {
  const { default: openapiTS } = await import('openapi-typescript')

  const localPath = new URL('../openapi.json', import.meta.url)
    const output = await openapiTS(localPath, {
    formatter (node) {
      if (node.format === 'binary') {
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
