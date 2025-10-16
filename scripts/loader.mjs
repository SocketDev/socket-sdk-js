/**
 * @fileoverview Node.js loader to alias @socketsecurity/registry to local build when available.
 * This allows scripts to use the latest local version during development.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.resolve(__dirname, '..')

// Check for local socket-registry build
const registryPath = path.join(rootPath, '..', 'socket-registry', 'registry', 'dist')
const useLocalRegistry = existsSync(registryPath)

export function resolve(specifier, context, nextResolve) {
  // Rewrite @socketsecurity/registry imports to local dist if available
  if (useLocalRegistry && specifier.startsWith('@socketsecurity/registry')) {
    const subpath = specifier.slice('@socketsecurity/registry'.length) || '/index.js'
    const localPath = path.join(registryPath, subpath.startsWith('/') ? subpath.slice(1) : subpath)

    // Add .js extension if not present
    const resolvedPath = localPath.endsWith('.js') ? localPath : `${localPath}.js`

    return {
      url: `file://${resolvedPath}`,
      shortCircuit: true
    }
  }

  return nextResolve(specifier, context)
}
