import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { repoUsesRolldown } from '../../../scripts/fleet/check/dependencies-are-deduped.mts'

describe('repoUsesRolldown', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true })
    }
  })

  function makeRepo(config: string): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'socket-sdk-dedup-'))
    tempDirs.push(dir)
    mkdirSync(path.join(dir, '.config', 'repo'), { recursive: true })
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { rolldown: '1.0.0' } }),
    )
    writeFileSync(
      path.join(dir, '.config', 'repo', 'rolldown.config.mts'),
      config,
    )
    return dir
  }

  it('does not gate compiler-only Rolldown configs that externalize all runtime dependencies', () => {
    const repo = makeRepo(
      'const externalDependencies = Object.keys(packageJson.dependencies || {})\nexport default { external: externalDependencies }\n',
    )

    expect(repoUsesRolldown(repo)).toBe(false)
  })

  it('gates a Rolldown config when dependency code can be bundled', () => {
    const repo = makeRepo('export default { input: "src/index.mts" }\n')

    expect(repoUsesRolldown(repo)).toBe(true)
  })
})
