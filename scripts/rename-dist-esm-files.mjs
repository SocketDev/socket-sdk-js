import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { safeRemove } from './utils/safe-remove.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootPath = path.join(__dirname, '..')
const distPath = path.join(rootPath, 'dist')
const distEsmPath = path.join(distPath, 'esm')

void (async () => {
  await Promise.all([
    fs.rename(
      path.join(distEsmPath, 'index.d.ts'),
      path.join(distPath, 'index.d.mts')
    ),
    fs.rename(
      path.join(distEsmPath, 'index.d.ts.map'),
      path.join(distPath, 'index.d.mts.map')
    ),
    fs.rename(
      path.join(distEsmPath, 'index.js'),
      path.join(distPath, 'index.js')
    ),
    fs.rename(
      path.join(distEsmPath, 'index.js.map'),
      path.join(distPath, 'index.js.map')
    )
  ])
  await safeRemove([
    distEsmPath,
    path.join(distPath, 'tsconfig.esm.tsbuildinfo')
  ])
})()
