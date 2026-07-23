// Tests for the dedup gate's auto-gate + production-closure filtering.
// `repoUsesRolldown` is a plain detector — a rolldown (dev)dependency or a
// rolldown config file means the repo bundles, full stop. The compiler-only
// case this repo cares about, a Rolldown config that externalizes every
// runtime dependency so dev-tool duplicate majors never reach bundle bytes,
// is handled downstream: `scan(...).bundledDuplicates` gates only duplicates
// reachable from a production importer root through the snapshot graph, so
// dev-only duplicate majors stay informational.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  repoUsesRolldown,
  scan,
} from '../../../scripts/fleet/check/dependencies-are-deduped.mts'

describe('repoUsesRolldown', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true })
    }
  })

  function makeRepo(options?: {
    config?: string | undefined
    rolldownDep?: boolean | undefined
  }): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'socket-sdk-dedup-'))
    tempDirs.push(dir)
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify(
        options?.rolldownDep
          ? { devDependencies: { rolldown: '1.0.0' } }
          : { devDependencies: { esbuild: '1.0.0' } },
      ),
    )
    if (options?.config !== undefined) {
      mkdirSync(path.join(dir, '.config', 'repo'), { recursive: true })
      writeFileSync(
        path.join(dir, '.config', 'repo', 'rolldown.config.mts'),
        options.config,
      )
    }
    return dir
  }

  it('detects a rolldown devDependency even when the config externalizes all runtime dependencies', () => {
    const repo = makeRepo({
      config:
        'const externalDependencies = Object.keys(packageJson.dependencies || {})\nexport default { external: externalDependencies }\n',
      rolldownDep: true,
    })

    expect(repoUsesRolldown(repo)).toBe(true)
  })

  it('detects a rolldown config file with no rolldown dependency', () => {
    const repo = makeRepo({
      config: 'export default { input: "src/index.mts" }\n',
    })

    expect(repoUsesRolldown(repo)).toBe(true)
  })

  it('reports false when neither a rolldown dependency nor a config file exists', () => {
    const repo = makeRepo()

    expect(repoUsesRolldown(repo)).toBe(false)
  })
})

describe('scan — production-closure gating', () => {
  it('keeps dev-only duplicate majors out of bundledDuplicates', () => {
    const lock = [
      'importers:',
      '',
      '  .:',
      '    devDependencies:',
      '      tool:',
      '        specifier: 2.0.0',
      '        version: 2.0.0',
      '',
      'packages:',
      '',
      "  'dup@1.0.0':",
      "  'dup@2.0.0':",
      '',
      'snapshots:',
      '',
      '  tool@2.0.0:',
      '    dependencies:',
      '      dup: 1.0.0',
      '',
    ].join('\n')

    const result = scan(lock)
    expect(result.duplicates).toEqual([{ majors: ['1', '2'], name: 'dup' }])
    expect(result.bundledDuplicates).toEqual([])
  })

  it('gates duplicate majors reachable from a production root', () => {
    const lock = [
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      appdep:',
      '        specifier: 1.0.0',
      '        version: 1.0.0',
      '      appdep-legacy:',
      '        specifier: npm:appdep@2.0.0',
      '        version: appdep@2.0.0',
      '',
      'packages:',
      '',
      "  'appdep@1.0.0':",
      "  'appdep@2.0.0':",
      '',
    ].join('\n')

    const result = scan(lock)
    expect(result.bundledDuplicates).toEqual([
      { majors: ['1', '2'], name: 'appdep' },
    ])
  })
})
