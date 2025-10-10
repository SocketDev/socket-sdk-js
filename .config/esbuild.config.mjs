/**
 * @fileoverview esbuild configuration for fast builds with smaller bundles
 */

import { builtinModules } from 'node:module'
import path from 'node:path'

const rootPath = path.join(import.meta.dirname, '..')
const srcPath = path.join(rootPath, 'src')
const distPath = path.join(rootPath, 'dist')

// External packages that should not be bundled
const EXTERNAL_PACKAGES = new Set(['@socketsecurity/registry'])

// Build configuration for ESM output
export const buildConfig = {
  entryPoints: [
    `${srcPath}/index.ts`,
    `${srcPath}/testing.ts`
  ],
  outdir: distPath,
  bundle: true,
  format: 'esm',
  platform: 'node',
  // Minimum Node version from package.json
  target: 'node18',
  sourcemap: false,
  minify: true,
  treeShaking: true,
  // For bundle analysis
  metafile: true,
  logLevel: 'info',
  outExtension: { '.js': '.mjs' },

  // Enable code splitting for ESM
  splitting: true,

  // External dependencies
  external: [
    // Node.js built-ins
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`),
    // External packages
    ...Array.from(EXTERNAL_PACKAGES)
  ],

  // Banner for generated code
  banner: {
    js: '/* Socket SDK ESM - Built with esbuild */'
  },

  // TypeScript configuration
  tsconfig: path.join(rootPath, 'tsconfig.json'),

  // Define constants for optimization
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
}

// Watch configuration for development
export const watchConfig = {
  ...buildConfig,
  minify: false,
  sourcemap: 'inline',
  logLevel: 'debug',
  watch: {
    onRebuild(error, result) {
      if (error) {
        console.error('Watch build failed:', error)
      } else {
        console.log('Watch build succeeded')
        if (result.metafile) {
          const analysis = analyzeMetafile(result.metafile)
          console.log(analysis)
        }
      }
    }
  }
}

/**
 * Analyze build output for size information
 */
function analyzeMetafile(metafile) {
  const outputs = Object.keys(metafile.outputs)
  let totalSize = 0

  const files = outputs.map(file => {
    const output = metafile.outputs[file]
    totalSize += output.bytes
    return {
      name: path.relative(rootPath, file),
      size: (output.bytes / 1024).toFixed(2) + ' KB'
    }
  })

  return {
    files,
    totalSize: (totalSize / 1024).toFixed(2) + ' KB'
  }
}

export { analyzeMetafile }