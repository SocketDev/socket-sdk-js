# History rewrites: attribution stripping + on-lineage bases

Two rules for any operation that rewrites committed history (consolidate,
squash, reword, lease-force reconcile).

## Strip attribution with the script, never a rebase dance

When the pre-push gate reports "AI attribution found in commit messages", the
owner is:

```bash
node scripts/fleet/strip-ai-attribution.mts --base <ref> [--dry-run]
```

It walks `base..HEAD` with plumbing, rewords ONLY flagged messages (shared
detector: `scripts/fleet/lib/attribution.mts`), preserves trees, author
identity, and author dates, re-signs through the normal signing config,
verifies the final tree byte-identical, and re-scans the result. A
hand-scripted `git rebase -i` with `GIT_SEQUENCE_EDITOR`/`GIT_EDITOR` editors
is banned by `attribution-rewrite-nudge`: it is quoting-fragile, silently
no-ops when the todo regex misses, and verifies nothing — all three failure
modes happened live (socket-mcp, 2026-07-10) before the script existed.

## A rewrite base must sit on origin's lineage

After a force-push rewrite, old anchors — version tags, npm `gitHead`
records, backup refs — still point into the REPLACED history. Consolidating
or squashing onto such a base rebuilds the branch on that dead line, so every
replaced commit comes back, including ones the rewrite removed on purpose.

`consolidate-commits.mts` enforces this: a `--base` that DIVERGED from
`origin/<default>` (neither contains the other) fails loud with the recovery
steps. A base below origin's tip (normal release anchor) or above it (an
unpushed local span) is fine. `--allow-off-lineage-base` skips the check for
a deliberately local-only lineage.

Recovery when the anchor is stale: find the SAME release point on the live
history (`git log origin/main --oneline | head -20`, match the bump/release
subject) and pass that sha as `--base`. When local work is already built on
the dead line, re-anchor it: snapshot the verified tree
(`git commit-tree <tree> -p origin/main`), point the branch at the snapshot,
then consolidate with `--base origin/main` — the result is a fast-forward of
origin, no force needed.

## Incident this codifies

socket-mcp, 2026-07-10: a morning sweep consolidation force-pushed rewritten
history; the evening "consolidate since the last npm release" resolved the
`v0.0.20` tag to the replaced lineage, resurrected an AI-attributed commit
the rewrite had removed, and the pre-push gate rejected the push. Three
rebase-reword hand-attempts then failed silently (quoting, todo-regex miss,
no verification) before the branch was re-anchored onto origin's lineage.
