/* eslint-disable no-console */
// @ts-check

const { readFile, writeFile } = require('node:fs/promises')
const path = require('node:path')

Promise.resolve().then(async () => {
  const openApiData = await readFile(path.join(__dirname, '../src/openapi.json'), 'utf8')

  await writeFile(path.join(__dirname, '../dist/openapi.json'), JSON.stringify(JSON.parse(openApiData)))
}).catch(err => {
  console.error('Failed with error:', err.stack)
  process.exit(1)
})
