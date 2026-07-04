/* eslint-disable no-shadow -- nested cached-length for-loops intentionally reuse `i`/`length` names for the fleet-wide cached-loop idiom; renaming would diverge from the codebase pattern. */
/**
 * @file Canonical minimal test runner for socket-* repos. Delegates the
 *   scope-to-tests mapping to vitest itself rather than rolling a basename-
 *   based mapper that would inevitably drift from the actual module graph.
 *   Scope modes:
 *
 *   - `(default)` — local-dev scope. Runs `vitest --changed`, vitest's
 *     compare-vs-HEAD-with-uncommitted mode. Walks the actual import graph so a
 *     change to a util shared by many tests runs every affected test file, not
 *     the union of two guesses.
 *   - `--staged` — pre-commit hook scope. Hands `git diff --cached` filenames to
 *     `vitest related <files…> --run`. Same module-graph walk, but rooted at
 *     the staged delta. The `--run` flag is mandatory: `vitest related`
 *     defaults to watch mode just like the bare `vitest` invocation, which
 *     would hang the pre-commit hook.
 *   - `--all` — run the full suite (`vitest run`). Used in CI and on explicit
 *     opt-in. Flags: `--quiet` / `--silent` suppress progress output. Config /
 *     infrastructure changes (`vitest.config*`, `tsconfig*`, `.oxlintrc.json`,
 *     `.oxfmtrc.json`, `pnpm-lock.yaml`, `package.json`, the vitest setup
 *     files, and the test runner itself) still escalate to `all` — module-graph
 *     traversal doesn't capture config-derived discovery + alias changes. An
 *     ordinary source file under `scripts/` or `.config/` does NOT escalate;
 *     its tests are reachable via `vitest related`. See
 *     https://vitest.dev/guide/cli.html#vitest-related.
 */

// prefer-async-spawn: sync-required — top-level CLI runner; entire
// flow is sync (test runner invocation + exit-code aggregation).
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { WIN32 } from '@socketsecurity/lib-stable/constants/platform'
import { globSync } from '@socketsecurity/lib-stable/globs/match'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { spawnSync } from '@socketsecurity/lib-stable/process/spawn/child'
import type { SpawnSyncOptions } from '@socketsecurity/lib-stable/process/spawn/types'

import { resolveScopeMode } from './_shared/scope-flags.mts'

const logger = getDefaultLogger()

// Anchor on the script's own location, not process.cwd() (unstable in scripts/
// per `no-process-cwd-in-scripts-hooks`): the canonical runner lives at
// <repo>/scripts/fleet/test.mts, so the repo root is two directories up.
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)

// Resolve the vitest binary from the repo-root node_modules/.bin instead of
// `pnpm exec vitest` (fleet `no-pm-exec-guard`: `pnpm exec` is banned for its
// wrapper overhead — call the bin directly).
const VITEST_BIN = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  WIN32 ? 'vitest.cmd' : 'vitest',
)

// Root package.json marks a monorepo workspace. When the full suite runs in a
// workspace that has no root vitest config, a bare root `vitest run` discovers
// every package's config — including build artifacts + templates — and runs
// them without the per-package env wrappers (e.g. INLINED_* injection), which
// fails or hangs. Delegate to the per-package `test:unit` scripts instead.
const ROOT_WORKSPACE_MANIFEST = 'pnpm-workspace.yaml'

// The fleet-canonical vitest config lives at .config/repo/vitest.config.mts in
// single-package repos. A monorepo may have no root config — its configs live
// per package (packages/<pkg>/vitest.config.mts). Only pass `--config` when the
// root config actually exists; otherwise let vitest discover (per-package
// configs in a monorepo, or its own default). Hard-coding the flag broke
// `pnpm test` in monorepos with no root config (UNRESOLVED_ENTRY).
const ROOT_VITEST_CONFIG = '.config/repo/vitest.config.mts'

const args = process.argv.slice(2)
const mode = resolveScopeMode(args)
const quiet = args.includes('--quiet') || args.includes('--silent')
const stdio: SpawnSyncOptions['stdio'] = quiet ? 'pipe' : 'inherit'
// On Windows, `pnpm` is a .cmd shim that Node refuses to exec directly via
// spawnSync (CVE-2024-27980 hardening). Wrap through the shell on Windows
// only; POSIX keeps direct invocation.
const useShell = process.platform === 'win32'

// Paths that, when changed, force the full suite to run.
const ESCALATION_PATTERNS = [
  // Discovery / resolution config only — a change here is invisible to the
  // module-graph walk (no source file imports it) yet changes which tests run
  // or how specifiers resolve, so the scoped run can't be trusted. An ordinary
  // source file under scripts/ or .config/ is NOT here: its tests are reachable
  // via `vitest related`, so escalating on it just runs the whole suite for
  // nothing.
  /(?:^|\/)vitest\.config\.(?:js|mjs|mts|ts)$/,
  /(?:^|\/)vitest\.json$/,
  /(?:^|\/)tsconfig.*\.json$/,
  /(?:^|\/)package\.json$/,
  /^pnpm-lock\.yaml$/,
  /(?:^|\/)\.oxlintrc\.json$/,
  /(?:^|\/)\.oxfmtrc\.json$/,
  /^scripts\/fleet\/test\.mts$/,
  /(?:^|\/)test\/scripts\/(?:fleet|repo)\/setup\.mts$/,
  /^lockstep\.schema\.json$/,
]

function log(msg: string): void {
  if (!quiet) {
    logger.log(msg)
  }
}

function gitFiles(args: string[]): string[] {
  // spawnSync with array args — no shell interpolation. Matches the
  // socket/prefer-spawn-over-execsync rule contract.
  const r = spawnSync('git', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    stdioString: true,
  })
  if (r.status !== 0 || typeof r.stdout !== 'string') {
    return []
  }
  return r.stdout
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

function getStagedFiles(): string[] {
  return gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
}

function getModifiedFiles(): string[] {
  return gitFiles(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'])
}

// Untracked, non-ignored paths (git's "others"). Excluded from the staged run:
// `vitest related` walks the module graph from the staged files and would
// otherwise pull in a foreign, mid-write test another live actor hasn't
// committed yet — gating a staged commit on a file outside its own scope.
function getUntrackedFiles(): string[] {
  return gitFiles(['ls-files', '--others', '--exclude-standard'])
}

// Build the `vitest related` argv for the staged (pre-commit) run. Every
// untracked path is excluded so the run covers exactly the staged delta plus
// its TRACKED related tests — never a git-status-wide changed/untracked file.
// Pure (inputs passed in) so the scope rule is unit-tested without spawning
// vitest. `--exclude` applies to related-mode results (verified: it drops a
// discovered related test), so an untracked test is collected-then-dropped.
export function buildRelatedArgs(
  stagedFiles: readonly string[],
  untrackedFiles: readonly string[],
): string[] {
  return [
    'related',
    ...stagedFiles,
    '--run',
    '--passWithNoTests',
    '--no-file-parallelism',
    ...untrackedFiles.flatMap(f => ['--exclude', f]),
  ]
}

function shouldEscalate(files: string[]): boolean {
  for (let i = 0, { length } = files; i < length; i += 1) {
    const f = files[i]!
    for (let i = 0, { length } = ESCALATION_PATTERNS; i < length; i += 1) {
      const pattern = ESCALATION_PATTERNS[i]!
      if (pattern.test(f)) {
        return true
      }
    }
  }
  return false
}

function runVitest(
  vitestArgs: string[],
  label: string,
  options?: { env?: Record<string, string> | undefined },
): number {
  const opts = { __proto__: null, ...options } as {
    env?: Record<string, string> | undefined
  }
  log(`Test scope: ${label}`)
  const configArgs = existsSync(ROOT_VITEST_CONFIG)
    ? ['--config', ROOT_VITEST_CONFIG]
    : []
  const r = spawnSync(
    VITEST_BIN,
    [...vitestArgs, ...configArgs],
    // Windows shell-shim rationale: see useShell at file top.
    {
      shell: useShell,
      stdio,
      ...(opts.env ? { env: { ...process.env, ...opts.env } } : {}),
    },
  )
  if (r.status !== 0) {
    log('Tests failed')
    return 1
  }
  log('All tests passed')
  return 0
}

function runWorkspaceTests(): number {
  // `pnpm -r run` (recursive run, not the banned `pnpm exec`) invokes each
  // package's own test script, so every package runs under its configured env
  // wrapper / vitest config. `--if-present` skips packages lacking the script
  // (without it, ZERO matches is a hard `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`, not
  // the intended skip). Repos split unit from integration under `test:unit`;
  // most define only `test`. Try `test:unit`, then `test`, and FAIL LOUD if
  // neither script exists in any package — a delegated workspace that runs zero
  // tests is a silent green that proves nothing, worse than an error.
  for (const script of ['test:unit', 'test']) {
    const probe = spawnSync(
      'pnpm',
      ['-r', '--workspace-concurrency=1', 'run', '--if-present', script],
      { shell: useShell, stdio },
    )
    if (probe.status !== 0) {
      log('Tests failed')
      return 1
    }
    if (workspaceHasScript(script)) {
      log(`All tests passed (workspace per-package \`${script}\`)`)
      return 0
    }
  }
  log(
    'Tests failed: no workspace package defines a `test:unit` or `test` script — the delegated test path would run nothing. Add a `test` script to the package(s) under test.',
  )
  return 1
}

// True when at least one workspace package declares the given npm script.
// `pnpm -r run --if-present <s>` exits 0 even when zero packages match, so a
// green exit alone can't tell "all passed" from "nothing ran"; this scans the
// package manifests to disambiguate. Globs the manifests directly rather than
// parsing `pnpm -r list --json` (whose stdout the Socket Firewall wrapper
// prefixes with a banner, breaking JSON.parse and silently defeating the scan).
function workspaceHasScript(script: string): boolean {
  const manifests = globSync(['**/package.json'], {
    cwd: repoRoot,
    absolute: true,
    ignore: ['**/node_modules/**'],
  })
  for (let i = 0, { length } = manifests; i < length; i += 1) {
    try {
      const manifest = JSON.parse(readFileSync(manifests[i]!, 'utf8')) as {
        scripts?: Record<string, unknown> | undefined
      }
      if (manifest.scripts && script in manifest.scripts) {
        return true
      }
    } catch {
      // Unreadable / non-JSON manifest — skip it.
    }
  }
  return false
}

// A workspace with no root vitest config keeps its config + env wrappers (e.g.
// INLINED_* injection) per package. Root-level `vitest run` / `vitest related`
// / `vitest --changed` all bypass those wrappers, so any scoped run there fails
// or hangs. In that layout every scope delegates to per-package `test:unit`;
// the per-file related/changed filtering vitest would do at the root is the
// optimization that breaks, and a per-package full run is the safe trade.
function isDelegatedWorkspace(): boolean {
  return !existsSync(ROOT_VITEST_CONFIG) && existsSync(ROOT_WORKSPACE_MANIFEST)
}

function runAll(): number {
  if (isDelegatedWorkspace()) {
    return runWorkspaceTests()
  }
  return runVitest(['run'], 'all')
}

// --passWithNoTests: a scoped run where the changed files don't resolve
// to any test file should succeed rather than error with "No test files
// found". Keeps pre-commit hooks passing when an edit touches only
// non-testable code.
function runChanged(): number {
  return runVitest(['run', '--changed', '--passWithNoTests'], 'changed')
}

function runRelated(files: string[]): number {
  // `vitest related <files…>` defaults to watch mode; `--run` (in
  // buildRelatedArgs) forces a single non-watch execution. The staged files are
  // positionals; vitest walks the module graph from each, and every untracked
  // path is excluded so a foreign, mid-write test can't gate this commit.
  //
  // `--no-file-parallelism` (in buildRelatedArgs) forces a single worker for the
  // pre-commit (staged) run only — the root config's local default is a
  // 16-thread pool, which is both the worker-pool-deadlock surface (a hung
  // worker the parent waits on forever, seen as workers frozen at 0% CPU holding
  // .git/index.lock) and a CPU bomb when several Claude sessions share one
  // checkout and each spawns 16 threads. A single worker can't inter-worker-
  // starve, and N sessions × 1 thread is survivable. CI and `--all` keep full
  // parallelism (this flag is scoped to the staged path); the staged set is
  // small, so one worker is fine.
  return runVitest(
    buildRelatedArgs(files, getUntrackedFiles()),
    `staged (${files.length} file(s))`,
  )
}

// Explicit positional file paths → the fast, file-scoped run. This is the
// fleet-canonical replacement for a raw `node_modules/.bin/vitest run <file>`:
// `pnpm test <file…>` runs exactly those files (vitest `run <files>`), so no
// one ever needs to reach past the script to the bare binary. Flags (scope +
// --quiet/--silent) are filtered out; what remains is treated as file paths.
function fileArgs(): string[] {
  return args.filter(a => !a.startsWith('-'))
}

function runFiles(files: string[]): number {
  // `vitest run <files…>` executes exactly the named test files (no watch),
  // the fast path for "test this one file". --passWithNoTests keeps a path
  // that resolves to no test file from erroring.
  //
  // A template/ path is the CANONICAL copy, which the config excludes by
  // default (the cascaded live copy is what the suite runs). Setting
  // FLEET_TEST_TEMPLATE=1 lifts that one exclude so `pnpm test
  // template/base/…/x.test.mts` verifies a canonical test IN PLACE — before
  // the cascade — instead of forcing a commit + cascade just to run it.
  const includeTemplate = files.some(f => f.startsWith('template/'))
  return runVitest(
    ['run', ...files, '--passWithNoTests'],
    `files (${files.length})`,
    includeTemplate ? { env: { FLEET_TEST_TEMPLATE: '1' } } : undefined,
  )
}

function main(): void {
  const explicitFiles = fileArgs()
  if (explicitFiles.length > 0) {
    process.exitCode = runFiles(explicitFiles)
    return
  }

  if (mode === 'all') {
    process.exitCode = runAll()
    return
  }

  const files = mode === 'staged' ? getStagedFiles() : getModifiedFiles()

  if (files.length === 0) {
    log(`No ${mode} files; skipping tests.`)
    return
  }

  // No-root-config workspace: root-level scoped vitest bypasses per-package
  // env wrappers, so delegate every scope to per-package test:unit.
  if (isDelegatedWorkspace()) {
    process.exitCode = runWorkspaceTests()
    return
  }

  // `--staged` (pre-commit) NEVER escalates to the full suite: it is a fast,
  // bounded, non-blocking reminder, and escalating just burns the 60s budget
  // running a truncated full suite that proves nothing. Config-derived
  // discovery changes are validated by the full suite at pre-push + CI (the
  // real gates), not in the commit hook. Only the local-dev `changed` scope
  // escalates, where a thorough local run is worth the wait.
  if (mode !== 'staged' && shouldEscalate(files)) {
    log('Config files changed; escalating to full test suite.')
    process.exitCode = runAll()
    return
  }

  if (mode === 'staged') {
    process.exitCode = runRelated(files)
    return
  }

  // Working-tree changed → vitest's native --changed (it re-detects the
  // file list via git itself, including uncommitted edits).
  process.exitCode = runChanged()
}

// Entrypoint-guarded so importing this module (e.g. a unit test of
// buildRelatedArgs) doesn't kick off a vitest run.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
