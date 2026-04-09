---
name: quality-scan
description: Runs comprehensive quality scans across the codebase using specialized agents to identify critical bugs, logic errors, caching issues, and workflow problems. Use when improving code quality, before releases, or investigating issues.
---

# quality-scan

<task>
Performs comprehensive quality scans across the codebase, cleaning up junk files
and spawning specialized agents for targeted analysis. Generates a prioritized
report with actionable improvement tasks.
</task>

<constraints>
- Analysis phase is read-only; do not fix issues during scan.
- Must complete all enabled scans before reporting.
- Findings prioritized by severity (Critical > High > Medium > Low).
- All findings must include file:line references and suggested fixes.
- Run `pnpm test` after each fix iteration.
- Cap at 5 iterations; stop and report if issues persist.
</constraints>

## Phases

1. **Validate Environment** — `git status`; follow `_shared/env-check.md`.
2. **Update Dependencies** — `pnpm run update`; continue even if it fails.
3. **Install External Tools** — See `_shared/security-tools.md` for zizmor; use `pnpm run setup`.
4. **Repository Cleanup** — Glob for junk files (SCREAMING_TEXT.md, temp files, editor backups); confirm before deletion.
5. **Structural Validation** — `pnpm run check`; report errors as Critical findings.
6. **Determine Scan Scope** — Ask user: all scans, critical only, or custom selection. CI mode runs all automatically.
7. **Execute Scans** — Spawn agents sequentially via Agent tool using prompts from [reference.md](reference.md). Apply `agents/code-reviewer.md` rules for code scans, `agents/security-reviewer.md` for security scans.
8. **Aggregate Findings** — Deduplicate across scans, sort by severity then scan type.
9. **Generate Report** — Summary table by severity + scan type, display to user.
10. **Fix All Issues** — Apply fixes from Critical to Low; read each file before editing.
11. **Run Tests** — `pnpm test`; revert and exit iteration on failure.
12. **Commit Fixes** — Stage and commit with summary of fixed issue counts.
13. **Iteration Decision** — Zero issues = done; otherwise loop back to Phase 7.

## Available Scans

See [reference.md](reference.md) for detailed agent prompts. Scan types:

- **critical** — Crashes, security vulnerabilities, resource leaks, data corruption
- **logic** — Algorithm errors, edge cases, type guards, off-by-one errors
- **cache** — Cache staleness, race conditions, invalidation bugs
- **workflow** — Build scripts, CI issues, cross-platform compatibility
- **security** — GitHub Actions workflow security via zizmor + credential exposure
- **documentation** — README accuracy, outdated docs, missing documentation

## Scan Scope

Primary: `src/`, `scripts/`, `test/`, `.github/workflows/`
Excluded: `node_modules/`, `dist/`, `.pnpm-store/`

## Error Recovery

- **Scan agent failure**: Log warning, continue remaining scans.
- **Test failure after fixes**: `git restore .`, report failures, exit iteration.
- **Git commit failure**: Display error, ask user to resolve.
