import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDeleteSync } from '@socketsecurity/lib-stable/fs/safe'
import { describe, expect, it } from 'vitest'

import { planFetch } from '../../../scripts/repo/bootstrap/fetch-session.mts'

describe('session payload planning', () => {
  it('distinguishes absent fetcher, required hydration, and an existing payload', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sdk-session-plan-'))
    try {
      expect(planFetch(directory)).toEqual({ action: 'no-fetcher' })
      const fetcher = path.join(directory, 'scripts/repo/bootstrap/fleet.mjs')
      await mkdir(path.dirname(fetcher), { recursive: true })
      await writeFile(fetcher, '')
      expect(planFetch(directory)).toEqual({ action: 'fetch', fleet: fetcher })
      const sentinel = path.join(directory, '.claude/hooks/fleet/index.cjs')
      await mkdir(path.dirname(sentinel), { recursive: true })
      await writeFile(sentinel, '')
      expect(planFetch(directory)).toEqual({ action: 'present' })
    } finally {
      safeDeleteSync(directory)
    }
  })
})
