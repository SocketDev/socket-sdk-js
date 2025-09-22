import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { safeRemove } from './utils/safe-remove.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootPath = path.join(__dirname, '..')
const distPath = path.join(rootPath, 'dist')
const distCjsPath = path.join(distPath, 'cjs')

void (async () => {
  await Promise.all([
    fs.rename(
      path.join(distCjsPath, 'index.d.ts'),
      path.join(distPath, 'index.d.cts'),
    ),
    fs.rename(
      path.join(distCjsPath, 'index.d.ts.map'),
      path.join(distPath, 'index.d.cts.map'),
    ),
    fs.rename(
      path.join(distCjsPath, 'index.js'),
      path.join(distPath, 'index.cjs'),
    ),
    fs.rename(
      path.join(distCjsPath, 'index.js.map'),
      path.join(distPath, 'index.cjs.map'),
    ),
  ])
  await safeRemove([distCjsPath, path.join(distPath, 'tsconfig.tsbuildinfo')])
})()
