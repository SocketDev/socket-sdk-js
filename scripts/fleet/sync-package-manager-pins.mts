#!/usr/bin/env node
/*
 * @file Single source of truth for the package-manager version pins. The pnpm
 *   and npm versions are authored ONCE in external-tools.json
 *   (tools.{pnpm,npm}.version); this derives package.json's `packageManager`
 *   + `engines.pnpm` + `engines.npm` from them, so the version is never
 *   hand-maintained in three places. `engines.node` is left untouched (a
 *   separate floor owned by the node-version rule). Run it after a bump
 *   (update-external-tools.mts calls it; `pnpm run update` runs it) to
 *   propagate; the package-manager-pins-are-synced check gates drift in CI.
 *
 *   Drift is DIRECTIONAL and bites on the ENGINES floors. When an engines
 *   floor trails a newer external-tools.json (a wheelhouse bump not yet
 *   cascaded into this repo), the check WARNS and continues — a cascade
 *   reconciles it, and failing would block unrelated member PRs during a
 *   rollout window. An engines floor AHEAD of the source (or otherwise
 *   inconsistent) still fails. The `packageManager` field is a forgiving floor
 *   (`pnpm@>=<floor>`): with `managePackageManagerVersions:false` +
 *   `pmOnFail:warn` it never hard-fails an install, so a drift there always
 *   WARNS — the enforced gate is `engines.pnpm`, not this field.
 *
 *   Usage: node scripts/fleet/sync-package-manager-pins.mts [--check] [--quiet]
 *     (no flag) rewrite package.json to match external-tools.json
 *     --check     warn on a behind pin, exit non-zero only on real drift
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

import { REPO_ROOT } from './paths.mts'

const logger = getDefaultLogger()

export interface ManagerPins {
  packageManager: string
  enginesPnpm: string
  enginesNpm: string
}

export interface PinDrift {
  field: string
  actual: string
  expected: string
}

export type PinDriftClass = 'synced' | 'behind' | 'drifted'

/**
 * Derive the package.json pins from the external-tools.json version fields.
 * `packageManager` + `engines.pnpm` are BOTH forgiving floors
 * (`pnpm@>=<floor>` / `>=<floor>`): the fleet runs
 * `managePackageManagerVersions: false` + `pmOnFail: warn`, so pnpm tolerates a
 * range in `packageManager` and the exact pnpm is pinned by the CI setup action
 * (external-tools.json), not this field. The floor is read from root
 * `engines.pnpm` — a pnpm bump never re-pins it and never breaks a member on an
 * older cascade. When `pnpmFloor` is absent the function falls back to
 * `pnpmVersion`. `enginesNpm` is the npm floor.
 */
export function derivePins(
  pnpmVersion: string,
  npmVersion: string,
  options?: { pnpmFloor?: string | undefined },
): ManagerPins {
  const opts = { __proto__: null, ...options } as {
    pnpmFloor?: string | undefined
  }
  const pnpmFloor = opts.pnpmFloor ?? pnpmVersion
  return {
    __proto__: null,
    packageManager: `pnpm@>=${pnpmFloor}`,
    enginesPnpm: `>=${pnpmFloor}`,
    enginesNpm: `>=${npmVersion}`,
  } as ManagerPins
}

/**
 * Apply derived pins to a parsed package.json object, mutating it in place.
 * Returns the structured list of fields that changed (empty = already in
 * sync). Only `packageManager` + `engines.{pnpm,npm}` are touched.
 */
export function applyPins(
  pkg: Record<string, unknown>,
  pins: ManagerPins,
): PinDrift[] {
  const drift: PinDrift[] = []
  const engines = (pkg['engines'] ?? {}) as Record<string, unknown>
  if (pkg['packageManager'] !== pins.packageManager) {
    drift.push({
      __proto__: null,
      field: 'packageManager',
      actual: String(pkg['packageManager']),
      expected: pins.packageManager,
    } as PinDrift)
    pkg['packageManager'] = pins.packageManager
  }
  if (engines['pnpm'] !== pins.enginesPnpm) {
    drift.push({
      __proto__: null,
      field: 'engines.pnpm',
      actual: String(engines['pnpm']),
      expected: pins.enginesPnpm,
    } as PinDrift)
    engines['pnpm'] = pins.enginesPnpm
  }
  if (engines['npm'] !== pins.enginesNpm) {
    drift.push({
      __proto__: null,
      field: 'engines.npm',
      actual: String(engines['npm']),
      expected: pins.enginesNpm,
    } as PinDrift)
    engines['npm'] = pins.enginesNpm
  }
  pkg['engines'] = engines
  return drift
}

/**
 * Render a drift entry for logs: `engines.pnpm: >=11.7.0 → >=11.8.0`.
 */
export function formatDrift(drift: PinDrift): string {
  return `${drift.field}: ${drift.actual} → ${drift.expected}`
}

/**
 * Extract a bare `X.Y.Z` from a pin field — handles `pnpm@11.8.0`, `>=11.8.0`,
 * and a plain `11.8.0`. Returns undefined when no version is present (e.g. the
 * field was absent, so `actual` is the string `"undefined"`).
 */
export function extractPinVersion(field: string): string | undefined {
  // One named capture (consumed below): a leading range/prefix is skipped and
  // the X.Y.Z (plus any prerelease/build tail) is captured.
  const match = /(?<version>\d+\.\d+\.\d+(?:[-+][\w.]+)?)/.exec(field)
  return match?.groups?.['version']
}

/**
 * Compare two `X.Y.Z` versions numerically. Returns -1/0/1. Prerelease/build
 * tails are ignored — the package-manager pins are always clean releases.
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(part => Number.parseInt(part, 10) || 0)
  const pb = b.split('.').map(part => Number.parseInt(part, 10) || 0)
  for (let i = 0; i < 3; i += 1) {
    const delta = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (delta !== 0) {
      return delta < 0 ? -1 : 1
    }
  }
  return 0
}

/**
 * True when a drift is benign (warn, do not fail). Two cases:
 *   1. An engines floor trails the source (external-tools.json is newer) — the
 *      cascade-pending state; a cascade reconciles it, and failing would block
 *      an unrelated member PR during a rollout window.
 *   2. Any `packageManager` drift — the field is a forgiving floor and, with
 *      `managePackageManagerVersions:false` + `pmOnFail:warn`, never hard-fails
 *      an install (the enforced gate is `engines.pnpm`), so an exact→floor
 *      reshape or version delta here is always a pending reconcile, never a
 *      hard failure.
 */
export function isBehindSource(drift: PinDrift): boolean {
  if (drift.field === 'packageManager') {
    return true
  }
  const actual = extractPinVersion(drift.actual)
  const expected = extractPinVersion(drift.expected)
  if (!actual || !expected) {
    return false
  }
  return compareSemver(actual, expected) < 0
}

/**
 * Classify a drift set. `synced` = no drift. `behind` = EVERY drift is benign
 * (an engines floor trailing a newer source, or any `packageManager` reshape)
 * → warn, do not fail. `drifted` = at least one engines floor is ahead of the
 * source or otherwise inconsistent (a hand-edit) → fail.
 */
export function classifyPinDrift(drift: readonly PinDrift[]): PinDriftClass {
  if (!drift.length) {
    return 'synced'
  }
  return drift.every(isBehindSource) ? 'behind' : 'drifted'
}

/**
 * Read the pnpm + npm version fields out of an external-tools.json object.
 * Throws a UI-quality error naming the missing field when either is absent.
 */
export function readToolVersions(externalTools: Record<string, unknown>): {
  pnpmVersion: string
  npmVersion: string
} {
  const tools = (externalTools['tools'] ?? {}) as Record<
    string,
    { version?: string | undefined }
  >
  const pnpmVersion = tools['pnpm']?.version
  const npmVersion = tools['npm']?.version
  if (!pnpmVersion || !npmVersion) {
    throw new Error(
      'external-tools.json is missing tools.pnpm.version and/or tools.npm.version — ' +
        'the package-manager pins derive from those two fields.',
    )
  }
  return { pnpmVersion, npmVersion }
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>
}

function readPnpmFloor(pkgJson: Record<string, unknown>): string | undefined {
  const engines = pkgJson['engines']
  if (!engines || typeof engines !== 'object') {
    return undefined
  }
  const pnpm = (engines as Record<string, unknown>)['pnpm']
  if (typeof pnpm !== 'string') {
    return undefined
  }
  const match = /^>=([0-9.]+)$/.exec(pnpm)
  return match?.[1]
}

function main(): number {
  const checkOnly = process.argv.includes('--check')
  const quiet = process.argv.includes('--quiet')
  const extPath = path.join(
    REPO_ROOT,
    'scripts/fleet/setup/external-tools.json',
  )
  const pkgPath = path.join(REPO_ROOT, 'package.json')
  const { npmVersion, pnpmVersion } = readToolVersions(readJson(extPath))
  const pkg = readJson(pkgPath)
  const pnpmFloor = readPnpmFloor(pkg)
  const pins = derivePins(pnpmVersion, npmVersion, { pnpmFloor })
  const drift = applyPins(pkg, pins)
  if (!drift.length) {
    if (!quiet) {
      logger.success(
        `[sync-package-manager-pins] package.json pins match external-tools.json (pnpm@${pnpmVersion}, npm@${npmVersion}).`,
      )
    }
    return 0
  }
  if (checkOnly) {
    if (classifyPinDrift(drift) === 'behind') {
      logger.warn(
        '[sync-package-manager-pins] package.json pins trail external-tools.json — a wheelhouse package-manager bump has not cascaded into this repo yet:',
      )
      logger.group()
      for (let i = 0, { length } = drift; i < length; i += 1) {
        logger.warn(formatDrift(drift[i]!))
      }
      logger.groupEnd()
      logger.log(
        'The install uses the newer source version. Cascade the wheelhouse to sync the pin: node scripts/fleet/sync-package-manager-pins.mts (or a full cascade).',
      )
      return 0
    }
    logger.fail(
      '[sync-package-manager-pins] package.json pins drifted from external-tools.json (the single source):',
    )
    logger.group()
    for (let i = 0, { length } = drift; i < length; i += 1) {
      logger.fail(formatDrift(drift[i]!))
    }
    logger.groupEnd()
    logger.error(
      'Fix: node scripts/fleet/sync-package-manager-pins.mts (regenerates the pins).',
    )
    process.exitCode = 1
    return 1
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  logger.success(
    '[sync-package-manager-pins] synced package.json pins from external-tools.json:',
  )
  for (let i = 0, { length } = drift; i < length; i += 1) {
    logger.substep(formatDrift(drift[i]!))
  }
  return 0
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
