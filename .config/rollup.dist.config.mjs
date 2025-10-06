/**
 * @fileoverview Rollup distribution configuration for Socket SDK.
 */

import path from 'node:path'

import baseConfig from './rollup.base.config.mjs'

export default async () => {
  const rootPath = path.join(import.meta.dirname, '..')
  const srcPath = path.join(rootPath, 'src')
  const distPath = path.join(rootPath, 'dist')

  return [
    baseConfig({
      input: {
        index: `${srcPath}/index.ts`,
        testing: `${srcPath}/testing.ts`,
      },
      output: [
        {
          dir: path.relative(rootPath, distPath),
          entryFileNames: '[name].js',
          exports: 'auto',
          externalLiveBindings: false,
          format: 'cjs',
          preserveModules: true,
          preserveModulesRoot: srcPath,
          sourcemap: false,
        },
      ],
    }),
  ]
}
