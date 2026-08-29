#!/usr/bin/env node
/*
 * @file `check --all` gate: a literal path is constructed in ONE place.
 *   `paths.mts` owns every constructed path; a second file spelling the same
 *   `path.join(root, 'a', 'b')` is a second definition, so a move fixes one
 *   and strands the other.
 *
 *   Runs in the wheelhouse and in every member, because both carry a
 *   `paths.mts` and both drift the same way.
 *
 *   The existing duplicates are a BACKLOG, recorded in
 *   `scripts/fleet/constants/path-construction-burn-down.json`. The list is
 *   SHRINK-ONLY: a duplicate absent from it fails the gate, and a recorded
 *   tail that now scans clean is reported so the operator drops it. Adding an
 *   entry to quiet a new finding is the one move this design forbids.
 *
 *   Detection lives in `_shared/literal-path-tails.mts`, pure and unit-tested
 *   against source strings rather than a repo on disk.
 *
 *   Exit: 0 — no unrecorded duplicate; 1 — a new duplicate, or the burn-down
 *   holds a tail that is now clean.
 *
 *   Usage: node scripts/fleet/check/paths-are-constructed-once.mts [--quiet]
 *          node scripts/fleet/check/paths-are-constructed-once.mts --self-test
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { normalizePath } from '@socketsecurity/lib-stable/paths/normalize'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'

import { isMainModule } from '../_shared/is-main-module.mts'
import { runMain } from '../_shared/run-main.mts'
import { REPO_ROOT } from '../paths.mts'
import {
  diffAgainstBurnDown,
  findDuplicateTails,
} from './_shared/literal-path-tails.mts'

import type { ScriptMeta } from '../_shared/run-main.mts'

const BURN_DOWN_REL = path.join(
  'scripts',
  'fleet',
  'constants',
  'path-construction-burn-down.json',
)

const SCANNED_EXTENSIONS = ['.mts', '.ts', '.mjs', '.js']

/**
 * Whether a tracked file is one this gate reads.
 *
 * Generated and vendored trees are never gated, so a bundle repeating a tail
 * its own source owns is not a finding.
 */
export function isScannablePath(rel: string): boolean {
  const unix = normalizePath(rel)
  if (
    unix.includes('node_modules/') ||
    unix.includes('/dist/') ||
    unix.includes('_dist/') ||
    unix.startsWith('upstream/')
  ) {
    return false
  }
  // Tests are exempt. A test spells fixture paths that deliberately mirror the
  // layout it verifies, and a probe string may quote a `path.join` call as
  // DATA. Routing either through paths.mts would couple the test to the module
  // under test and give the scanner its own source to trip over.
  if (unix.startsWith('test/') || unix.includes('.test.')) {
    return false
  }
  return SCANNED_EXTENSIONS.some(ext => unix.endsWith(ext))
}

/**
 * Which `paths.mts` should own a tail.
 *
 * A path under a fleet-canonical root cascades to every member, so the fleet
 * module owns it and the repo chain inherits it through its `export *`. A
 * `.config/repo` tail that mirrors a `.config/fleet` one is the same fleet
 * path wearing a repo prefix, so it still defers to the fleet owner. Only a
 * path genuinely unique to this repo belongs in the repo module.
 */
export function ownerFor(tail: string): string {
  const fleetRoots = [
    '.claude/',
    '.config/fleet/',
    '.github/',
    'scripts/fleet/',
    'template/',
  ]
  return fleetRoots.some(root => tail.startsWith(root))
    ? 'scripts/fleet/paths.mts (fleet-canonical, inherited by the repo module)'
    : 'scripts/repo/_shared/paths.mts (repo-specific only; defer to the fleet module when a .config/fleet twin exists)'
}

/**
 * Read the recorded backlog, treating an absent file as an empty one so a
 * fresh member starts at zero rather than failing on a missing path.
 */
export function readBurnDown(repoRoot: string): string[] {
  const abs = path.join(repoRoot, BURN_DOWN_REL)
  if (!existsSync(abs)) {
    return []
  }
  const parsed: unknown = JSON.parse(readFileSync(abs, 'utf8'))
  if (!Array.isArray(parsed)) {
    return []
  }
  return parsed.filter((v): v is string => typeof v === 'string')
}

async function trackedSources(repoRoot: string): Promise<Map<string, string>> {
  const result = await spawn('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    stdioString: true,
  })
  const sources = new Map<string, string>()
  const rels = String(result.stdout ?? '').split('\0')
  for (let i = 0, { length } = rels; i < length; i += 1) {
    const rel = rels[i]!
    if (!rel || !isScannablePath(rel)) {
      continue
    }
    const abs = path.join(repoRoot, rel)
    if (!existsSync(abs)) {
      continue
    }
    sources.set(rel, readFileSync(abs, 'utf8'))
  }
  return sources
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> {
  const logger = getDefaultLogger()
  const quiet = argv.includes('--quiet')
  const selfTest = argv.includes('--self-test')

  const sources = await trackedSources(REPO_ROOT)
  const duplicates = findDuplicateTails(sources)
  const burnDown = readBurnDown(REPO_ROOT)
  const { added, cleared } = diffAgainstBurnDown(duplicates, burnDown)

  // `--self-test` proves the detector still fires. A gate whose matcher went
  // inert would otherwise report green forever.
  if (selfTest) {
    const probe = new Map([
      ['a.mts', "path.join(root, 'alpha', 'beta')"],
      ['b.mts', "path.join(other, 'alpha', 'beta')"],
    ])
    if (findDuplicateTails(probe).length !== 1) {
      logger.error(
        '[paths-are-constructed-once] SELF-TEST FAILED: a planted duplicate went undetected.',
      )
      return 1
    }
  }

  if (added.length) {
    logger.error('[paths-are-constructed-once] FAILED:')
    logger.group()
    for (let i = 0, { length } = added; i < length; i += 1) {
      const dup = added[i]!
      logger.fail(
        [
          `What: the path "${dup.tail}" is constructed in ${dup.files.length} files.`,
          `Where: ${dup.files.join(', ')}`,
          'Saw: the same literal segments spelled out more than once; wanted one owner.',
          `Fix: export it from ${ownerFor(dup.tail)}, then have every call site read that.`,
        ].join('\n'),
      )
    }
    logger.groupEnd()
    return 1
  }

  if (cleared.length) {
    logger.error(
      `[paths-are-constructed-once] ${cleared.length} burn-down entr(ies) now scan clean. Drop them from ${BURN_DOWN_REL}:`,
    )
    logger.group()
    for (let i = 0, { length } = cleared; i < length; i += 1) {
      logger.fail(cleared[i]!)
    }
    logger.groupEnd()
    return 1
  }

  if (!quiet) {
    logger.success(
      `[paths-are-constructed-once] no unrecorded duplicate path (${burnDown.length} in the burn-down)${selfTest ? '. Self-test passed.' : '.'}`,
    )
  }
  return 0
}

const SCRIPT_META: ScriptMeta = {
  describe:
    'checks a literal path is constructed once, with a shrink-only burn-down for the backlog',
  help: 'Usage: node scripts/fleet/check/paths-are-constructed-once.mts [--quiet] [--self-test]',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
