import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { getFormData } from '../../../src/file-upload.mts'

// CE-356: the SDK reached form-data through a bundler-invisible
// `createRequire(...)('form-data')`, so socket-cli's rollup shipped the bare
// specifier with form-data neither bundled nor declared, and every fresh
// `npx socket` install threw "Cannot find module 'form-data'" on its first
// multipart upload — taking a customer's CI down. form-data is now vendored
// through `src/external/` (socket-lib's convention): a static relative
// require a bundler can follow, backed by a self-contained
// `dist/external/form-data.js` for any loader that leaves the require
// verbatim. These tests pin that mechanism.
describe('form-data vendoring (CE-356)', () => {
  const rootPath = path.join(import.meta.dirname, '../../..')
  const read = (rel: string) => readFileSync(path.join(rootPath, rel), 'utf8')

  it('reaches form-data only through the vendored shim', () => {
    // A dynamically-required or bare 'form-data' specifier here is the
    // regression: bundlers cannot follow it, so it ships unresolvable.
    const source = read('src/file-upload.mts')
    expect(source).not.toMatch(/from 'node:module'/)
    expect(source).not.toMatch(/require\(\s*['"]form-data['"]\s*\)/)
    expect(source).toMatch(/require\(\s*'\.\/external\/form-data\.js',?\s*\)/)
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
