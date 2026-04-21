# CLAUDE.md

🚨 **MANDATORY**: Act as principal-level engineer with deep expertise in TypeScript, Node.js, and SDK development.

## USER CONTEXT

- Identify users by git credentials; use their actual name, never "the user"
- Use "you/your" when speaking directly; use names when referencing contributions

## 📚 SHARED STANDARDS

- Commits: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) `<type>(<scope>): <description>` — NO AI attribution
- Scripts: Prefer `pnpm run foo --flag` over `foo:bar` scripts
- Dependencies: After `package.json` edits, run `pnpm install`
- Backward Compatibility: 🚨 FORBIDDEN to maintain — actively remove when encountered
- 🚨 **NEVER use `npx`, `pnpm dlx`, or `yarn dlx`** — use `pnpm exec <package>` or `pnpm run <script>`. Add tools as pinned devDependencies first.
- **minimumReleaseAge**: NEVER add packages to `minimumReleaseAgeExclude` in CI. Locally, ASK before adding — the age threshold is a security control.
- File existence: ALWAYS `existsSync` from `node:fs`. NEVER `fs.access`, `fs.stat`-for-existence, or an async `fileExists` wrapper. Import form: `import { existsSync, promises as fs } from 'node:fs'`.
- `Promise.race` / `Promise.any`: NEVER pass a long-lived promise (interrupt signal, pool member) into a race inside a loop. Each call re-attaches `.then` handlers to every arm; handlers accumulate on surviving promises until they settle. For concurrency limiters, use a single-waiter "slot available" signal (resolved by each task's `.then`) instead of re-racing `executing[]`. See nodejs/node#17469 and `@watchable/unpromise`. Race with two fresh arms (e.g. one-shot `withTimeout`) is safe.

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
