/**
 * @fileoverview Register module loader for aliasing @socketsecurity/lib to local socket-lib build.
 * This should be imported at the very top of any script that needs local lib access.
 */

import { existsSync } from 'node:fs'
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Required for loader registration
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '..')
const registryPath = path.join(rootPath, '..', 'socket-registry', 'registry', 'dist')
const libPath = path.join(rootPath, '..', 'socket-lib', 'dist')

if (existsSync(registryPath) || existsSync(libPath)) {
  const loaderPath = path.join(__dirname, 'loader.mjs')
  register(pathToFileURL(loaderPath).href, import.meta.url)
}
