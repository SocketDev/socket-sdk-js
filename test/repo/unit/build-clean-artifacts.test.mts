/**
 * @file Build and clean task selection follows the shipped artifact layout.
 */

import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { afterEach, describe, expect, it } from 'vitest'

import { isBuildNeeded, selectBuildMode } from '../../../scripts/repo/build.mts'
import {
  cleanDirectories,
  selectCleanTasks,
} from '../../../scripts/repo/clean.mts'

const fixtureDirectories: string[] = []

afterEach(async () => {
  for (const directory of fixtureDirectories.splice(0)) {
    await safeDelete(directory)
  }
})

async function createArtifactFixture(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sdk-artifacts-'))
  fixtureDirectories.push(directory)
  await mkdir(path.join(directory, 'dist'))
  return directory
}

describe('build artifact selection', () => {
  it.each([
    [{}, 'full'],
    [{ src: true }, 'source'],
    [{ types: true }, 'types'],
    [{ src: true, types: true }, 'full'],
    [{ watch: true, types: true }, 'watch'],
  ])('selects the requested build for %j', (flags, mode) => {
    expect(selectBuildMode(flags)).toBe(mode)
  })

  it('requires both the root bundle and its emitted declaration', async () => {
    const directory = await createArtifactFixture()
    expect(isBuildNeeded(directory)).toBe(true)
    await writeFile(path.join(directory, 'dist/index.mjs'), '')
    expect(isBuildNeeded(directory)).toBe(true)
    await writeFile(path.join(directory, 'dist/index.d.mts'), '')
    expect(isBuildNeeded(directory)).toBe(false)
  })
})

describe('clean artifact selection', () => {
  it('cleans ordinary artifacts by default and keeps dependencies', () => {
    expect(selectCleanTasks({}).map(task => task.name)).toEqual([
      'cache',
      'coverage',
      'dist',
    ])
    expect(selectCleanTasks({ modules: true }).map(task => task.name)).toEqual([
      'node_modules',
    ])
    expect(
      selectCleanTasks({ all: true, modules: true }).map(task => task.name),
    ).toEqual(['cache', 'coverage', 'dist', 'node_modules'])
  })

  it('cleans declarations without deleting source bundles', async () => {
    const directory = await createArtifactFixture()
    const bundle = path.join(directory, 'dist/index.mjs')
    const declaration = path.join(directory, 'dist/index.d.mts')
    await writeFile(bundle, '')
    await writeFile(declaration, '')
    expect(
      await cleanDirectories(selectCleanTasks({ types: true }), {
        rootPath: directory,
        quiet: true,
      }),
    ).toBe(0)
    expect(existsSync(bundle)).toBe(true)
    expect(existsSync(declaration)).toBe(false)
    expect(
      await cleanDirectories(selectCleanTasks({ dist: true, types: true }), {
        rootPath: directory,
        quiet: true,
      }),
    ).toBe(0)
    expect(existsSync(path.join(directory, 'dist'))).toBe(false)
  })
})
