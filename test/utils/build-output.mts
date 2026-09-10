import crypto from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { rolldown } from 'rolldown'
import { afterAll } from 'vitest'

import type { OutputOptions, RolldownOptions } from 'rolldown'
import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'

const tempDirs: string[] = []

afterAll(async () => {
  for (let i = 0, { length } = tempDirs; i < length; i += 1) {
    const dir = tempDirs[i]!
    await safeDelete(dir)
  }
})

// name → sha256 of every emitted file (recursive), so a comparison captures
// content AND the content-hashed chunk file names.
function hashOutputDir(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (current: string, prefix: string): void => {
    const entries = readdirSync(current).toSorted()
    for (let index = 0, { length } = entries; index < length; index += 1) {
      const entry = entries[index]!
      const full = path.join(current, entry)
      const rel = prefix ? `${prefix}/${entry}` : entry
      if (statSync(full).isDirectory()) {
        walk(full, rel)
      } else {
        out[rel] = crypto
          .createHash('sha256')
          .update(readFileSync(full))
          .digest('hex')
      }
    }
  }
  walk(dir, '')
  return out
}

export async function buildInto(
  config: Omit<RolldownOptions, 'output'> & { output: OutputOptions },
): Promise<Record<string, string>> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sdk-repro-'))
  tempDirs.push(dir)
  const { output, ...inputOptions } = config
  const bundle = await rolldown(inputOptions)
  try {
    await bundle.write({ ...output, dir })
  } finally {
    await bundle.close()
  }
  return hashOutputDir(dir)
}
