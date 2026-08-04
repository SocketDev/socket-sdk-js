import path from 'node:path'

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { config as exportsConfig } from '../../../scripts/repo/package-exports.config.mts'

// Packaging half of the CE-356 regression pin (mechanism details in
// file-upload.test.mts): the vendored form-data bundle must ship with the
// package but never become a public exports subpath.
describe('package-exports config: vendored externals', () => {
  const rootPath = path.join(import.meta.dirname, '../../..')
  const pkgJson = JSON.parse(
    readFileSync(path.join(rootPath, 'package.json'), 'utf8'),
  ) as { files: string[] }

  it('ships dist/external in the published files allowlist', () => {
    // Without this, a loader that leaves the relative require verbatim
    // resolves locally and 404s once published.
    expect(pkgJson.files).toContain('dist/external/*')
  })

  it('treats dist/external as graph-only, never an exports subpath', () => {
    // Re-exporting it would regenerate package.json with a public
    // ./form-data subpath the SDK does not mean to support.
    expect(exportsConfig.ignore).toContain('dist/external/*')
  })
})
