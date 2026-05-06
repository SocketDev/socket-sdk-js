# CLAUDE.md

🚨 **MANDATORY**: Act as principal-level engineer with deep expertise in TypeScript, Node.js, and SDK development.

<!-- BEGIN FLEET-CANONICAL — sync via socket-repo-template/scripts/sync-scaffolding.mts. Do not edit downstream. -->

## 📚 Fleet Standards

### Identifying users

Identify users by git credentials and use their actual name. Use "you/your" when speaking directly; use names when referencing contributions.

### Parallel Claude sessions

This repo may have multiple Claude sessions running concurrently against the same checkout, against parallel git worktrees, or against sibling clones. Several common git operations are hostile to that.

**Forbidden in the primary checkout:**

- `git stash` — shared store; another session can `pop` yours
- `git add -A` / `git add .` — sweeps files from other sessions
- `git checkout <branch>` / `git switch <branch>` — yanks the working tree out from under another session
- `git reset --hard` against a non-HEAD ref — discards another session's commits

**Required for branch work:** spawn a worktree.

```bash
git worktree add -b <task-branch> ../<repo>-<task> main
cd ../<repo>-<task>
# edit / commit / push from here; primary checkout is untouched
git worktree remove ../<repo>-<task>
```

**Required for staging:** surgical `git add <specific-file>`. Never `-A` / `.`.

**Never revert files you didn't touch.** If `git status` shows unfamiliar changes, leave them — they belong to another session, an upstream pull, or a hook side-effect.

The umbrella rule: never run a git command that mutates state belonging to a path other than the file you just edited.

### Public-surface hygiene

🚨 The four rules below have hooks that re-print the rule on every public-surface `git` / `gh` command. The rules apply even when the hooks are not installed.

- **Real customer / company names** — never write one into a commit, PR, issue, comment, or release note. Replace with `Acme Inc` or rewrite the sentence to not need the reference. (No enumerated denylist exists — a denylist is itself a leak.)
- **Private repos / internal project names** — never mention. Omit the reference entirely; don't substitute "an internal tool" — the placeholder is a tell.
- **Linear refs** — never put `SOC-123`/`ENG-456`/Linear URLs in code, comments, or PR text. Linear lives in Linear.
- **Publish / release / build-release workflows** — never `gh workflow run|dispatch` or `gh api …/dispatches`. Dispatches are irrevocable. The user runs them manually. Bypass: a `gh workflow run` with `-f dry-run=true` is allowed when the target workflow declares a `dry-run:` input under `workflow_dispatch.inputs` and no force-prod override (`-f release=true` / `-f publish=true` / `-f prod=true`) is set.
- **Workflow input naming** — `workflow_dispatch.inputs` keys are kebab-case (`dry-run`, `build-mode`), not snake_case. The release-workflow-guard hook only recognizes kebab; a `dry_run` input silently fails the dry-run bypass.

### Commits & PRs

- Conventional Commits `<type>(<scope>): <description>` — NO AI attribution.
- **When adding commits to an OPEN PR**, update the PR title and description to match the new scope. Use `gh pr edit <num> --title … --body …`. The reviewer should know what's in the PR without scrolling commits.
- **Replying to Cursor Bugbot** — reply on the inline review-comment thread, not as a detached PR comment: `gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies -X POST -f body=…`.

### Programmatic Claude calls

🚨 Workflows / skills / scripts that invoke `claude` CLI or `@anthropic-ai/claude-agent-sdk` MUST set all four lockdown flags: `tools`, `allowedTools`, `disallowedTools`, `permissionMode: 'dontAsk'`. Never `default` mode in headless contexts. Never `bypassPermissions`. See `.claude/skills/locking-down-programmatic-claude/SKILL.md`.

### Tooling

- **Package manager**: `pnpm`. Run scripts via `pnpm run foo --flag`, never `foo:bar`. After `package.json` edits, `pnpm install`.
- 🚨 NEVER use `npx`, `pnpm dlx`, or `yarn dlx` — use `pnpm exec <package>` or `pnpm run <script>` # socket-hook: allow npx
- **`packageManager` field** — bare `pnpm@<version>` is correct for pnpm 11+. pnpm 11 stores the integrity hash in `pnpm-lock.yaml` (separate YAML document) instead of inlining it in `packageManager`; on install pnpm rewrites the field to its bare form and migrates legacy inline hashes automatically. Don't fight the strip. Older repos may still ship `pnpm@<version>+sha512.<hex>` — leave it; pnpm migrates on first install. The lockfile is the integrity source of truth.
- **Monorepo internal `engines.node`** — only the workspace root needs `engines.node`. Private (`"private": true`) sub-packages in `packages/*` don't need their own `engines.node` field; the field is dead, drift-prone, and removing it is the cleaner play. Public-published sub-packages (the npm-published ones with no `"private": true`) keep their `engines.node` because external consumers see it.
- **Config files in `.config/`** — place tool / test / build configs in `.config/`: `taze.config.mts`, `vitest.config.mts`, `tsconfig.base.json` and other `tsconfig.*.json` variants, `esbuild.config.mts`. New configs go in `.config/` by default. Repo root keeps only what _must_ be there: package manifests + lockfile (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`), the linter / formatter dotfiles whose tools require root placement (`.oxlintrc.json`, `.oxfmtrc.json`, `.npmrc`, `.gitignore`, `.node-version`), and `tsconfig.json` itself (TypeScript's project root anchor — the rest of the tsconfig graph extends from `.config/tsconfig.base.json`).
- **Soak window** (pnpm-workspace.yaml `minimumReleaseAge`, default 7 days) — never add packages to `minimumReleaseAgeExclude` in CI. Locally, ASK before adding (security control).
- **Backward compatibility** — FORBIDDEN to maintain. Actively remove when encountered.

### No "pre-existing" excuse

🚨 If you see a lint error, type error, test failure, broken comment, or stale comment **anywhere in your reading window** — fix it. Don't label it "pre-existing" and skip past. The label is a tell that you're rationalizing avoiding work; the user reads "pre-existing" the same as "I noticed but chose not to."

The only exceptions:

- The fix is genuinely out of scope (a 2000-line refactor would derail a one-line bug fix). State the trade-off explicitly and ask before deferring.
- You don't have permission (the file belongs to another session per the parallel-Claude rule).

In all other cases: fix it in the same commit, or in a sibling commit on the same branch. Never assume someone else will get to it.

### Drift watch

🚨 **Drift across fleet repos is a defect, not a feature.** When you see two socket-\* repos pinning different versions of the same shared resource — a tool in `external-tools.json`, a workflow SHA, a CLAUDE.md fleet block, an action in `.github/actions/`, an upstream submodule SHA, a hook in `.claude/hooks/` — **opt for the latest**. The repo with the newer version is the source of truth; older repos catch up.

Where drift commonly hides:

- `external-tools.json` — pnpm/zizmor/sfw versions + per-platform sha256s
- `socket-registry/.github/actions/*` — composite-action SHAs pinned in consumer workflows
- `template/CLAUDE.md` `<!-- BEGIN FLEET-CANONICAL -->` block — must be byte-identical across the fleet
- `template/.claude/hooks/*` — same hook, same code
- xport.json `pinned_sha` rows — upstream submodules tracked by socket-btm
- `.gitmodules` `# name-version` annotations
- pnpm/Node `packageManager`/`engines` fields

How to check:

1. If you're editing one of these in repo A, grep the same thing in repos B/C/D. If A is older, bump A first; if A is newer, plan a sync to B/C/D.
2. `socket-registry`'s `setup-and-install` action is the canonical source for tool SHAs. Diverging from it is drift.
3. `socket-repo-template`'s `template/` tree is the canonical source for `.claude/`, CLAUDE.md fleet block, and hook code. Diverging is drift.
4. Run `pnpm run sync-scaffolding` (in repos that have it) to surface drift programmatically.

Never silently let drift sit. Either reconcile in the same PR or open a follow-up PR titled `chore(sync): cascade <thing> from <newer-repo>` and link it.

### Code style

- **Comments** — default to none. Write one only when the WHY is non-obvious to a senior engineer. **When you do write a comment, the audience is a junior dev**: explain the constraint, the hidden invariant, the "why this and not the obvious thing." Don't label it ("for junior devs:", "intuition:", etc.) — just write in that voice. No teacher-tone, no condescension, no flattering the reader.
- **Completion** — never leave `TODO` / `FIXME` / `XXX` / shims / stubs / placeholders. Finish 100%. If too large for one pass, ask before cutting scope.
- **`null` vs `undefined`** — use `undefined`. `null` is allowed only for `__proto__: null` or external API requirements.
- **Object literals** — `{ __proto__: null, ... }` for config / return / internal-state.
- **Imports** — no dynamic `await import()`. `node:fs` cherry-picks (`existsSync`, `promises as fs`); `path` / `os` / `url` / `crypto` use default imports. Exception: `fileURLToPath` from `node:url`.
- **HTTP** — never `fetch()`. Use `httpJson` / `httpText` / `httpRequest` from `@socketsecurity/lib/http-request`.
- **Subprocesses** — prefer async `spawn` from `@socketsecurity/lib/spawn` over `spawnSync` from `node:child_process`. Async unblocks parallel tests / event-loop work; the sync version freezes the runner for the duration of the child. Use `spawnSync` only when you genuinely need synchronous semantics (script bootstrapping, a hot loop where awaiting would invert control flow). When you do need stdin input: `const child = spawn(cmd, args, opts); child.stdin?.end(payload); const r = await child;` — the lib's `spawn` returns a thenable child handle, not a `{ input }` option. Throws `SpawnError` on non-zero exit; catch with `isSpawnError(e)` to read `e.code` / `e.stderr`.
- **File existence** — `existsSync` from `node:fs`. Never `fs.access` / `fs.stat`-for-existence / async `fileExists` wrapper.
- **File deletion** — route every delete through `safeDelete()` / `safeDeleteSync()` from `@socketsecurity/lib/fs`. Never `fs.rm` / `fs.unlink` / `fs.rmdir` / `rm -rf` directly — even for one known file. Prefer the async `safeDelete()` over `safeDeleteSync()` when the surrounding code is already async (test bodies, request handlers, build scripts that await elsewhere) — sync I/O blocks the event loop and there's no benefit when the caller is awaiting anyway. Reserve `safeDeleteSync()` for top-level scripts whose entire flow is sync.
- **Edits** — Edit tool, never `sed` / `awk`.
- **Inclusive language** — see [`docs/references/inclusive-language.md`](docs/references/inclusive-language.md) for the substitution table.
- **Sorting** — sort alphanumerically (literal byte order, ASCII before letters). Applies to: object property keys (config + return shapes + internal state — `__proto__: null` first); named imports inside a single statement (`import { a, b, c }`); `Set` / `SafeSet` constructor arguments; allowlists / denylists / config arrays / interface members. Position-bearing arrays (where index matters) keep their meaningful order. Full details in [`docs/references/sorting.md`](docs/references/sorting.md). When in doubt, sort.
- **`Promise.race` / `Promise.any` in loops** — never re-race a pool that survives across iterations (the handlers stack). See `.claude/skills/plug-leaking-promise-race/SKILL.md`.
- **`Safe` suffix** — non-throwing wrappers end in `Safe` (`safeDelete`, `safeDeleteSync`, `applySafe`, `weakRefSafe`). Read it as "X, but safe from throwing." The wrapper traps the thrown value internally and returns `undefined` (or the documented fallback). Don't invent alternative suffixes (`Try`, `OrUndefined`, `Maybe`) — pick `Safe`.
- **`node:smol-*` modules** — feature-detect, then require. From outside socket-btm (socket-lib, socket-cli, anywhere else): `import { isBuiltin } from 'node:module'; if (isBuiltin('node:smol-X')) { const mod = require('node:smol-X') }`. The `node:smol-*` namespace is provided by socket-btm's smol Node binary; on stock Node `isBuiltin` returns false and the require would throw. Wrap the loader in a `/*@__NO_SIDE_EFFECTS__*/` lazy-load that caches the result — see `socket-lib/src/smol/util.ts` and `socket-lib/src/smol/primordial.ts` for canonical shape. **Inside** socket-btm's `additions/source-patched/` JS (the smol binary's own bootstrap code), use `internalBinding('smol_X')` directly — that's the C++-binding access path and it's guaranteed available there.

### 1 path, 1 reference

A path is constructed exactly once. Everywhere else references the constructed value.

- **Within a package**: every script imports its own `scripts/paths.mts`. No `path.join('build', mode, …)` outside that module.
- **Across packages**: package B imports package A's `paths.mts` via the workspace `exports` field. Never `path.join(PKG, '..', '<sibling>', 'build', …)`.
- **Workflows / Dockerfiles / shell** can't `import` TS — construct once, reference by output / `ENV` / variable.

Three-level enforcement: `.claude/hooks/path-guard/` blocks at edit time; `scripts/check-paths.mts` is the whole-repo gate run by `pnpm check`; `/guarding-paths` is the audit-and-fix skill. Find the canonical owner and import from it.

### Background Bash

Never use `Bash(run_in_background: true)` for test / build commands (`vitest`, `pnpm test`, `pnpm build`, `tsgo`). Backgrounded runs you don't poll get abandoned and leak Node workers. Background mode is for dev servers and long migrations whose results you'll consume. If a run hangs, kill it: `pkill -f "vitest/dist/workers"`. The `.claude/hooks/stale-process-sweeper/` `Stop` hook reaps true orphans as a safety net.

### Judgment & self-evaluation

- If the request is based on a misconception, say so before executing.
- If you spot an adjacent bug, flag it: "I also noticed X — want me to fix it?"
- Fix warnings (lint / type / build / runtime) when you see them — don't leave them for later.
- **Default to perfectionist** when you have latitude. "Works now" ≠ "right."
- Before calling done: perfectionist vs. pragmatist views. Default perfectionist absent a signal.
- If a fix fails twice: stop, re-read top-down, state where the mental model was wrong, try something fundamentally different.

### Error messages

An error message is UI. The reader should fix the problem from the message alone. Four ingredients in order:

1. **What** — the rule, not the fallout (`must be lowercase`, not `invalid`).
2. **Where** — exact file / line / key / field / flag.
3. **Saw vs. wanted** — the bad value and the allowed shape or set.
4. **Fix** — one imperative action (`rename the key to …`).

Use `isError` / `isErrnoException` / `errorMessage` / `errorStack` from `@socketsecurity/lib/errors` over hand-rolled checks. Use `joinAnd` / `joinOr` from `@socketsecurity/lib/arrays` for allowed-set lists. Full guidance in [`docs/references/error-messages.md`](docs/references/error-messages.md).

### Token hygiene

🚨 Never emit the raw value of any secret to tool output, commits, comments, or replies. The `.claude/hooks/token-guard/` `PreToolUse` hook blocks the deterministic patterns (literal token shapes, env dumps, `.env*` reads, unfiltered `curl -H "Authorization:"`, sensitive-name commands without redaction). When the hook blocks a command, rewrite — don't bypass.

Behavior the hook can't catch: redact `token` / `jwt` / `access_token` / `refresh_token` / `api_key` / `secret` / `password` / `authorization` fields when citing API responses. Show key _names_ only when displaying `.env.local`. If a user pastes a secret, treat it as compromised and ask them to rotate.

Full hook spec in [`.claude/hooks/token-guard/README.md`](.claude/hooks/token-guard/README.md).

### Agents & skills

- `/scanning-security` — AgentShield + zizmor audit
- `/scanning-quality` — quality analysis
- Shared subskills in `.claude/skills/_shared/`

#### Skill scope: fleet vs partial vs unique

Every skill under `.claude/skills/` falls into one of three tiers — surface this distinction when adding a new skill so it lands in the right place:

- **Fleet skill** — present in every fleet repo, identical contract everywhere. Examples: `guarding-paths`, `scanning-quality`, `scanning-security`, `updating`, `locking-down-programmatic-claude`, `plug-leaking-promise-race`. New fleet skills land in `socket-repo-template/template/.claude/skills/<name>/` and cascade via `node socket-repo-template/scripts/sync-scaffolding.mts --all --fix`. Track them in `SHARED_SKILL_FILES` in the sync manifest.
- **Partial skill** — present in the subset of repos that need it, identical contract within that subset. Examples: `driving-cursor-bugbot` (every repo with PR review), `updating-xport` (every repo with `xport.json`), `squashing-history` (repos with the squash workflow). Live in each adopting repo's `.claude/skills/<name>/`. When you change one, propagate to the others.
- **Unique skill** — one repo only, bespoke to that repo's domain. Examples: `updating-cdxgen` (sdxgen), `updating-yoga` (socket-btm), `release` (socket-registry). Never canonical-tracked; the host repo owns it end-to-end.

Audit the current classification with `node socket-repo-template/scripts/run-skill-fleet.mts --list-skills`.

#### `updating` umbrella + `updating-*` siblings

`updating` is the canonical fleet umbrella that runs `pnpm run update` then discovers and runs every `updating-*` sibling skill the host repo registers. The umbrella is fleet-shared; the siblings are per-repo (or partial — e.g. `updating-xport` lives in every repo with `xport.json`). To add a new repo-specific update step, drop a new `.claude/skills/updating-<domain>/SKILL.md` and the umbrella picks it up automatically — no edits to `updating` itself.

#### Running skills across the fleet

`scripts/run-skill-fleet.mts` (in `socket-repo-template`) spawns one headless `claude --print` agent per fleet repo, in parallel (concurrency 4 by default), with the four lockdown flags set per the _Programmatic Claude calls_ rule above. Per-skill profile table maps known skills to sensible tool/allow/disallow lists; override with `--tools` / `--allow` / `--disallow`. Per-repo logs land in `.cache/fleet-skill/<timestamp>-<skill>/<repo>.log`. Use `Promise.allSettled` semantics — one repo's failure doesn't abort the rest.

```bash
pnpm run fleet-skill updating                       # update every fleet repo
pnpm run fleet-skill scanning-quality --concurrency 2 # slower, more conservative
pnpm run fleet-skill --list-skills                  # classify skills fleet/partial/unique
```

<!-- END FLEET-CANONICAL -->

## 🏗️ SDK-Specific

### Architecture

Socket SDK for JavaScript/TypeScript — programmatic access to Socket.dev security analysis.

- `src/index.ts` — entry
- `src/socket-sdk-class.ts` — SDK class with all API methods
- `src/http-client.ts` — request/response handling
- `src/types.ts` — TypeScript definitions
- `src/utils.ts` — shared utilities
- `src/constants.ts` — constants

Features: TypeScript support, API client, package analysis, security scanning, org/repo management, SBOM, batch operations, file uploads.

### Commands

- **Build**: `pnpm build` (`pnpm build --watch` for dev — 68% faster rebuilds)
- **Test**: `pnpm test`
- **Type check**: `pnpm run type`
- **Lint**: `pnpm run lint`
- **Check all**: `pnpm check`
- **Coverage**: `pnpm run cover`

### Configuration Files

Configs live in `.config/`:

| File                                 | Purpose                            |
| ------------------------------------ | ---------------------------------- |
| `tsconfig.json`                      | Main TS config (extends base)      |
| `.config/tsconfig.base.json`         | Base TS settings                   |
| `.config/tsconfig.check.json`        | Type checking for `type` command   |
| `.config/tsconfig.dts.json`          | Declaration file generation        |
| `.config/esbuild.config.mts`         | Build orchestration (ESM, node18+) |
| `.oxlintrc.json`                     | oxlint rules                       |
| `.oxfmtrc.json`                      | oxfmt formatting                   |
| `.config/vitest.config.mts`          | Main test config                   |
| `.config/vitest.config.isolated.mts` | Isolated tests (for `vi.doMock()`) |
| `.config/vitest.coverage.config.mts` | Shared coverage thresholds (≥99%)  |
| `.config/isolated-tests.json`        | List of tests requiring isolation  |
| `.config/taze.config.mts`            | Dependency update policies         |

### SDK-Specific Patterns

**Logger calls**: `logger.error()`/`logger.log()` must include empty string: `logger.error('')`, `logger.log('')`.

**File structure**:

- Extensions: `.mts` for TypeScript modules
- 🚨 MANDATORY `@fileoverview` headers
- ❌ FORBIDDEN `"use strict"` in `.mjs`/`.mts` (ES modules are strict)

**TypeScript**:

- Semicolons: Use them (unlike other Socket projects)
- ❌ FORBIDDEN `any`; use `unknown` or specific types
- Type imports: Always `import type` (separate statements, never inline `type` in value imports)
- Prefer `undefined` over `null`

**HTTP requests in SDK**:

- 🚨 NEVER use `fetch()` — use `createGetRequest`/`createRequestWithJson` from `src/http-client.ts`
  - `fetch()` bypasses the SDK's HTTP stack (retries, timeouts, hooks, agent config)
  - `fetch()` cannot be intercepted by nock in tests, forcing c8 ignore blocks
  - For external URLs (e.g., firewall API), pass a different `baseUrl` to `createGetRequest`

**Working directory**:

- 🚨 NEVER use `process.chdir()` — pass `{ cwd }` options with absolute paths instead

**Sorting (MANDATORY)**:

- Type properties: required first, then optional; alphabetical within groups
- Class members: 1) private properties, 2) private methods, 3) public methods (alphabetical)
- Object properties & destructuring: alphabetical (except semantic ordering)
- `Set` constructor arguments: `new Set([...])` literals are alphanumeric (runtime is order-insensitive)

### Testing

Two vitest configs:

- `.config/vitest.config.mts` — default
- `.config/vitest.config.isolated.mts` — full process isolation for `vi.doMock()`

**Structure**: `test/` for tests, `test/utils/` for shared helpers. Use descriptive names like `socket-sdk-upload-manifest.test.mts`.

**Helpers** (`test/utils/environment.mts`):

```typescript
// Recommended: combined nock setup + client creation
import { setupTestClient } from './utils/environment.mts'

describe('My tests', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })
  it('should work', async () => {
    const client = getClient()
  })
})
```

Also available: `setupTestEnvironment()` (nock only), `createTestClient()` (client only), `isCoverageMode` (flag).

**Running**:

- All: `pnpm test`
- Specific: `pnpm test <file>` (glob support)
- 🚨 **NEVER use `--` before test paths** — runs ALL tests
- Coverage: `pnpm run cover`

**Best practices**:

- Use `setupTestClient()` + `getClient()` pattern
- Mock HTTP with nock (cleaned automatically in beforeEach/afterEach)
- Test success + error paths
- Test cross-platform path handling
- See `test/unit/getapi-sendapi-methods.test.mts` for examples

**Test style — functional over source scanning**: NEVER read source files and assert on their contents (`.toContain('pattern')`). Write functional behavior tests.

### CI Testing

- 🚨 MANDATORY: `SocketDev/socket-registry/.github/workflows/ci.yml@<full-sha> # main`
- Custom runner: `scripts/test.mts` with glob expansion
- Memory: auto heap (CI 8GB, local 4GB)

### Debugging

- CI uses published npm packages, not local
- Package detection: use `existsSync()` not `fs.access()`
- Test failures: check unused nock mocks and cleanup

### SDK Notes

- Windows compatibility matters — test path handling
- Use utilities from `@socketsecurity/registry` where available
- Maintain consistency with surrounding code
