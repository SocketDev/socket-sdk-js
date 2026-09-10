/**
 * @file Multipart imports remain statically traceable to the bundled shim.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseTypeScript } from '../../../scripts/repo/generate-strict-types-lib.mts'
import { getFormData } from '../../../src/file-upload.mts'

describe('form-data vendoring', () => {
  const rootPath = path.join(import.meta.dirname, '../../..')
  const read = (rel: string) => readFileSync(path.join(rootPath, rel), 'utf8')

  it('reaches form-data only through the vendored shim', () => {
    const ast = parseTypeScript(read('src/file-upload.mts'))
    const nodes = Array.isArray(ast.body) ? ast.body : []
    const declaration = nodes.find(
      node => node.declaration?.id?.name === 'getFormData',
    )?.declaration
    expect(declaration).toMatchObject({
      body: {
        body: [
          {
            consequent: {
              body: [
                {
                  expression: {
                    right: {
                      expression: {
                        arguments: [{ value: './external/form-data.js' }],
                        callee: { name: 'require', type: 'Identifier' },
                        type: 'CallExpression',
                      },
                      type: 'TSAsExpression',
                    },
                  },
                },
              ],
            },
          },
          { type: 'ReturnStatement' },
        ],
      },
    })
  })

  it('keeps the shim a static single-specifier re-export', () => {
    // The shim must stay `require('form-data')` as a static literal so the
    // externals build (and any consumer bundler) can resolve and inline it.
    const shim = read('src/external/form-data.js')
    expect(shim).toContain("module.exports = require('form-data')")
  })

  it('resolves a usable multipart constructor from source', () => {
    const FormDataCtor = getFormData()
    expect(typeof FormDataCtor).toBe('function')
    const form = new FormDataCtor()
    expect(typeof form.append).toBe('function')
    expect(typeof form.getHeaders).toBe('function')
  })

  // Dist-shape assertions: meaningful only after a build has run (CI builds
  // before testing; a fresh checkout may not have dist yet).
  it.skipIf(!existsSync(path.join(rootPath, 'dist/index.js')))(
    'emits no unresolvable form-data specifier into the bundle',
    () => {
      // The published failure mode: a require of the bare package name with
      // nothing behind it. The scoped external() in rolldown.config.mts must
      // instead emit the relative require verbatim, resolved at runtime (or
      // inlined by a consumer bundler) against shipped dist/external bytes.
      const bundle = read('dist/index.js')
      expect(bundle).not.toMatch(/require\(\s*["']form-data["']\s*\)/)
      expect(bundle).toContain('require("./external/form-data.js")')
    },
  )
  it.skipIf(!existsSync(path.join(rootPath, 'dist/external/form-data.js')))(
    'builds dist/external/form-data.js self-contained',
    () => {
      const external = read('dist/external/form-data.js')
      const bareRequires = [
        ...external.matchAll(/require\(\s*["']([^"'.][^"']*)["']\s*\)/g),
      ]
        .map(m => m[1]!)
        .filter(spec => !spec.startsWith('node:'))
      expect(bareRequires).toEqual([])
    },
  )
})
