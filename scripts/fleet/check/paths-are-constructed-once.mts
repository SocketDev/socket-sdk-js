#!/usr/bin/env node
import { sharedTemplateBasePath } from '../paths/util.mts'

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { hasSourceExtension } from '../constants/source-extensions.mts'
import { normalizePath } from '@socketsecurity/lib-stable/paths/normalize'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'

import { isMainModule } from '../process/is-main-module.mts'
import { runMain } from '../process/run-main.mts'
import { REPO_ROOT } from '../paths.mts'
import { isCascadeMirrorPath } from '../fs/cascade-mirror-scope.mts'
import { findDuplicateTails } from './_shared/literal-path-tails.mts'

import type { ScriptMeta } from '../process/run-main.mts'

const logger = getDefaultLogger()

/**
 * How far into a file the dep-0 declaration must appear to count.
 */
const DEP_ZERO_HEADER_CHARS = 2000

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
  if (
    unix.startsWith('test/') ||
    unix.includes('/test/') ||
    unix.includes('.test.')
  ) {
    return false
  }
  return hasSourceExtension(unix)
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
 * Whether a source declares itself dep-0, so it may not import a path module.
 *
 * A dep-0 script runs with no guaranteed `node_modules` — the bootstrap and
 * setup entry points run before an install has ever happened. Importing
 * `paths.mts` there breaks the very step that would create it, so a literal
 * path cannot depend on the shared module.
 */
export function declaresDepZero(source: string): boolean {
  return /\bdep-0\b/i.test(source.slice(0, DEP_ZERO_HEADER_CHARS))
}

async function trackedSources(repoRoot: string): Promise<Map<string, string>> {
  const result = await spawn('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    stdioString: true,
  })
  const sources = new Map<string, string>()
  const isProducer = existsSync(sharedTemplateBasePath(repoRoot))
  const rels = String(result.stdout ?? '').split('\0')
  for (let i = 0, { length } = rels; i < length; i += 1) {
    const rel = rels[i]!
    if (
      !rel ||
      !isScannablePath(rel) ||
      (isProducer && isCascadeMirrorPath(rel))
    ) {
      continue
    }
    const abs = path.join(repoRoot, rel)
    if (!existsSync(abs)) {
      continue
    }
    const source = readFileSync(abs, 'utf8')
    if (declaresDepZero(source)) {
      continue
    }
    sources.set(rel, source)
  }
  return sources
}

export async function main(
  options?: { readonly argv?: readonly string[] | undefined } | undefined,
): Promise<number> {
  const { argv = process.argv.slice(2) } = {
    __proto__: null,
    ...options,
  } as { argv?: readonly string[] | undefined }
  const quiet = argv.includes('--quiet')
  const selfTest = argv.includes('--self-test')

  const sources = await trackedSources(REPO_ROOT)
  const duplicates = findDuplicateTails(sources)

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

  if (duplicates.length) {
    logger.error('[paths-are-constructed-once] FAILED:')
    logger.group()
    for (let i = 0, { length } = duplicates; i < length; i += 1) {
      const dup = duplicates[i]!
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

  if (!quiet) {
    logger.success(
      `[paths-are-constructed-once] no duplicate path${selfTest ? '. Self-test passed.' : '.'}`,
    )
  }
  return 0
}

const SCRIPT_META: ScriptMeta = {
  describe: 'checks a literal path is constructed once',
  help: 'Usage: node scripts/fleet/check/paths-are-constructed-once.mts [--quiet] [--self-test]',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
