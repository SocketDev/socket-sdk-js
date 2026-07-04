---
name: updating-workflows
description: Repin this repo's `uses:` references for socket-registry reusable workflows to the SHA socket-registry currently declares, so a superseded/orphaned pin can't 404 CI fleet-wide. Backed by `scripts/fleet/sync-registry-workflow-pins.mts`. Sibling of `updating-coverage` / `updating-security` under the `updating` umbrella.
user-invocable: true
allowed-tools: Read, Bash(node:*), Bash(git:*)
model: claude-haiku-4-5
context: fork
---

# updating-workflows

Repins this repo's `SocketDev/socket-registry/.github/workflows/<w>.yml@<sha>` references to the reachable SHA socket-registry itself declares. Invoked directly via `/updating-workflows` or as Phase 7 of the `updating` umbrella when discovery flags stale pins.

## When to use

- The `updating` umbrella's discovery phase reports stale registry workflow pins.
- CI fails with "workflow was not found" on a `uses: SocketDev/socket-registry/...@<sha>` line (an orphaned/superseded SHA).
- After a socket-registry cascade moved the reusable-workflow tip.

## What it does NOT do

- **Hand-edit a SHA.** Registry workflow pins are cascade-owned (CLAUDE.md _Drift_ rule); the SHA comes from socket-registry's own `_local-not-for-reuse-<w>.yml` caller, never a guess.
- **Bump arbitrary action pins.** Only `SocketDev/socket-registry` reusable-workflow refs are in scope; third-party `uses:` SHAs are governed by the action-lock tooling.
- **Resolve the default branch in shell.** The canonical chain lives in `scripts/fleet/sync-registry-workflow-pins.mts`; this skill never re-derives it.

## Phases

| #   | Phase  | Outcome                                                                                              |
| --- | ------ | ---------------------------------------------------------------------------------------------------- |
| 1   | Report | `node scripts/fleet/sync-registry-workflow-pins.mts` — list drift, exit 1 if any pin is stale.       |
| 2   | Fix    | `node scripts/fleet/sync-registry-workflow-pins.mts --fix` — rewrite drifted pins in place.          |
| 3   | Verify | Re-run the report; it must exit 0 (no drift).                                                        |
| 4   | Commit | `ci(workflows): repin socket-registry reusable workflows`. Direct-push per fleet norm.               |

The SHA discovery (read socket-registry's `_local-*` callers), the drift comparison, and the canonical `# main (YYYY-MM-DD)` comment rewrite are all owned by `scripts/fleet/sync-registry-workflow-pins.mts` — the same owner the discovery probe (`updating/lib/discover.mts`) calls in report mode. This skill is orchestration over that script; it re-derives none of the repin logic in shell.

## Phase 1: report

```sh
node scripts/fleet/sync-registry-workflow-pins.mts
```

Exit 0 = pins current (nothing to do; exit silently). Exit 1 = at least one pin drifted; the output names each `<workflow>.yml@<current> → <wanted>`.

## Phase 2: fix

```sh
node scripts/fleet/sync-registry-workflow-pins.mts --fix
```

Rewrites each drifted `uses:` line to the reachable SHA with the canonical dated comment.

## Phase 3: verify

```sh
node scripts/fleet/sync-registry-workflow-pins.mts
```

Must exit 0 after the fix. A non-zero exit here means the source pins themselves moved mid-run — re-run the fix.

## Phase 4: commit

```sh
git add .github/workflows
git commit -m "ci(workflows): repin socket-registry reusable workflows"
git push origin <default-branch>
```

Direct-push per the fleet's push policy; fall back to PR if the remote rejects.

## Output

Emit a one-line summary of how many pins moved (and from/to where). When no pin drifted, exit silently.

## Related

- `.claude/skills/fleet/updating/SKILL.md`: umbrella that calls this skill as Phase 7 when discovery flags stale pins.
- `.claude/skills/fleet/updating/lib/discover.mts`: the discovery probe that runs this script in report mode.
- `.claude/skills/fleet/updating-coverage/SKILL.md`, `.claude/skills/fleet/updating-security/SKILL.md`: siblings under `updating`.
