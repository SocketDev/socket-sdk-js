/*
 * @file The registry of GENERATED artifacts and the generator that renders
 *   each one. `generated-artifacts-are-current.mts` reads this to prove every
 *   committed artifact still matches what its generator produces today.
 *
 *   A generated file that drifts from its source fails silently and stays
 *   wrong. `fleet-files.json` carried `"tracked": false` for the four
 *   `assets/fleet/*.svg` while `bundle.json`, its own source, declared
 *   `"tracked": true` — nobody re-ran the generator after that declaration
 *   landed. GitHub reads a README's brand and social SVGs from the committed
 *   tree at rest, so the stale flag rendered them as broken images in every
 *   member, and no gate said a word.
 *
 *   Three artifacts had a bespoke `*-is-current` guard each. Every other
 *   generator in the fleet could go stale unobserved. One registry closes the
 *   class: adding a generator here is one entry, not a fourth bespoke check.
 *
 *   Tiers. `wheelhouse` entries render from commit-cascade sources that only
 *   the wheelhouse carries, so the gate skips them in a member checkout.
 *   `fleet` entries ship everywhere and are checked in every tree.
 */

/**
 * Where an artifact's generator sources live, which decides where the gate
 * can meaningfully run it.
 */
export type ArtifactTier = 'fleet' | 'wheelhouse'

export interface GeneratedArtifact {
  /**
   * Stable slug, used in gate output and to target a single entry.
   */
  readonly id: string
  /**
   * Repo-relative path to the generator, run with no arguments.
   */
  readonly script: string
  /**
   * Repo-relative paths the generator writes.
   */
  readonly outputs: readonly string[]
  readonly tier: ArtifactTier
  /**
   * Why this artifact going stale matters, quoted in the failure.
   */
  readonly consequence: string
}

export const GENERATED_ARTIFACTS: readonly GeneratedArtifact[] = [
  {
    consequence:
      'the dogfood lint scope reads a stale exclude list, so a file refactored back under the cap stays excluded and its rules go unenforced',
    id: 'dogfood-oxlint-config',
    outputs: ['.config/repo/oxlintrc.dogfood.json'],
    script: 'scripts/repo/gen/dogfood-oxlint-config.mts',
    tier: 'wheelhouse',
  },
  {
    consequence:
      'the ownership registry, the dep-0 installer, and both tracked-surface guards read a stale set, so a member commits the wrong files',
    id: 'fleet-files',
    outputs: ['scripts/repo/commit-cascade/manifest/fleet-files.json'],
    script: 'scripts/repo/commit-cascade/manifest/emit-fleet-files.mts',
    tier: 'wheelhouse',
  },
  {
    consequence:
      'the dep-0 installer and the two tracked-surface guards derive their expectation from this surface, so a missing entry is invisible to them',
    id: 'github-tracked-surface',
    outputs: ['template/base/scripts/fleet/github/tracked-surface.mts'],
    script: 'scripts/repo/commit-cascade/manifest/emit-tracked-surface.mts',
    tier: 'wheelhouse',
  },
]

/**
 * The entries the gate can run in this tree.
 *
 * A member checkout carries no `scripts/repo/commit-cascade`, so a
 * wheelhouse entry there would fail on a missing generator rather than on
 * real staleness. Skipping is correct, not lenient: the wheelhouse gates
 * those artifacts before they ever reach a member.
 */
export function artifactsForTier(
  isWheelhouse: boolean,
): readonly GeneratedArtifact[] {
  return isWheelhouse
    ? GENERATED_ARTIFACTS
    : GENERATED_ARTIFACTS.filter(a => a.tier === 'fleet')
}

/**
 * Look one entry up by slug, for a gate run narrowed to a single artifact.
 */
export function findGeneratedArtifact(
  id: string,
): GeneratedArtifact | undefined {
  return GENERATED_ARTIFACTS.find(a => a.id === id)
}
