import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const openApiData = await readFile(path.join(__dirname, '../openapi.json'), 'utf8')

await writeFile(path.join(__dirname, '../openapi.json'), JSON.stringify(JSON.parse(openApiData), undefined, 2))
