/**
 * @file The ONE canonical CI green-gate for the socket-registry shared-workflow
 *   SHA cascade. A propagation SHA — the `_local-not-for-reuse-<workflow>.yml`
 *   self-pin SHA that consumers sync to — may only be trusted when
 *   socket-registry's CI for THAT EXACT commit is green. The query MUST be `gh
 *   run list --commit <sha>`, never `--workflow … --branch main --limit 1`: the
 *   latest run on a branch can be a DIFFERENT commit than the one being
 *   propagated, so gating it certifies a green for the wrong SHA. That SHA-race
 *   is exactly what shipped a false-green and red-CI'd the fleet for weeks (the
 *   pnpm-version drift). Gate the EXACT SHA being pinned, atomically, and the
 *   race cannot happen. Every entry point in the cascade —
 *   `sync-registry-workflow-pins.mts`, `cascading-fleet`'s
 *   `cascade-tool-pins.mts`, socket-registry's `cascade-workflows.mts`, and the
 *   template updater `cascade-shared-workflow-shas.mts` (the socket-registry
 *   override) — calls THIS, so the gate is DRY and the query shape can never
 *   diverge between callers. The `registry-workflow-gate-is-canonical` check
 *   enforces that.
 */

import { spawnSync } from '@socketsecurity/lib-stable/process/spawn/child'

export const REGISTRY_SLUG = 'SocketDev/socket-registry'

// Conclusions that are a DETERMINATE failure — CI ran to completion and did not
// pass. Only these block in best-effort mode; `unknown (…)` (gh offline/auth),
// `in-progress (…)`, and `no-run-yet` do NOT block (the cascade stays runnable
// offline + while a run is still in flight).
const DETERMINATE_FAILURES = new Set([
  'action_required',
  'cancelled',
  'failure',
  'startup_failure',
  'timed_out',
])

/**
 * The CI conclusion for an EXACT socket-registry commit SHA. Queries by
 * `--commit <sha>` (the whole point — see the file header). Prefers the CI
 * workflow, falls back to the first run. Returns a human-readable conclusion
 * string: `success`, a determinate failure (`failure`, `cancelled`, …),
 * `in-progress (<status>)`, `no-run-yet`, or `unknown (<reason>)`.
 */
export function ciConclusionForSha(sha: string): string {
  const r = spawnSync('gh', [
    'run',
    'list',
    '--repo',
    REGISTRY_SLUG,
    '--commit',
    sha,
    '--json',
    'workflowName,status,conclusion',
  ])
  if (r.status !== 0) {
    const stderr = typeof r.stderr === 'string' ? r.stderr : ''
    return `unknown (gh: ${stderr.trim().slice(0, 120)})`
  }
  let runs: Array<{
    conclusion?: string | undefined
    status?: string | undefined
    workflowName?: string | undefined
  }>
  try {
    runs = JSON.parse(String(r.stdout) || '[]') as typeof runs
  } catch {
    return 'unknown (unparseable gh output)'
  }
  const ci = runs.find(x => (x.workflowName ?? '').includes('CI'))
  const pick = ci ?? runs[0]
  if (!pick) {
    return 'no-run-yet'
  }
  if (pick.status !== 'completed') {
    return `in-progress (${pick.status ?? 'pending'})`
  }
  return pick.conclusion ?? 'unknown'
}

/**
 * Whether a conclusion string means the SHA's CI passed.
 */
export function isGreen(conclusion: string): boolean {
  return conclusion === 'success'
}

/**
 * Whether a conclusion is a DETERMINATE failure (CI completed, did not pass).
 * `unknown`/`in-progress`/`no-run-yet` are NOT determinate failures.
 */
export function isDeterminateFailure(conclusion: string): boolean {
  return DETERMINATE_FAILURES.has(conclusion)
}

export interface GateOptions {
  // strict (default): require `success` — anything else (incl. in-progress /
  // no-run-yet / offline) throws. Use for the propagation push (a SHA that has
  // not gone green must never become the canonical pin).
  // best-effort (`strict: false`): throw only on a determinate failure;
  // unknown/in-progress/no-run-yet pass. Use for the consumer sync so an offline
  // run or an in-flight CI doesn't falsely block — but a confirmed-red source
  // still fails loud.
  strict?: boolean | undefined
}

/**
 * The single gate. Throws when `sha`'s socket-registry CI isn't trustworthy for
 * the chosen mode (see GateOptions). The thrown message names the SHA + its
 * conclusion + the canonical fix. Callers gate the EXACT SHA they are about to
 * propagate or pin — never the latest branch run.
 */
export function assertPropagationShaIsGreen(
  sha: string,
  options?: GateOptions | undefined,
): void {
  const { strict = true } = { __proto__: null, ...options } as GateOptions
  const conclusion = ciConclusionForSha(sha)
  if (isGreen(conclusion)) {
    return
  }
  if (!strict && !isDeterminateFailure(conclusion)) {
    // Best-effort: offline / in-progress / no-run-yet does not block.
    return
  }
  throw new Error(
    `socket-registry propagation SHA ${sha.slice(0, 12)} CI is "${conclusion}", not "success" — ` +
      `refusing to ${strict ? 'propagate' : 'sync to'} a non-green SHA. This is an UPSTREAM ` +
      `socket-registry CI failure; fix it so the SHA goes green. Gate the EXACT SHA (gh run list ` +
      `--commit <sha>), never the latest branch run.`,
  )
}
