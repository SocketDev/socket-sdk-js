import process from 'node:process'

import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { describe, expect, it } from 'vitest'

describe('API documentation generation', () => {
  it('keeps the checked-in reference current', async () => {
    const result = spawn(
      process.execPath,
      ['scripts/repo/gen-api-docs.mts', '--check'],
      { cwd: process.cwd() },
    )

    await expect(result).resolves.toMatchObject({ code: 0 })
  })
})
