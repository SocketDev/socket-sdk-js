/**
 * @file Generated strict-type exports follow the current module path.
 */

import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDeleteSync } from '@socketsecurity/lib-stable/fs/safe'
import { afterEach, describe, expect, it } from 'vitest'

import { updateIndexExports } from '../../../scripts/repo/generate-strict-types.mts'

const fixtureDirs: string[] = []

afterEach(() => {
  for (const directory of fixtureDirs.splice(0)) {
    safeDeleteSync(directory)
  }
})

describe('updateIndexExports', () => {
  it('refreshes strict exports while preserving runtime exports', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sdk-type-exports-'))
    fixtureDirs.push(directory)
    const indexPath = path.join(directory, 'index.mts')
    await writeFile(
      indexPath,
      "export type { OrganizationsResult } from './types/strict.mts'\nexport { SocketSdk } from './socket-sdk-class.mts'\n",
    )
    await updateIndexExports({ indexPath })
    const generated = await readFile(indexPath, 'utf8')
    expect(generated).toContain('DeleteRepositoryLabelResult')
    expect(generated).toContain("from './types/strict.mts'")
    expect(generated).toContain(
      "export { SocketSdk } from './socket-sdk-class.mts'",
    )
  })
})
