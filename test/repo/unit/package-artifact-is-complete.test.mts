/**
 * @file Published package files preserve the SDK declaration module graph.
 */

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { expect, it } from 'vitest'

import { checkPackageArtifact } from '../../../scripts/repo/package-artifact-is-complete.mts'

type PackageManifest = {
  exports: Record<string, unknown>
  files: string[]
  main: string
  types: string
}

const declarationFiles = {
  'dist/index.d.mts': "export type { PackageResult } from './types/core.mts'\n",
  'dist/types/core.d.mts':
    "export type { PackageResult } from './purl.mts'\nexport { readNdjson } from '../utils/ndjson.mts'\n",
  'dist/types/purl.d.mts':
    "export type { PackageResult } from '../../types/api-v1.js'\n",
  'dist/utils/ndjson.d.mts': 'export declare function readNdjson(): void\n',
  'types/api-v1.d.ts': 'export type PackageResult = { purl: string }\n',
}

async function createPackageFixture(
  directory: string,
  manifest: PackageManifest,
): Promise<void> {
  const files = {
    ...declarationFiles,
    'dist/index.js': 'export {}\n',
    'dist/index.browser.js': 'export {}\n',
    'dist/testing.js': 'export {}\n',
    'dist/testing.d.mts': 'export {}\n',
    'dist/external/form-data.js': 'export {}\n',
    'types/api.d.ts': 'export {}\n',
    'types/api-helpers.d.ts': 'export {}\n',
    'package.json': JSON.stringify({
      name: '@example/sdk',
      version: '1.0.0',
      type: 'module',
      scripts: { prepack: 'node -e "process.exit(17)"' },
      ...manifest,
    }),
  }
  const written = await Promise.allSettled(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = path.join(directory, relativePath)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, contents)
    }),
  )
  for (const result of written) {
    if (result.status === 'rejected') {
      throw result.reason
    }
  }
}

async function withPackageFixture(
  callback: (sourcePath: string, manifest: PackageManifest) => Promise<void>,
): Promise<void> {
  const rootPath = path.join(import.meta.dirname, '../../..')
  const { exports, files, main, types } = JSON.parse(
    await readFile(path.join(rootPath, 'package.json'), 'utf8'),
  ) as PackageManifest
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sdk-package-'))
  try {
    const sourcePath = path.join(directory, 'source')
    const manifest = { exports, files, main, types }
    await createPackageFixture(sourcePath, manifest)
    await callback(sourcePath, manifest)
  } finally {
    await safeDelete(directory)
  }
}

it('ships declarations and resolves their imports without running package lifecycle scripts', async () => {
  await withPackageFixture(async sourcePath => {
    await expect(checkPackageArtifact(sourcePath)).resolves.toBeUndefined()
  })
})

it.each([
  'types entry',
  'nested declaration',
  'runtime export',
  'private dependency',
])('rejects a package with a missing %s', async missing => {
  await withPackageFixture(async (sourcePath, manifest) => {
    if (missing === 'types entry') {
      manifest.types = './dist/missing.d.mts'
    }
    if (missing === 'nested declaration') {
      manifest.files = ['dist/*.d.mts', 'dist/*.js', 'types/*.d.ts']
    }
    if (missing === 'runtime export') {
      manifest.exports['./testing'] = {
        types: './dist/testing.d.mts',
        default: './dist/missing.js',
      }
    }
    await createPackageFixture(sourcePath, manifest)
    if (missing === 'private dependency') {
      await writeFile(
        path.join(sourcePath, 'dist/types/purl.d.mts'),
        "export type { PackageResult } from 'example-private-types'\n",
      )
    }
    await expect(checkPackageArtifact(sourcePath)).rejects.toBeInstanceOf(Error)
  })
})
