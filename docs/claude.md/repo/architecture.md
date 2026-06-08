# socket-sdk-js architecture

Per-repo CLAUDE.md detail extracted to fit the 40KB whole-file cap. The CLAUDE.md `## 🏗️ SDK-Specific` section keeps the headline invariants; this file is the full surface.

Socket SDK for JavaScript/TypeScript — programmatic access to Socket.dev security analysis.

## Layout

- `src/index.ts` — entry
- `src/socket-sdk-class.ts` — SDK class with all API methods
- `src/http-client.ts` — request/response handling
- `src/types.ts` — TypeScript definitions
- `src/utils.ts` — shared utilities
- `src/constants.ts` — constants

## Commands

- Build: `pnpm run build` (`pnpm run build --watch` for dev — 68% faster rebuilds)
- Test: `pnpm test`
- Type check: `pnpm run type` ; Lint: `pnpm run lint` ; Check: `pnpm run check`
- Coverage: `pnpm run cover`

## Config locations

Configs live under `.config/`:

| File                                 | Purpose                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `tsconfig.json`                      | Main TS config (extends base)                                                     |
| `.config/tsconfig.base.json`         | Base TS settings                                                                  |
| `.config/tsconfig.check.json`        | Type checking for `type` command                                                  |
| `.config/tsconfig.dts.json`          | Declaration generation                                                            |
| `.config/esbuild.config.mts`         | Build orchestration (ESM, node18+)                                                |
| `.config/vitest.config.mts`          | Main test config                                                                  |
| `.config/vitest.config.isolated.mts` | Isolated tests (for `vi.doMock()`)                                                |
| `.config/vitest.coverage.config.mts` | Shared coverage thresholds (branches ≥82%, functions ≥98%, lines/statements ≥93%) |
| `.config/isolated-tests.json`        | List of tests requiring isolation                                                 |
| `.config/taze.config.mts`            | Dependency-update policies                                                        |

## SDK-local conventions

- File extensions: `.mts` for TypeScript modules. **Mandatory** `@fileoverview` headers. **Forbidden**: `"use strict"` in `.mjs`/`.mts` (ES modules are strict).
- Semicolons: use them (this is the one Socket project that does).
- No `any`; use `unknown` or specific types.
- HTTP: 🚨 never `fetch()` — use `createGetRequest` / `createRequestWithJson` from `src/http-client.ts`. `fetch()` bypasses the SDK's HTTP stack (retries, timeouts, hooks, agent config) and isn't interceptable by nock. For external URLs (e.g. firewall API) pass a different `baseUrl` to `createGetRequest`.
- Logger calls: `logger.error('')` / `logger.log('')` must include the empty string.
- Sorting: type properties — required first then optional, alphabetical within groups. Class members: 1) private properties, 2) private methods, 3) public methods, alphabetical. Object properties + destructuring: alphabetical (except semantic ordering). `new Set([…])` literals: alphanumeric.

## Testing

- Two vitest configs: `.config/vitest.config.mts` (default), `.config/vitest.config.isolated.mts` (full process isolation for `vi.doMock()`).
- Structure: `test/` for tests, `test/utils/` for shared helpers. Descriptive names like `socket-sdk-upload-manifest.test.mts`.
- Recommended helper: `setupTestClient('test-api-token', { retries: 0 })` returns a getter; combine with `getClient()` per test. Also: `setupTestEnvironment()` (nock only), `createTestClient()` (client only), `isCoverageMode` flag. See `test/utils/environment.mts`.
- Mock HTTP with nock (auto-cleaned in beforeEach/afterEach). Test success + error paths, cross-platform path handling.
- Run all: `pnpm test`. Specific: `pnpm test <file>` (glob support). 🚨 **never** `--` before test paths — that runs ALL tests.
- Test style: functional over source-scanning. Never read source files and assert on contents.

## CI

- 🚨 Mandatory: `SocketDev/socket-registry/.github/workflows/ci.yml@<full-sha> # main`.
- Custom runner: `scripts/test.mts` with glob expansion.
- Memory: auto heap (CI 8 GB, local 4 GB).
- CI uses published npm packages, not local.

## SDK notes

- Windows compatibility matters — test path handling.
- Reuse utilities from `@socketsecurity/registry` where available.
- Package detection: use `existsSync()` not `fs.access()`.
