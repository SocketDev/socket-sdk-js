import openapiTS from 'openapi-typescript'

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
