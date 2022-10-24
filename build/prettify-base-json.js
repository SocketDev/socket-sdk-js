// @ts-check

const { readFile, writeFile } = require('node:fs/promises')
const path = require('node:path')

Promise.resolve().then(async () => {
  const openApiData = await readFile(path.join(__dirname, '../openapi.json'), 'utf8')

  await writeFile(path.join(__dirname, '../openapi.json'), JSON.stringify(JSON.parse(openApiData), undefined, 2))
}).catch(err => {
  console.error('Failed with error:', err.stack)
  process.exit(1)
})
