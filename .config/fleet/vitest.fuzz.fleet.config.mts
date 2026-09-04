/**
 * @file Fleet-canonical fuzz-lane defaults — the shape every socket-* repo
 *   shares for its ROOT `vitest.config.mts` (the vitiate coverage-guided
 *   lane, Tier 2). A repo supplies only its own `instrument.include`, the one
 *   value that differs per repo, and layers deltas on top of what it gets
 *   back. Do NOT add repo-specific paths here; anything in this file cascades
 *   to every fleet repo.
 *   Why this is fleet-canonical and the root config is not: the root
 *   `vitest.config.mts` has to sit at the repo root for vitest
 *   auto-discovery, and it carries a per-repo instrument list, so it stays
 *   repo-owned. That left the glob and the empty-run policy duplicated in
 *   every member, and a bug in either could not cascade. It cost a real
 *   outage: the include read `test/**\/*.fuzz.ts` while the fleet writes
 *   `.mts`, so the lane collected NOTHING, vitest exited 1 on the empty run,
 *   and the weekly schedule filed it as a fuzz crash for weeks.
 */

import type { TestProjectConfiguration } from 'vitest/config'

/**
 * Where fuzz targets live. The fleet writes TypeScript as `.mts`, so a
 * `.ts`-only glob matches nothing — see the file header for what that cost.
 */
export const FLEET_FUZZ_INCLUDE: readonly string[] = ['test/**/*.fuzz.mts']

/**
 * Default wall-clock budget for one target, in milliseconds. CI raises it by
 * exporting `FUZZ_TIME_MS` before `pnpm run test:fuzz`. The env var is
 * deliberately NOT `VITIATE_`-prefixed, so vitiate's
 * `warnUnknownVitiateEnvVars()` stays quiet about it.
 */
export const FLEET_FUZZ_TIME_MS_DEFAULT = 15_000

/**
 * The budget this run should use: the `FUZZ_TIME_MS` override when it parses
 * as a positive number, else the fleet default. A zero or a non-numeric value
 * falls back rather than pinning the budget to nothing.
 */
export function resolveFuzzTimeMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env['FUZZ_TIME_MS'])
  return Number.isFinite(raw) && raw > 0 ? raw : FLEET_FUZZ_TIME_MS_DEFAULT
}

/**
 * The `test` section every fleet root fuzz config starts from.
 *
 * `passWithNoTests` is the half that keeps a scheduled run honest. A repo with
 * no fuzz target yet should stay QUIET rather than fail its weekly run: an
 * empty run is not a finding, and a red lane that means "nothing to do" trains
 * everyone to ignore the lane that is supposed to report real crashes. Whether
 * a repo OUGHT to have a target is a separate question, and the fuzz-tiers
 * check is what asks it.
 *
 * `testTimeout` is derived from the fuzz budget, never left at vitest's 5s
 * default. A fuzz target is SUPPOSED to run for its whole budget, so the
 * default makes every target that uses more than five seconds fail on the
 * clock and report as a crash — measured on the wheelhouse's own
 * cascade-channel-parity target, whose 200 synthetic classifications timed out
 * on a run that had found nothing wrong. The headroom covers the fixed cost
 * around the loop (corpus load, the final assertions) rather than the fuzzing
 * itself.
 */
export const FLEET_FUZZ_TIMEOUT_HEADROOM_MS = 30_000

export function fleetFuzzTestConfig(): TestProjectConfiguration['test'] {
  return {
    include: [...FLEET_FUZZ_INCLUDE],
    passWithNoTests: true,
    testTimeout: resolveFuzzTimeMs() + FLEET_FUZZ_TIMEOUT_HEADROOM_MS,
  }
}

export interface FleetVitiateOptions {
  /**
   * Corpus + run-results root. Defaults to the fleet cache segment rather than
   * a top-level `.vitiate/`, because `.cache` is already gitignored fleet-wide.
   */
  readonly dataDir?: string | undefined
}

/**
 * Options for `vitiatePlugin()` with the fleet's fuzz posture applied:
 * stop on the first crash so the corpus entry is the one reported, and run the
 * prototype-pollution detector everywhere.
 *
 * `instrumentInclude` is this repo's OWN source globs. Targets import these
 * directly. vitiate's `packages` option is the one for node_modules
 * dependencies, and is not what this sets.
 */
export function fleetVitiatePluginOptions(
  instrumentInclude: readonly string[],
  options?: FleetVitiateOptions | undefined,
): {
  dataDir: string
  fuzz: {
    detectors: { prototypePollution: boolean }
    fuzzTimeMs: number
    stopOnCrash: boolean
  }
  instrument: { include: string[] }
} {
  const { dataDir = '.cache/fleet/vitiate' } = {
    __proto__: null,
    ...options,
  } as FleetVitiateOptions
  return {
    dataDir,
    fuzz: {
      detectors: { prototypePollution: true },
      fuzzTimeMs: resolveFuzzTimeMs(),
      stopOnCrash: true,
    },
    instrument: { include: [...instrumentInclude] },
  }
}
