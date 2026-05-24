# Tooling

The CLAUDE.md `### Tooling` section is the short list; this file is the full set of rules and their rationale.

## Package manager

`pnpm`. Run scripts via `pnpm run foo --flag`, never `foo:bar`. After `package.json` edits, `pnpm install`.

## No `npx` / `dlx`

NEVER use `npx`, `pnpm dlx`, or `yarn dlx` — use `pnpm exec <package>` or `pnpm run <script>` # socket-hook: allow npx

## Docs lead with pnpm

User-facing install commands in fenced code blocks must show the pnpm form first (`pnpm install <pkg>`, `pnpm add <pkg>`). npm / yarn fallbacks are fine but come after — or in a separate block introduced as a fallback. The pre-commit `scanDocsPnpmFirst` scanner emits a warning (not a hard fail) for `.md` / `.mdx` blocks that lead with npm or yarn without a pnpm leader. Suppress per-block with `socket-hook: allow pnpm-first` (HTML comment above the fence or any line inside it).

## New dependencies + soak

Every new dep added to `package.json` runs a Socket-score check at edit time; low-scoring deps block (enforced by `.claude/hooks/check-new-deps/`). The 7-day `minimumReleaseAge` soak is intentional malware protection; never add to `pnpm-workspace.yaml` `minimumReleaseAge.exclude[]` (bypass `Allow minimumReleaseAge bypass` for emergency CVE patches; enforced by `.claude/hooks/minimum-release-age-guard/`).

Every per-package soak-bypass entry (the `'pkg@1.2.3'` exact-pin form) MUST carry a `# published: YYYY-MM-DD | removable: YYYY-MM-DD` annotation as the LAST comment line above the bullet — `published` is the version's npm publish date, `removable` is `published + 7d` so a periodic cleanup can drop entries that no longer need the bypass (enforced by `.claude/hooks/soak-exclude-date-annotation-guard/` at edit time + `scripts/check-soak-exclude-dates.mts` at commit time).

Vitest `include` globs must not match `node:test` files — mismatched runners produce confusing "no test suite found" errors (enforced by `.claude/hooks/vitest-include-vs-node-test-guard/`).

## Bundler

`rolldown`, NOT `esbuild`. The fleet standardizes on rolldown for direct bundling (see `template/.config/rolldown/`). Transitive esbuild deps (e.g. via vitest) are unavoidable today — the rule is no _new direct_ esbuild use anywhere in the fleet.

## Backward compatibility

FORBIDDEN to maintain. Actively remove when encountered.

## `packageManager` field

Bare `pnpm@<version>` is correct for pnpm 11+. pnpm 11 stores the integrity hash in `pnpm-lock.yaml` (separate YAML document) instead of inlining it in `packageManager`; on install pnpm rewrites the field to its bare form and migrates legacy inline hashes automatically. Don't fight the strip. Older repos may still ship `pnpm@<version>+sha512.<hex>` — leave it; pnpm migrates on first install. The lockfile is the integrity source of truth.

## Monorepo internal `engines.node`

Only the workspace root needs `engines.node`. Private (`"private": true`) sub-packages in `packages/*` don't need their own `engines.node` field; the field is dead, drift-prone, and removing it is the cleaner play. Public-published sub-packages (the npm-published ones with no `"private": true`) keep their `engines.node` because external consumers see it.

## Config files in `.config/`

Place tool / test / build configs in `.config/`: `taze.config.mts`, `vitest.config.mts`, `tsconfig.base.json` (the abstract compiler-options layer — fleet-canonical, byte-identical across the fleet), `esbuild.config.mts`. New abstract configs go in `.config/` by default.

Repo root keeps only what _must_ be there: package manifests + lockfile (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`), the linter / formatter dotfiles whose tools require root placement (`.oxlintrc.json`, `.oxfmtrc.json`, `.npmrc`, `.gitignore`, `.node-version`), AND every **concrete** tsconfig (`tsconfig.json`, `tsconfig.check.json`, `tsconfig.dts.json`, `tsconfig.test.json`, etc. — anything with `include`/`exclude`/`files`). Concrete tsconfigs live at the package root so tsc + IDE language-servers discover them natively at cwd; burying them in `.config/` breaks the lookup. In monorepos the concrete `tsconfig.json` lives at each `packages/<pkg>/`. Concrete configs `extend` `./.config/tsconfig.base.json` (single-repo at root) or `../../.config/tsconfig.base.json` (monorepo per-package).

## Runners are `.mts`, not `.sh`

Every executable script (skill runner, hook handler, fleet automation) is TypeScript via `node <file>.mts`. Bash works on macOS/Linux but breaks on Windows; `bash` isn't on Windows PATH by default and `if [ ... ]` / `${VAR:-default}` aren't portable. The fleet runs on developer machines (mixed macOS / Linux / Windows / WSL) and CI (Linux), so cross-platform is a hard requirement. Use `@socketsecurity/lib/spawn` (`spawn`, `isSpawnError`) instead of `child_process` — it ships consistent error shapes (`SpawnError`), `stdioString: true` for buffered stdout, and integrates with the rest of the lib. Reach for `_shared/scripts/*.mts` for cross-skill helpers (default-branch resolution, report formatting); reach for `<skill>/run.mts` for skill-specific implementation. Reserve `.sh` for tiny one-shot snippets that genuinely have no Windows audience (e.g., a `bin/` wrapper). The `lib/` vs `scripts/` distinction matches `@socketsecurity/lib` (public, importable surface) vs per-package `scripts/` (private, internal automation) — skill helpers are internal, hence `scripts/`.

## Soak time

(pnpm-workspace.yaml `minimumReleaseAge`, default 7 days) — never add packages to `minimumReleaseAgeExclude` in CI. Locally, ASK before adding (security control).

## Upstream submodules — always shallow

Every entry in `.gitmodules` MUST set `shallow = true`. Every `git submodule update --init` call (postinstall.mts, CI, manual) MUST pass `--depth 1 --single-branch`. Upstream repos like yarnpkg/berry, oven-sh/bun, rust-lang/cargo are multi-GB with full history; we only ever need the pinned SHA's tree. A non-shallow init can take 30+ minutes and waste GB of disk on every fresh clone. There is no scenario where the fleet needs upstream submodule history.

## `npm-run-all2` + `node --run` opt-in

The fleet pins `npm-run-all2: 9.0.0` in the wheelhouse catalog. Every repo that depends on it MUST also declare the top-level `"npm-run-all2": { "nodeRun": true }` key in its own `package.json`. That key tells npm-run-all2 9.x to execute each script via `node --run` instead of the package manager CLI — `run-s build:*` and `run-p test:*` chains skip the per-script pnpm startup cost, which is non-trivial for N-script fan-outs. Inherited limitations from `node --run` (no `pre`/`post` lifecycle hooks; no `npm_*` env injection — `NODE_RUN_SCRIPT_NAME` + `NODE_RUN_PACKAGE_JSON_PATH` replace them; `node_modules/.bin` still on PATH) are acceptable for the fleet because none of our canonical scripts rely on those features. Enforced by `scripts/sync-scaffolding/checks/package-npm-run-all2-noderun.mts` — `npm_run_all2_node_run_missing` findings auto-fix.

## Backward compatibility

FORBIDDEN to maintain. Actively remove when encountered.
