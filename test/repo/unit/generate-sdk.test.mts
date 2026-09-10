import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDeleteSync } from '@socketsecurity/lib-stable/fs/safe'
import { describe, expect, it } from 'vitest'

import { addSdkMethodAliases } from '../../../scripts/repo/generate-sdk.mts'

describe('SDK operation aliases', () => {
  it('adds aliases inside the operation interface while preserving existing definitions', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sdk-aliases-'))
    try {
      const file = path.join(directory, 'api.d.ts')
      await writeFile(
        file,
        'export interface operations {\n  getOrganizations: { result: string }\n}\n',
      )
      await addSdkMethodAliases(file)
      const output = await readFile(file, 'utf8')
      expect(output).toContain('getOrganizations: { result: string }')
      expect(output).toContain(
        "listOrganizations: operations['getOrganizations']",
      )
      expect(output.trimEnd().endsWith('}')).toBe(true)
    } finally {
      safeDeleteSync(directory)
    }
  })
})
