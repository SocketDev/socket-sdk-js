# no-hand-edit-registry-pin-guard

**Type:** PreToolUse guard (Edit/Write/MultiEdit) — BLOCKS (exit 2).

**Trigger:** an edit to a GitHub Actions workflow (`.github/workflows/*.y[a]ml`)
or composite action (`.github/actions/**`) that CHANGES the SHA on a
`SocketDev/socket-registry/.github/(workflows|actions)/…@<40-hex>` pin — the
same uses-path present before and after the edit with a different SHA. A pin
added to a brand-new file (no prior pin to differ from) is left alone.

**Why:** these pins are cascade-owned. `cascade-workflows.mts` (in
socket-registry) sets the canonical SHA and `sync-registry-workflow-pins.mts`
repins each member downstream, behind the drift-watch order + the green-gate.
A hand-edit skips both layers — it can land a SHA the cascade then fights, or
one that was never green-gated. The cascade scripts write via `fs`, not the
Edit tool, so any Edit/Write that flips a pin is by definition a hand-edit.

**Fix the message gives:** repin through the scripts —
`node scripts/fleet/sync-registry-workflow-pins.mts --fix` (the upstream
`cascade-workflows.mts` sets the canonical SHA).

**Bypass:** `Allow registry-pin-edit bypass` typed verbatim in a recent user
turn.

**Fails open** on parse / payload errors (exit 0) — a guard bug must not block
every workflow edit.
