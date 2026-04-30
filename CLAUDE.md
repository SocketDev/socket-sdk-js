# CLAUDE.md

🚨 **MANDATORY**: Act as principal-level engineer with deep expertise in TypeScript, Node.js, and SDK development.

<!-- BEGIN FLEET-CANONICAL — sync via socket-repo-template/scripts/sync-scaffolding.mjs. Do not edit downstream. -->

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
- **Publish / release / build-release workflows** — never `gh workflow run|dispatch` or `gh api …/dispatches`. Dispatches are irrevocable. The user runs them manually.

### Commits & PRs

- Conventional Commits `<type>(<scope>): <description>` — NO AI attribution.
- **When adding commits to an OPEN PR**, update the PR title and description to match the new scope. Use `gh pr edit <num> --title … --body …`. The reviewer should know what's in the PR without scrolling commits.
- **Replying to Cursor Bugbot** — reply on the inline review-comment thread, not as a detached PR comment: `gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies -X POST -f body=…`.

### Programmatic Claude calls

🚨 Workflows / skills / scripts that invoke `claude` CLI or `@anthropic-ai/claude-agent-sdk` MUST set all four lockdown flags: `tools`, `allowedTools`, `disallowedTools`, `permissionMode: 'dontAsk'`. Never `default` mode in headless contexts. Never `bypassPermissions`. See `.claude/skills/programmatic-claude-lockdown/SKILL.md`.

### Tooling

- **Package manager**: `pnpm`. Run scripts via `pnpm run foo --flag`, never `foo:bar`. After `package.json` edits, `pnpm install`.
- 🚨 NEVER use `npx`, `pnpm dlx`, or `yarn dlx` — use `pnpm exec <package>` or `pnpm run <script>` # socket-hook: allow npx
- **`minimumReleaseAge`** — never add packages to `minimumReleaseAgeExclude` in CI. Locally, ASK before adding (security control).
- **Backward compatibility** — FORBIDDEN to maintain. Actively remove when encountered.

### Code style

- **Comments** — default to none. Write one only when the WHY is non-obvious to a senior engineer.
- **Completion** — never leave `TODO` / `FIXME` / `XXX` / shims / stubs / placeholders. Finish 100%. If too large for one pass, ask before cutting scope.
- **`null` vs `undefined`** — use `undefined`. `null` is allowed only for `__proto__: null` or external API requirements.
- **Object literals** — `{ __proto__: null, ... }` for config / return / internal-state.
- **Imports** — no dynamic `await import()`. `node:fs` cherry-picks (`existsSync`, `promises as fs`); `path` / `os` / `url` / `crypto` use default imports. Exception: `fileURLToPath` from `node:url`.
- **HTTP** — never `fetch()`. Use `httpJson` / `httpText` / `httpRequest` from `@socketsecurity/lib/http-request`.
- **File existence** — `existsSync` from `node:fs`. Never `fs.access` / `fs.stat`-for-existence / async `fileExists` wrapper.
- **File deletion** — route every delete through `safeDelete()` / `safeDeleteSync()` from `@socketsecurity/lib/fs`. Never `fs.rm` / `fs.unlink` / `fs.rmdir` / `rm -rf` directly — even for one known file.
- **Edits** — Edit tool, never `sed` / `awk`.
- **Inclusive language** — see [`docs/references/inclusive-language.md`](docs/references/inclusive-language.md) for the substitution table.
- **Sorting** — sort lists alphanumerically; details in [`docs/references/sorting.md`](docs/references/sorting.md). When in doubt, sort.
- **`Promise.race` / `Promise.any` in loops** — never re-race a pool that survives across iterations (the handlers stack). See `.claude/skills/promise-race-pitfall/SKILL.md`.

### 1 path, 1 reference

A path is constructed exactly once. Everywhere else references the constructed value.

- **Within a package**: every script imports its own `scripts/paths.mts`. No `path.join('build', mode, …)` outside that module.
- **Across packages**: package B imports package A's `paths.mts` via the workspace `exports` field. Never `path.join(PKG, '..', '<sibling>', 'build', …)`.
- **Workflows / Dockerfiles / shell** can't `import` TS — construct once, reference by output / `ENV` / variable.

Three-level enforcement: `.claude/hooks/path-guard/` blocks at edit time; `scripts/check-paths.mts` is the whole-repo gate run by `pnpm check`; `/path-guard` is the audit-and-fix skill. Find the canonical owner and import from it.

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

- `/security-scan` — AgentShield + zizmor audit
- `/quality-scan` — quality analysis
- Shared subskills in `.claude/skills/_shared/`

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
