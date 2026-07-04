/**
 * Update: two-pass taze to apply the fleet's maturity policy correctly.
 *
 * Pass 1: default config (.config/fleet/taze.config.mts) — non-Socket deps
 * respect maturityPeriod: 7.
 *
 * Pass 2: CLI-flag override — Socket-owned scopes only, maturityPeriod: 0.
 * taze's config auto-discovery is path-based and doesn't support a --config
 * override, so the second pass uses `--include <scopes> --maturity- period 0`
 * flags instead of a second config file.
 *
 * Pass 3: pnpm install to refresh the lockfile against the updated
 * package.json.
 *
 * SOCKET_SCOPES is the single shared constant (scripts/fleet/constants/
 * socket-scopes.mts) — the same one .config/fleet/taze.config.mts imports, so
 * the two can't drift (was previously hand-copied in both, "MUST match").
 *
 * This is a reference script. Consuming repos can drop it into their own
 * scripts/ dir and wire it in via a `"update": "node scripts/fleet/update.mts"`
 * package.json entry.
 */
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'

import { SOCKET_SCOPES } from './constants/socket-scopes.mts'
import { REPO_ROOT } from './paths.mts'
import { scanRepoForTelemetry } from './lib/telemetry-scan.mts'

const logger = getDefaultLogger()

async function run(cmd: string, args: string[]): Promise<boolean> {
  try {
    await spawn(cmd, args, { stdio: 'inherit' })
    return true
  } catch (e) {
    process.exitCode = (e as { code?: number | undefined }).code ?? 1
    return false
  }
}

const steps: Array<[string, string[]]> = [
  /* Pass 1 — third-party deps, respects the 7-day cooldown.
   *
   * `--maturity-period 7` MUST be passed on the CLI even though
   * the config file (.config/fleet/taze.config.mts) sets the same
   * value. Taze's CLI default for this flag is 0, and CLI
   * defaults override config — without this flag, the cooldown
   * is silently disabled. */
  ['pnpm', ['exec', 'taze', '--maturity-period', '7', '--write']],
  /* Pass 2 — Socket deps, no cooldown. --include is comma-separated. */
  [
    'pnpm',
    [
      'exec',
      'taze',
      '--include',
      SOCKET_SCOPES.join(','),
      '--maturity-period',
      '0',
      '--write',
    ],
  ],
  /* Pass 3 — resync lockfile against the updated package.json. */
  ['pnpm', ['install']],
]

for (const [cmd, args] of steps) {
  if (!(await run(cmd, args))) {
    break
  }
}

// Pass 4 — fail-closed telemetry scan. An update may have pulled a telemetry /
// analytics SDK (Sentry/PostHog/Segment/Datadog/OTEL-SDK/langfuse/…) into the
// refreshed lockfile. Scan the post-update dep surface; if anything unreviewed
// appears, FAIL loudly so it can't land silently — the operator's "never
// silently phone home; run the check on every software update" rule, as law.
// (Same scan as check/telemetry-deps-are-reviewed.mts.)
if (process.exitCode !== 1) {
  const unreviewed = scanRepoForTelemetry(REPO_ROOT)
  if (unreviewed.length) {
    logger.fail(
      'update: NEW telemetry / analytics SDK(s) pulled in by this update:',
    )
    for (let i = 0, { length } = unreviewed; i < length; i += 1) {
      logger.error(`  ✗ ${unreviewed[i]!}`)
    }
    logger.error(
      '  Audit + neutralize (pnpm override / env opt-out / drop the dep), or add',
    )
    logger.error(
      '  to REVIEWED_TELEMETRY in scripts/fleet/lib/telemetry-scan.mts with a reason.',
    )
    process.exitCode = 1
  } else {
    logger.success('update: telemetry scan clean (no unreviewed phone-home).')
  }
}
