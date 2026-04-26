# CLAUDE.md

🚨 **MANDATORY**: Act as principal-level engineer with deep expertise in TypeScript, Node.js, and SDK development.

## USER CONTEXT

- Identify users by git credentials; use their actual name, never "the user"
- Use "you/your" when speaking directly; use names when referencing contributions

## 🚨 PARALLEL CLAUDE SESSIONS - WORKTREE REQUIRED

**This repo may have multiple Claude sessions running concurrently against the same checkout, against parallel git worktrees, or against sibling clones.** Several common git operations are hostile to that and silently destroy or hijack the other session's work.

- **FORBIDDEN in the primary checkout** (the one another Claude may be editing):
  - `git stash` — shared stash store; another session can `pop` yours.
  - `git add -A` / `git add .` — sweeps files belonging to other sessions.
  - `git checkout <branch>` / `git switch <branch>` — yanks the working tree out from under another session.
  - `git reset --hard` against a non-HEAD ref — discards another session's commits.
- **REQUIRED for branch work**: spawn a worktree instead of switching branches in place. Each worktree has its own HEAD, so branch operations inside it are safe.

  ```bash
  # From the primary checkout — does NOT touch the working tree here.
  git worktree add -b <task-branch> ../<repo>-<task> main
  cd ../<repo>-<task>
  # edit, commit, push from here; the primary checkout is untouched.
  cd -
  git worktree remove ../<repo>-<task>
  ```

- **REQUIRED for staging**: surgical `git add <specific-file> [<file>…]` with explicit paths. Never `-A` / `.`.
- **If you need a quick WIP save**: commit on a new branch from inside a worktree, not a stash.

The umbrella rule: never run a git command that mutates state belonging to a path other than the file you just edited.

## 📚 SHARED STANDARDS

- Commits: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) `<type>(<scope>): <description>` — NO AI attribution
- Scripts: Prefer `pnpm run foo --flag` over `foo:bar` scripts
- Dependencies: After `package.json` edits, run `pnpm install`
- Backward Compatibility: 🚨 FORBIDDEN to maintain — actively remove when encountered
- 🚨 **NEVER use `npx`, `pnpm dlx`, or `yarn dlx`** — use `pnpm exec <package>` or `pnpm run <script>`. Add tools as pinned devDependencies first.
- **minimumReleaseAge**: NEVER add packages to `minimumReleaseAgeExclude` in CI. Locally, ASK before adding — the age threshold is a security control.
- File existence: ALWAYS `existsSync` from `node:fs`. NEVER `fs.access`, `fs.stat`-for-existence, or an async `fileExists` wrapper. Import form: `import { existsSync, promises as fs } from 'node:fs'`.
- Null-prototype objects: ALWAYS use `{ __proto__: null, ...rest }` for config, return, and internal-state objects. Prevents prototype pollution and accidental inheritance. See `src/socket-sdk-class.ts` and `src/file-upload.ts` for examples.
- Linear references: NEVER reference Linear issues (e.g. `SOC-123`, `ENG-456`, Linear URLs) in code, code comments, or PR titles/descriptions/review comments. Keep the codebase and PR history tool-agnostic — tracking lives in Linear.

### Promise.race in loops

**NEVER re-race the same pool of promises across loop iterations.** Each call to `Promise.race([A, B, ...])` attaches fresh `.then` handlers to every arm; a promise that survives N iterations accumulates N handler sets. See [nodejs/node#17469](https://github.com/nodejs/node/issues/17469) and `@watchable/unpromise`.

- **Safe**: `Promise.race([fresh1, fresh2])` where both arms are created per call (e.g. one-shot `withTimeout` wrappers).
- **Leaky**: `Promise.race(pool)` inside a loop where `pool` persists across iterations (the classic concurrency-limiter bug) — also applies to `Promise.any` and long-lived arms like interrupt signals.
- **Fix**: single-waiter "slot available" signal — each task's `.then` resolves a one-shot `promiseWithResolvers` that the loop awaits, then replaces. No persistent pool, nothing to stack.

---

## EMOJI & OUTPUT STYLE

**Terminal symbols** (from `@socketsecurity/lib/logger` LOG_SYMBOLS): ✓ (green), ✗ (red), ⚠ (yellow), ℹ (blue), → (cyan). Use logger methods, never manually apply colors.

```javascript
import { getDefaultLogger } from '@socketsecurity/lib/logger'
const logger = getDefaultLogger()

logger.success(msg) // Green ✓
logger.fail(msg) // Red ✗
logger.warn(msg) // Yellow ⚠
logger.info(msg) // Blue ℹ
logger.step(msg) // Cyan →
```

Emojis allowed sparingly: 📦 💡 🚀 🎉. Prefer text-based symbols for terminal compatibility.

---

### 1 path, 1 reference

**A path is *constructed* exactly once. Everywhere else *references* the constructed value.**

Referencing a single computed path many times is fine — that's the whole point of computing it once. What's banned is *re-constructing* the same path in multiple places, because that's where drift is born.

- **Within a package**: every script imports its own `scripts/paths.mts` (or `lib/paths.mts`). No `path.join('build', mode, ...)` outside that module.
- **Across packages**: when package B consumes package A's output, B imports A's `paths.mts` via the workspace `exports` field. Never `path.join(PKG, '..', '<sibling>', 'build', ...)`.
- **Workflows, Dockerfiles, shell scripts**: they can't `import` TS, so they construct the string once and reference it everywhere downstream. Workflows: a "Compute paths" step exposes `steps.paths.outputs.final_dir`; later steps read `${{ steps.paths.outputs.final_dir }}`. Dockerfiles/shell: assign once to a variable / `ENV`, reference by name thereafter. Each canonical construction carries a comment naming the source-of-truth `paths.mts`. **Re-building** the same path in a second step is the violation, not referring to the constructed value many times.
- **Comments**: may describe path *structure* with placeholders ("`<mode>/<arch>`") but should not encode a complete literal path string. The import statement IS the comment.

Code execution takes priority over docs: violations in `.mts`/`.cts`, Makefiles, Dockerfiles, workflow YAML, and shell scripts are blocking. README and doc-comment violations are advisory unless they contain a fully-qualified path with no parametric placeholders.

**Three-level enforcement:**

- **Hook** — `.claude/hooks/path-guard/` blocks `Edit`/`Write` calls that would introduce a violation in a `.mts`/`.cts` file at edit time.
- **Gate** — `scripts/check-paths.mts` runs in `pnpm check`. Fails the build on any violation that isn't allowlisted in `.github/paths-allowlist.yml`.
- **Skill** — `/path-guard` audits the repo and fixes findings; `/path-guard check` reports only; `/path-guard install` drops the gate + hook + rule into a fresh repo.

The mantra is intentionally short so it sticks: **1 path, 1 reference**. When in doubt, find the canonical owner and import from it.

## 🏗️ SDK-SPECIFIC

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

## ERROR MESSAGES

An error message is UI. The reader should be able to fix the problem from the message alone, without opening your source. Every message needs four ingredients, in order:

1. **What** — the rule that was broken, not the fallout (`must be non-empty`, not `invalid`).
2. **Where** — exact method, argument, field, or URL.
3. **Saw vs. wanted** — the bad value and the allowed shape or set.
4. **Fix** — one concrete action, imperative voice (`pass an org slug`, not `the org slug was missing`).

SDK errors are **terse** — callers may `catch` and match on message text, so every word counts. One sentence covering all four is the norm: `throw new Error('orgSlug is required')`.

Prefer the caught-value helpers from `@socketsecurity/lib/errors` (`isError`, `isErrnoException`, `errorMessage`, `errorStack`) over hand-rolled `instanceof Error` / `'code' in e` checks. For allowed-set / conflict lists, use `joinAnd` / `joinOr` from `@socketsecurity/lib/arrays`.

See `docs/references/error-messages.md` for length tiers (validator / programmatic), the full rule list, worked examples, anti-patterns, and helper signatures.

## Agents & Skills

- `/security-scan` — AgentShield + zizmor security audit
- `/quality-scan` — comprehensive code quality analysis
- `/quality-loop` — scan and fix iteratively
- Agents: `code-reviewer`, `security-reviewer`, `refactor-cleaner` (in `.claude/agents/`)
- Shared subskills in `.claude/skills/_shared/`
- Pipeline state tracked in `.claude/ops/queue.yaml`

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

### Changelog Management

🚨 MANDATORY for version bumps:

- Check OpenAPI updates: `git diff v{prev}..HEAD -- types/`
- Document user-facing changes: new endpoints, parameter changes, new enum values, breaking contracts
- Focus on user impact, not internal infrastructure

### Debugging

- CI uses published npm packages, not local
- Package detection: use `existsSync()` not `fs.access()`
- Test failures: check unused nock mocks and cleanup

### Judgment Protocol

- If the user's request is based on a misconception, say so before executing
- If you spot a bug adjacent to what was asked, flag it: "I also noticed X — want me to fix it?"
- You are a collaborator, not just an executor
- When a warning (lint, type-check, build, runtime) surfaces in code you're already editing, fix it in the same change — don't leave it for later. For warnings in unrelated files, flag them instead of drive-by fixing.
- **Default to perfectionist mindset**: when you have latitude to choose, pick the maximally correct option — no shortcuts, no cosmetic deferrals. Fix state that _looks_ stale even if not load-bearing. If pragmatism is the right call, the user will ask for it explicitly. "Works now" ≠ "right."

### Self-Evaluation

- Before calling done: present two views — perfectionist reject vs. pragmatist ship — and let the user decide. If the user gives no signal, default to perfectionist: do the fuller fix.
- If a fix fails twice: stop, re-read top-down, state where the mental model was wrong, try something fundamentally different

### Completion Protocol

- **NEVER claim done at 80%** — finish 100% before reporting
- Fix forward, don't revert; reverting requires explicit user approval
- After EVERY code change: build, test, verify, commit — one atomic unit

### File System as State

Use `.claude/` (gitignored) for plans, intermediate analysis, logs, and cross-session context. Don't hold large analysis in context.

### Self-Improvement

- After ANY user correction: log the pattern so the mistake isn't repeated
- Convert mistakes into strict rules
- After fixing a bug: explain why it happened and what category it represents

### Context & Edit Safety

- After 10+ messages: re-read files before editing
- Before/after every edit: re-read to confirm
- Tool results over 50K chars are silently truncated — narrow scope and re-run if sparse
- Tasks touching >5 files: use sub-agents with worktree isolation

### SDK Notes

- Windows compatibility matters — test path handling
- Use utilities from `@socketsecurity/registry` where available
- Maintain consistency with surrounding code
