#!/usr/bin/env node
/*
 * @file `check --all` gate: a repo-OWNED path under `.claude/` is never
 *   gitignored. The fleet-pack untrack set exists so a thin member does not
 *   commit the payload it fetches from the release bundle, and every entry it
 *   writes sits under a `fleet/` segment. The repo-owned half of the same
 *   directories is the member's own work and must live in its history.
 *
 *   Why a gate rather than a convention: an ignored file is invisible. It
 *   survives in a working tree, reads as present to every local command, and
 *   vanishes from every clone. A hook was authored, documented in the registry,
 *   and never dispatched for exactly this reason - it existed only as an
 *   untracked file, so no checkout but one ever had it. Nothing failed loudly;
 *   the work was simply gone.
 *
 *   Segregated directories: `.claude/{agents,commands,hooks,rules,skills}/` are
 *   split `fleet/` vs `repo/`, so only the `repo/` half is asserted.
 *   `.claude/output-styles/` carries no such split - it is repo-owned whole, so
 *   every path under it is asserted.
 *
 *   The check asks git, never a re-listed copy of the ignore patterns: it runs
 *   `git check-ignore` over the candidate paths, so a rule reaching them by any
 *   route - the fleet block, a repo-owned block, a stray hand-added line, a
 *   parent-directory pattern - is caught the same way.
 *
 *   Runs per-tree (wheelhouse + every member). Fails open when git is
 *   unavailable. Exit: 0 - clean / no git; 1 - a repo-owned path is ignored.
 *
 *   Usage: node scripts/fleet/check/repo-owned-claude-paths-are-tracked.mts [--quiet]
 */

import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { normalizePath } from '@socketsecurity/lib-stable/paths/normalize'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'

import { REPO_ROOT } from '../paths.mts'
import { isMainModule } from '../_shared/is-main-module.mts'
import { runMain } from '../_shared/run-main.mts'

import type { ScriptMeta } from '../_shared/run-main.mts'

const logger = getDefaultLogger()

// Paths per `git check-ignore` invocation. Well under every platform's ARG_MAX
// while keeping the number of spawns small.
const CHECK_IGNORE_BATCH = 500

/**
 * `.claude/` directories split into a `fleet/` half and a `repo/` half. Only
 * the `repo/` half is the member's own work; the `fleet/` half is bundle
 * payload the untrack set is entitled to ignore.
 */
export const SEGREGATED_CLAUDE_DIRS: readonly string[] = [
  '.claude/agents',
  '.claude/commands',
  '.claude/hooks',
  '.claude/rules',
  '.claude/skills',
]

/**
 * `.claude/` directories with no fleet/repo split. Repo-owned in whole, so
 * every path beneath them is asserted.
 */
export const REPO_OWNED_CLAUDE_DIRS: readonly string[] = [
  '.claude/output-styles',
]

/**
 * Whether `filePath` is repo-owned and therefore must never be ignored.
 *
 * A segregated directory contributes only its `repo/` subtree. An unsplit
 * directory contributes everything under it.
 */
export function isRepoOwnedClaudePath(
  filePath: string,
  config: {
    readonly repoOwnedDirs: readonly string[]
    readonly segregatedDirs: readonly string[]
  },
): boolean {
  const p = normalizePath(filePath)
  const { repoOwnedDirs, segregatedDirs } = config
  for (let i = 0, { length } = segregatedDirs; i < length; i += 1) {
    if (p.startsWith(`${segregatedDirs[i]!}/repo/`)) {
      return true
    }
  }
  for (let i = 0, { length } = repoOwnedDirs; i < length; i += 1) {
    if (p.startsWith(`${repoOwnedDirs[i]!}/`)) {
      return true
    }
  }
  return false
}

/**
 * Every `.claude` path present on disk, tracked or not.
 *
 * Untracked files are included deliberately: a file that is both untracked and
 * ignored is the exact shape this gate exists to catch, and listing only
 * tracked files would make it invisible.
 */
async function candidatePaths(): Promise<string[] | undefined> {
  try {
    const result = (await spawn(
      'git',
      ['ls-files', '--cached', '--others', '--', '.claude'],
      { cwd: REPO_ROOT, stdio: 'pipe', stdioString: true },
    )) as { stdout?: string | undefined }
    return String(result?.stdout ?? '')
      .split(/\r?\n/)
      .filter(line => line !== '')
  } catch {
    return undefined
  }
}

/**
 * The subset of `paths` git reports as ignored.
 *
 * `check-ignore` answers from the full rule set, so a path ignored by a parent
 * pattern or a hand-added line is reported the same as one in the fleet block.
 */
export async function ignoredAmong(
  paths: readonly string[],
): Promise<string[]> {
  const found: string[] = []
  // Paths ride as ARGUMENTS, never `--stdin`. The stdin form waits for a
  // writer, and a caller that does not close the pipe hangs the gate rather
  // than failing it - measured, as a ten-minute timeout.
  for (let i = 0; i < paths.length; i += CHECK_IGNORE_BATCH) {
    const batch = paths.slice(i, i + CHECK_IGNORE_BATCH)
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = (await spawn('git', ['check-ignore', '--', ...batch], {
        cwd: REPO_ROOT,
        stdio: 'pipe',
        stdioString: true,
      })) as { stdout?: string | undefined }
      const lines = String(result?.stdout ?? '').split(/\r?\n/)
      for (let j = 0, { length } = lines; j < length; j += 1) {
        const line = lines[j]!
        if (line !== '') {
          found.push(normalizePath(line))
        }
      }
    } catch {
      // `check-ignore` exits non-zero when nothing in the batch matches, which
      // the spawn wrapper raises. No match is the clean case.
    }
  }
  return found
}

async function main(): Promise<void> {
  const paths = await candidatePaths()
  if (paths === undefined) {
    process.exitCode = 0
    return
  }
  const repoOwned = paths.filter(p =>
    isRepoOwnedClaudePath(p, {
      repoOwnedDirs: REPO_OWNED_CLAUDE_DIRS,
      segregatedDirs: SEGREGATED_CLAUDE_DIRS,
    }),
  )
  const violations = await ignoredAmong(repoOwned)
  if (violations.length === 0) {
    if (!process.argv.includes('--quiet')) {
      logger.log(
        'repo-owned-claude-paths-are-tracked: no repo-owned .claude path is ignored.',
      )
    }
    process.exitCode = 0
    return
  }
  logger.fail(
    `repo-owned-claude-paths-are-tracked: ${violations.length} repo-owned path(s) are gitignored:`,
  )
  logger.group()
  for (let i = 0, { length } = violations; i < length; i += 1) {
    logger.fail(violations[i]!)
  }
  logger.groupEnd()
  logger.fail(
    'What:  a repo-owned .claude path is ignored, so it lives in one working tree and no clone.',
  )
  logger.fail(
    'Where: the rule matching it - `git check-ignore -v <path>` names the file and line.',
  )
  logger.fail(
    'Fix:   remove that pattern. The fleet-pack untrack set covers `fleet/` payload only; a `repo/` path, or anything under .claude/output-styles/, belongs in git.',
  )
  process.exitCode = 1
}

const SCRIPT_META: ScriptMeta = {
  describe: 'verifies no repo-owned .claude path is gitignored',
  help: `Usage: node scripts/fleet/check/repo-owned-claude-paths-are-tracked.mts [flags]

  --quiet  suppress the success message`,
}

/* c8 ignore start - entrypoint guard; exercised via subprocess */
if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
/* c8 ignore stop */
