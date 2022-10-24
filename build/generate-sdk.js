// @ts-check

const { readFile, writeFile } = require('node:fs/promises')
const path = require('node:path')

const OpenAPIParser = require('@readme/openapi-parser')
const { default: codegen } = require('api/dist/cli/codegen')
const { default: Oas } = require('oas')

const OUTPUT_FOLDER = path.join(__dirname, '../src')
const OPEN_API_FILE = path.join(OUTPUT_FOLDER, 'openapi.json')

Promise.resolve().then(async () => {
  console.log('Reading OpenAPI file...')

  const openApiData = await readFile(OPEN_API_FILE, 'utf8')
  const parsedOpenApi = JSON.parse(openApiData)

  console.log('Resolving OpenAPI references...')

  const resolvedOpenAPISpec = /** @type {Record<string,unknown>} */ (await OpenAPIParser.validate(parsedOpenApi, {
    dereference: {
      circular: 'ignore'
    }
  }))

  console.log('Initiating SDK generation...')

  const oas = await Oas.init(resolvedOpenAPISpec)
  const generator = codegen('ts', oas, './openapi.json', 'socket-sdk')

  console.log('Generating SDK...')

  const sdkSource = await generator.generator()

  console.log(`Writing ${OPEN_API_FILE} to disk...`)
  await Promise.all([
    await writeFile(OPEN_API_FILE, JSON.stringify(resolvedOpenAPISpec, undefined, 2)),
    ...Object.entries(sdkSource)
      .map(async ([fileName, contents]) => {
        const sourceFilePath = path.join(OUTPUT_FOLDER, fileName)
        console.log(`Writing ${sourceFilePath} to disk...`)
        await writeFile(sourceFilePath, contents)
      })
    ])
}).catch(err => {
  console.error('Failed with error:', err.stack)
  process.exit(1)
})
