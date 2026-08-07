---
name: pushing
description: Run the full pre-push gate, push only when green, then watch CI after the push.
user-invocable: true
allowed-tools: Bash(node:*), Bash(git:*), Bash(gh:*)
model: claude-haiku-4-5
context: fork
metadata:
  internal: true
---

# pushing

Landing on local main is the default; pushing origin is deliberate - the wheelhouse is the fleet's canonical source (members cascade from origin/main), so a red push breaks the fleet. This skill gates the push, then drives CI to green.

## Run the gate

```bash
node scripts/fleet/pre-push-gate.mts
```

Three phases. Prepare steps feed each other, so they stop at the first red. The cheap verifications are independent, so **every one runs and all reds are reported together**. The coverage suite runs only when that cheap set is clean - paying for it beside a lint red is the long cycle worth avoiding, since its verdict is discarded the moment the red is fixed.

Prepare (stops at first red):

1. `pnpm run update` - refresh tool/catalog pins (soak-held stay held)
2. `pnpm install` - reconcile the lockfile

Cheap verify (all run, failures accumulate):

3. `pnpm run fix --all` - lint/format autofix
4. `pnpm run check --all` - the fleet check gates

Slow verify (only when the cheap set is clean):

5. `pnpm run cover` - full coverage suite (covers "all tests pass")

Fix EVERY red it names before re-running. Re-running to discover the next failure pays another full `check --all` + `cover` for information the report already gave you. While iterating, `pnpm run preflight` runs the cheap verifications without the coverage suite ([`preflight-before-the-gate`](../../../../docs/agents.md/fleet/preflight-before-the-gate.md)).

## On GREEN

Push, then drive CI to green. Don't walk away on a red run. The `post-push-ci-monitor-nudge` hook reminds you:

```bash
git push
gh run watch
```

If `pnpm run update` / `pnpm install` changed the lockfile or pins, commit those first. The lockfile-only `-o pnpm-lock.yaml` reconcile is sanctioned. Then re-run the gate. The gate never pushes for you - it only tells you it is safe to.

## Handoffs

Run [agent-ci](../agent-ci/SKILL.md) before CI-sensitive pushes when Docker is available.
After the push, use [greening-ci](../greening-ci/SKILL.md) until remote CI is green.
