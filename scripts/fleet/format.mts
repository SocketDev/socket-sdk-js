/**
 * @file Canonical formatter for socket-* repos — the `format` / `format:check`
 *   package.json scripts route through here. Runs oxfmt over the working tree
 *   (or the file paths you pass) WITH the fleet `--ignore-path`, so it formats
 *   exactly the set the lint gate checks and never the whole tree raw.
 *   Why this script exists instead of an inline `oxfmt … .`: a bare
 *   `oxfmt --write .` omits `--ignore-path` and reformats `.claude/`, the
 *   `.agents/` mirror, vendored trees, and markdown that markdownlint owns —
 *   hundreds of files the gate never checks. The argv (including the
 *   non-negotiable `--ignore-path`) is built by `buildOxfmtArgs` in
 *   `_shared/format-scope.mts`, shared with `lint.mts`.
 *   Usage: `node scripts/fleet/format.mts` writes; `--check` verifies; trailing
 *   paths scope the run to those files.
 */

// prefer-async-spawn: sync-required — top-level CLI runner, single oxfmt gate.
import { spawnSync } from '@socketsecurity/lib-stable/process/spawn/child'
import process from 'node:process'

import { buildOxfmtArgs } from './_shared/format-scope.mts'

// On Windows, `pnpm` is a .cmd shim Node refuses to exec directly via spawnSync
// (CVE-2024-27980 hardening); the shell wrapper resolves it. On POSIX we keep
// direct invocation so no shell-quoting surface is introduced.
const useShell = process.platform === 'win32'

function main(): void {
  const argv = process.argv.slice(2)
  const check = argv.includes('--check')
  const files = argv.filter(arg => !arg.startsWith('--'))
  const res = spawnSync('pnpm', buildOxfmtArgs({ check, files }), {
    shell: useShell,
    stdio: 'inherit',
  })
  process.exitCode = res.status ?? 1
}

main()
