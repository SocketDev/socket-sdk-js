'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

void (async () => {
  try {
    const openApiData = await fs.readFile(
      path.join(__dirname, '../openapi.json'),
      'utf8'
    )
    await fs.writeFile(
      path.join(__dirname, '../openapi.json'),
      JSON.stringify(JSON.parse(openApiData), null, 2)
    )
  } catch (e) {
    process.exitCode = 1
    console.error('Failed with error:', e.stack)
  }
})()
