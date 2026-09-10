#!/usr/bin/env node
/**
 * @file Verifies entry points and declaration resolution in the SDK tarball.
 */

import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import {
  extractPackage,
  packPackage,
} from '@socketsecurity/lib-stable/packages/tarball'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'

import { isMainModule } from '../fleet/process/is-main-module.mts'
import { runMain } from '../fleet/process/run-main.mts'

import type { ScriptMeta } from '../fleet/process/run-main.mts'

const toolingRoot = path.resolve(import.meta.dirname, '../..')

type ArtifactManifest = {
  exports: Record<string, unknown>
  main: string
  types: string
}

function artifactExportTargets(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }
  if (value === null || typeof value !== 'object') {
    return []
  }
  return Object.entries(value).flatMap(([condition, target]) =>
    condition === 'source' ? [] : artifactExportTargets(target),
  )
}

function artifactConsumerSource(manifest: ArtifactManifest): string {
  const exports = Object.entries(manifest.exports).filter(
    ([, value]) =>
      value !== null && typeof value === 'object' && 'types' in value,
  )
  return exports
    .map(([subpath], index) => {
      const specifier = `sdk-artifact${subpath === '.' ? '' : subpath.slice(1)}`
      return `export type * as SdkEntry${index} from ${JSON.stringify(specifier)}`
    })
    .join('\n')
}

async function checkArtifactDeclarations(
  directory: string,
  manifest: ArtifactManifest,
): Promise<void> {
  const typesDirectory = path.join(directory, 'node_modules/@types')
  await mkdir(typesDirectory, { recursive: true })
  await symlink(
    path.join(toolingRoot, 'node_modules/@types/node'),
    path.join(typesDirectory, 'node'),
    'junction',
  )
  await writeFile(
    path.join(directory, 'consumer.mts'),
    artifactConsumerSource(manifest),
  )
  const configPath = path.join(directory, 'tsconfig.json')
  await writeFile(
    configPath,
    JSON.stringify({
      compilerOptions: {
        module: 'nodenext',
        noEmit: true,
        skipLibCheck: false,
        strict: true,
        types: ['node'],
      },
      files: ['consumer.mts'],
    }),
  )
  const checked = await spawn(
    process.execPath,
    [
      path.join(toolingRoot, 'node_modules/typescript/bin/tsc'),
      '-p',
      configPath,
    ],
    { stdio: 'pipe', stdioString: true, throws: false },
  )
  if (checked.code !== 0) {
    throw new Error(
      `Package declaration check failed in ${directory}: expected a valid NodeNext consumer, received compiler exit ${checked.code}. Fix the shipped declarations.\n${checked.stdout}${checked.stderr}`,
    )
  }
}

export async function checkPackageArtifact(rootPath: string): Promise<void> {
  try {
    await access(path.join(rootPath, 'dist/index.d.mts'))
  } catch (cause) {
    throw new Error(
      `Package artifact check requires declarations in ${rootPath}: expected dist/index.d.mts before packing. Run pnpm run build first.`,
      { cause },
    )
  }
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'sdk-package-artifact-'),
  )
  try {
    const packOptions = {
      ignoreScripts: true,
      offline: true,
      preferOffline: true,
    }
    const tarball = await packPackage(rootPath, packOptions)
    if (!Buffer.isBuffer(tarball)) {
      throw new TypeError(
        'Package packing failed: expected tarball bytes. Check the package files and rebuild.',
      )
    }
    const tarballPath = path.join(directory, 'sdk.tgz')
    await writeFile(tarballPath, tarball)
    const packagePath = path.join(directory, 'node_modules/sdk-artifact')
    await extractPackage(tarballPath, { dest: packagePath })
    const manifest = JSON.parse(
      await readFile(path.join(packagePath, 'package.json'), 'utf8'),
    ) as ArtifactManifest
    const targets = new Set([
      manifest.main,
      manifest.types,
      ...artifactExportTargets(manifest.exports),
    ])
    for (const target of targets) {
      await access(path.join(packagePath, target))
    }
    await checkArtifactDeclarations(directory, manifest)
  } finally {
    await safeDelete(directory)
  }
}

async function main(): Promise<void> {
  await checkPackageArtifact(toolingRoot)
}

const SCRIPT_META: ScriptMeta = {
  describe:
    'checks packed SDK entry points and declaration imports after build',
  help: 'Usage: pnpm run check:package-artifact\n\nBuild the SDK first. Packs locally without lifecycle scripts or registry access, then type-checks every public declaration entry.',
  json: 'result',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
