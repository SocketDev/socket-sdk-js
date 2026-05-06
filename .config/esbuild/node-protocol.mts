/**
 * @fileoverview esbuild plugin: rewrite bare Node.js builtin imports to
 * use the `node:` protocol prefix and mark them external. Catches the
 * shape where a dependency does `require('fs')` instead of
 * `require('node:fs')` and stops it from leaking into the bundle as a
 * bundled module reference.
 *
 * Source: lifted from socket-sdk-js. Fleet-canonical via socket-repo-template.
 */

import Module from 'node:module'

import type { OnResolveArgs, PluginBuild } from 'esbuild'

export function createNodeProtocolPlugin() {
  return {
    name: 'node-protocol',
    setup(build: PluginBuild) {
      for (const builtin of Module.builtinModules) {
        // Skip builtins that already carry the node: prefix.
        if (builtin.startsWith('node:')) {
          continue
        }
        // Escape regex special chars in the module name before composing
        // a bare-anchor filter regex (`^name$`).
        const escapedBuiltin = builtin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        build.onResolve(
          { filter: new RegExp(`^${escapedBuiltin}$`) },
          (_args: OnResolveArgs) => ({
            path: `node:${builtin}`,
            external: true,
          }),
        )
      }
    },
  }
}
