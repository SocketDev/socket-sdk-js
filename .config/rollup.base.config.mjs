/**
 * @fileoverview Rollup base configuration for Socket SDK.
 */

import { builtinModules } from 'node:module'
import path from 'node:path'

import { babel as babelPlugin } from '@rollup/plugin-babel'
import commonjsPlugin from '@rollup/plugin-commonjs'
import jsonPlugin from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const EXTERNAL_PACKAGES = new Set(['@socketsecurity/registry'])

function isBuiltin(id) {
  return (
    builtinModules.includes(id) ||
    builtinModules.includes(id.replace(/^node:/, ''))
  )
}

function getPackageName(id, nmPathLength = 0) {
  const normalized = id.slice(nmPathLength)
  if (normalized.startsWith('@')) {
    const parts = normalized.split('/')
    return parts.length > 1 ? `${parts[0]}/${parts[1]}` : normalized
  }
  return normalized.split('/')[0]
}

function normalizeId(id) {
  return id.replace(/\\/g, '/')
}

export default function baseConfig(extendConfig = {}) {
  const rootPath = path.join(import.meta.dirname, '..')
  const configPath = path.join(rootPath, '.config')
  const nmPath = path.join(rootPath, 'node_modules')

  const extendPlugins = Array.isArray(extendConfig.plugins)
    ? extendConfig.plugins.slice()
    : []

  const extractedPlugins = Object.create(null)
  if (extendPlugins.length) {
    for (const pluginName of ['babel', 'commonjs', 'json', 'node-resolve']) {
      for (let i = 0, { length } = extendPlugins; i < length; i += 1) {
        const p = extendPlugins[i]
        if (p?.name === pluginName) {
          extractedPlugins[pluginName] = p
          // Remove from extendPlugins array.
          extendPlugins.splice(i, 1)
          length -= 1
          i -= 1
        }
      }
    }
  }

  return {
    external(rawId) {
      const id = normalizeId(rawId)
      const pkgName = getPackageName(
        id,
        path.isAbsolute(id) ? nmPath.length + 1 : 0,
      )
      return (
        id.endsWith('.d.cts') ||
        id.endsWith('.d.mts') ||
        id.endsWith('.d.ts') ||
        EXTERNAL_PACKAGES.has(pkgName) ||
        isBuiltin(rawId)
      )
    },
    onwarn(warning, warn) {
      // Suppress warnings.
      if (
        warning.code === 'INVALID_ANNOTATION' ||
        warning.code === 'THIS_IS_UNDEFINED'
      ) {
        return
      }
      // Forward other warnings.
      warn(warning)
    },
    ...extendConfig,
    plugins: [
      extractedPlugins['node-resolve'] ??
        nodeResolve({
          exportConditions: ['node'],
          extensions: ['.mjs', '.js', '.json', '.ts', '.mts'],
          preferBuiltins: true,
        }),
      extractedPlugins['json'] ?? jsonPlugin(),
      extractedPlugins['commonjs'] ??
        commonjsPlugin({
          defaultIsModuleExports: true,
          extensions: ['.cjs', '.js'],
          ignoreDynamicRequires: true,
          ignoreGlobal: true,
          ignoreTryCatch: true,
          strictRequires: true,
        }),
      extractedPlugins['babel'] ??
        babelPlugin({
          babelHelpers: 'runtime',
          babelrc: false,
          configFile: path.join(configPath, 'babel.config.js'),
          extensions: ['.mjs', '.js', '.ts', '.mts'],
        }),
      ...extendPlugins,
    ],
  }
}
