# Pack first, cascade only when something else reads the file

The fleet has two ways to put a file in a member: the **fleet-pack** and the
**commit cascade**. The pack is the default. The cascade is the exception, and
it has to earn its place.

## Why the pack wins by default

A tracked cascade entry lands a real commit in every member every time it
changes. The cascade's cost scales with how many files it carries, and that
cost is paid by every repo on every change.

A packed file costs one bundle the member already downloads. Adding a file to
the pack is close to free; adding one to the cascade is not.

So the question is never "may I add this to the cascade?" It is "can the pack
carry this?" The answer is yes unless something outside our runtime has to
read the file from the committed tree.

## The bar is a named reader

Every tracked entry in `bundle.json` declares `trackedReason`, and the value
comes from a closed set. Each one answers the same question: who reads this
before, or without, our fetch ever running?

| Value              | The reader                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `git`              | git itself, before any hydration. The `.git-hooks/*` tree.                                                     |
| `github-actions`   | GitHub, from the committed tree. Workflows and composite actions.                                              |
| `github-readme`    | GitHub's markdown renderer, at rest. The README brand and social art.                                          |
| `dep-0`            | Something read before the fetch that would deliver it. `.npmrc`, the bootstrap seed. The chicken-and-egg case. |
| `editor-toolchain` | An editor or toolchain that never runs our code. `.editorconfig`, a tsconfig an IDE resolves on its own.       |

The set is closed on purpose. A free-text field accepts any sentence, and a
sentence can argue for anything. Naming a reader is a fact you can check.

If no value fits, that is the finding: the pack can carry the file.

## Hybrid files are exempt

A hybrid file has a member-owned half. It has to exist in the member's own
commit no matter what the pack ships, so the pack is not an alternative for
it and the gate skips it.

## Bake data in rather than shipping a file

The same principle applies inside the pack. A loose JSON read through `fs` at
run time cannot be bundled, because rolldown sees a path rather than a value.
Every consumer then needs the file on disk in the right place.

Render the data into a module constant instead. rolldown inlines a constant,
so the values ride inside `fleet-pack.cjs` and no member needs the file at
all. `gen/model-pricing-module.mts` is the worked example: it bakes
`model-pricing.json` into a frozen `MODEL_PRICING`, per tree, and both copies
are gitignored build outputs rather than cascade payload.

Typing the baked constant is a bonus that keeps paying. The old code did
`JSON.parse(...) as PricingData`, an unchecked assertion, and it had been
hiding five fields the data carried that the types never declared.

## Enforcement

- `scripts/fleet/check/cascade-additions-are-justified.mts` fails any tracked
  entry that names no reader, or one outside the set. Wheelhouse-only, since
  `bundle.json` is the cascade's source. Wired into `pnpm run preflight` and
  reachable as `mcp__fleet__check`.
- `scripts/fleet/check/generated-outputs-are-untracked.mts` keeps a build
  output from being committed in the first place.
- The ignore block in `gitignore-fleet-entries.mts` and
  `RELEASE_ONLY_DIR_MIRROR_FILES` in `dir-mirror-skip.mts` stay in lock-step;
  a packed artifact belongs in both.
