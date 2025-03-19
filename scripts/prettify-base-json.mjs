import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootPath = path.join(__dirname, '..')
const openApiJsonPath = path.join(rootPath, 'openapi.json')

void (async () => {
  try {
    const openApiData = await fs.readFile(openApiJsonPath, 'utf8')
    await fs.writeFile(
      openApiJsonPath,
      JSON.stringify(JSON.parse(openApiData), null, 2)
    )
  } catch (e) {
    process.exitCode = 1
    console.error('Failed with error:', e.stack)
  }
})()
