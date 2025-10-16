/**
 * @fileoverview Register module loader for aliasing @socketsecurity/registry to local build.
 * This should be imported at the very top of any script that needs local registry access.
 */

import { existsSync } from 'node:fs'
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Required for loader registration
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '..')
const registryPath = path.join(rootPath, '..', 'socket-registry', 'registry', 'dist')

if (existsSync(registryPath)) {
  const loaderPath = path.join(__dirname, 'loader.mjs')
  register(pathToFileURL(loaderPath).href, import.meta.url)
}
