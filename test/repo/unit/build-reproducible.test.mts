/**
 * @file Determinism guard for the rolldown bundle. The publish-pipeline
 *   `--reconcile` path cuts a version's tag + GH release only when a LOCAL
 *   re-pack byte-matches the published npm tarball, so the bundle MUST be
 *   byte-reproducible run-to-run — otherwise a re-pack diverges and reconcile
 *   refuses. This builds each rolldown config twice into isolated temp dirs and
 *   asserts the emitted bytes (including the content-hashed chunk names) are
 *   identical between runs. A future config/toolchain change that reintroduces
 *   non-determinism (a timestamp banner, an unstable chunk hash, order churn)
 *   fails here instead of silently breaking the next reconcile.
 *
 * @vitest-environment node
 */

import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { rolldown } from 'rolldown'
import { afterAll, describe, expect, it } from 'vitest'

import { buildConfig } from '../../../.config/repo/rolldown.config.mts'
import { browserBuildConfig } from '../../../.config/repo/rolldown.browser.config.mts'

import type { RolldownOptions } from 'rolldown'

const tempDirs: string[] = []

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { force: true, recursive: true })
  }
})

// name → sha256 of every emitted file (recursive), so a comparison captures
// content AND the content-hashed chunk file names.
function hashOutputDir(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const full = path.join(current, entry)
      const rel = prefix ? `${prefix}/${entry}` : entry
      if (statSync(full).isDirectory()) {
        walk(full, rel)
      } else {
        out[rel] = createHash('sha256').update(readFileSync(full)).digest('hex')
      }
    }
  }
  walk(dir, '')
  return out
}

async function buildInto(
  config: RolldownOptions & { output: { dir?: string | undefined } },
): Promise<Record<string, string>> {
  const dir = mkdtempSync(path.join(tmpdir(), 'sdk-repro-'))
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

describe('bundle is byte-reproducible', () => {
  it('produces byte-identical node output across two builds', async () => {
    const first = await buildInto(buildConfig)
    const second = await buildInto(buildConfig)
    expect(Object.keys(first).length).toBeGreaterThan(0)
    expect(second).toEqual(first)
  }, 60_000)

  it('produces byte-identical browser output across two builds', async () => {
    const first = await buildInto(browserBuildConfig)
    const second = await buildInto(browserBuildConfig)
    expect(Object.keys(first).length).toBeGreaterThan(0)
    expect(second).toEqual(first)
  }, 60_000)
})
