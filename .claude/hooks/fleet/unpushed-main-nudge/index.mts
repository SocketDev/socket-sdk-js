#!/usr/bin/env node
// Claude Code Stop hook — unpushed-main-nudge.
//
// Fires at turn-end. When the current checkout is ON the default branch
// (main / master) and local HEAD is AHEAD of its origin counterpart, it
// nags to push.
//
// Why: a commit fast-forwarded to local `main` but left unpushed is
// fragile. A parallel Claude session running `git reset --hard
// origin/main` (cascade / repair flows do this) discards every local-only
// commit ahead of origin — the work silently vanishes. "Landing" a commit
// means it reached ORIGIN, not just local main. This reminder makes the
// at-risk gap visible at the turn that created it, so the push happens
// before the next reset.
//
// Only fires on the default branch: an unpushed feature branch is normal
// (you push it when ready); an unpushed DEFAULT branch ahead of origin is
// the reset-wipe hazard.
//
// Exit codes: 0 — always (informational Stop hook). Fails open.

import process from 'node:process'

import {
  currentBranch,
  gitOut,
  isDefaultBranch,
} from '../_shared/git-branch.mts'
import { defineHook, notify, runHook } from '../_shared/guard.mts'

export function getProjectDir(): string {
  return process.env['CLAUDE_PROJECT_DIR'] || process.cwd()
}

// Count of local commits ahead of origin/<branch>, or 0 when no upstream.
export function commitsAhead(repoDir: string, branch: string): number {
  const out = gitOut(repoDir, ['rev-list', '--count', `origin/${branch}..HEAD`])
  if (out === undefined) {
    return 0
  }
  const n = Number.parseInt(out, 10)
  /* c8 ignore next -- git rev-list --count always returns an integer on success; the NaN arm is a defensive fallback unreachable in practice */
  return Number.isFinite(n) ? n : 0
}

export const check = async () => {
  const repoDir = getProjectDir()
  const branch = currentBranch(repoDir)
  if (!branch || !isDefaultBranch(repoDir, branch)) {
    return undefined
  }
  const ahead = commitsAhead(repoDir, branch)
  if (ahead < 1) {
    return undefined
  }
  return notify(
    [
      `[unpushed-main-nudge] ${branch} is ${ahead} commit(s) ahead of origin/${branch} — UNPUSHED.`,
      '',
      'A local fast-forward is NOT landed. A parallel session that resets',
      `${branch} to origin/${branch} (cascade / repair flows do this) will wipe`,
      'these commits. Push now so the work survives:',
      `    git push origin ${branch}`,
      '',
    ].join('\n'),
  )
}

export const hook = defineHook({
  check,
  event: 'Stop',
  type: 'nudge',
})

void runHook(hook, import.meta.url)
