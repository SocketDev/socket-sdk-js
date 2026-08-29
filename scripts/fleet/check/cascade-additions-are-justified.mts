#!/usr/bin/env node
/*
 * @file `check --all` gate: a file joins the COMMIT CASCADE only when
 *   something outside our runtime reads it from the committed tree.
 *   Everything else rides the fleet-pack.
 *
 *   The pack is the default on purpose. A tracked cascade entry lands a real
 *   commit in every member on every change, so the cascade's cost scales with
 *   how many files it carries. A packed file costs one bundle the member
 *   already downloads. Adding to the cascade is therefore the expensive
 *   choice, and this gate makes it the deliberate one.
 *
 *   The bar is a NAMED READER, not prose. Every tracked entry declares
 *   `trackedReason` from a closed set, and each value answers the same
 *   question: who reads this before, or without, our fetch ever running?
 *
 *     git              git itself, before any hydration (.git-hooks/*).
 *     github-actions   GitHub, from the committed tree (workflows, actions).
 *     github-readme    GitHub's markdown renderer, at rest (README art).
 *     dep-0            read before the fetch that would deliver it (.npmrc,
 *                      the bootstrap seed) — the chicken-and-egg case.
 *     editor-toolchain an editor or toolchain that never runs our code
 *                      (.editorconfig, a tsconfig an IDE resolves).
 *
 *   If no value fits, the pack can carry it, and that is the answer.
 *
 *   HYBRID entries are exempt. A hybrid file has a member-owned half, so it
 *   must exist in the member's own commit no matter what the pack ships.
 *
 *   Wheelhouse-only: `bundle.json` is the cascade's source and no member has
 *   one. The gate reports a clean skip there rather than a false pass.
 *
 *   Exit: 0 — every tracked entry names a reader; 1 — one does not, or names
 *   a value outside the set.
 *
 *   Usage: node scripts/fleet/check/cascade-additions-are-justified.mts [--quiet]
 *          node scripts/fleet/check/cascade-additions-are-justified.mts --self-test
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'

import { isMainModule } from '../_shared/is-main-module.mts'
import { runMain } from '../_shared/run-main.mts'
import { REPO_ROOT, resolveSyncScaffoldingManifestDir } from '../paths.mts'

import type { ScriptMeta } from '../_shared/run-main.mts'

/**
 * The sanctioned readers. A tracked entry names exactly one.
 *
 * Closed on purpose: a free-text field would accept any sentence, and the
 * point of the gate is that the author has to find a real reader or reach for
 * the pack instead.
 */
export const TRACKED_READERS: readonly string[] = [
  'dep-0',
  'editor-toolchain',
  'git',
  'github-actions',
  'github-readme',
]

/**
 * The channels whose entries can carry `tracked`.
 */
const TRACKED_CHANNELS: readonly string[] = ['extras', 'mirror', 'optional']

interface ChannelEntry {
  path?: string | undefined
  tracked?: boolean | undefined
  hybrid?: unknown | undefined
  trackedReason?: string | undefined
}

export interface CascadeViolation {
  readonly channel: string
  readonly path: string
  readonly problem: 'missing' | 'unknown'
  readonly saw?: string | undefined
}

/**
 * Every tracked entry that fails to name a sanctioned reader.
 *
 * A hybrid entry is skipped: its member-owned half has to live in the
 * member's commit, so the pack is not an option for it.
 */
export function findCascadeViolations(bundle: unknown): CascadeViolation[] {
  const violations: CascadeViolation[] = []
  if (bundle === null || typeof bundle !== 'object') {
    return violations
  }
  const channels = bundle as Record<string, unknown>
  for (let i = 0, { length } = TRACKED_CHANNELS; i < length; i += 1) {
    const channel = TRACKED_CHANNELS[i]!
    const items = channels[channel]
    if (!Array.isArray(items)) {
      continue
    }
    for (let j = 0, { length: count } = items; j < count; j += 1) {
      const entry = items[j] as ChannelEntry | undefined
      if (
        entry === undefined ||
        entry.tracked !== true ||
        entry.hybrid !== undefined
      ) {
        continue
      }
      const reason = entry.trackedReason
      if (reason === undefined) {
        violations.push({
          channel,
          path: entry.path ?? '(unnamed)',
          problem: 'missing',
        })
      } else if (!TRACKED_READERS.includes(reason)) {
        violations.push({
          channel,
          path: entry.path ?? '(unnamed)',
          problem: 'unknown',
          saw: reason,
        })
      }
    }
  }
  return violations
}

/**
 * The What/Where/Saw/Fix block for one violation.
 */
export function violationReport(violation: CascadeViolation): string {
  const readers = TRACKED_READERS.join(', ')
  return violation.problem === 'missing'
    ? [
        `What: the tracked cascade entry "${violation.path}" names no reader.`,
        `Where: bundle.json, ${violation.channel} channel`,
        'Saw: tracked: true with no trackedReason; wanted one of the sanctioned readers.',
        `Fix: set trackedReason to one of: ${readers}. If none fits, the fleet-pack can carry this file — drop tracked instead.`,
      ].join('\n')
    : [
        `What: the tracked cascade entry "${violation.path}" names an unknown reader.`,
        `Where: bundle.json, ${violation.channel} channel`,
        `Saw: trackedReason "${violation.saw}"; wanted one of the sanctioned readers.`,
        `Fix: use one of: ${readers}. The set is closed so a new entry has to name a real reader rather than argue for itself.`,
      ].join('\n')
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const logger = getDefaultLogger()
  const quiet = argv.includes('--quiet')
  const selfTest = argv.includes('--self-test')

  const bundlePath = path.join(
    resolveSyncScaffoldingManifestDir(REPO_ROOT),
    'bundle.json',
  )
  if (!existsSync(bundlePath)) {
    if (!quiet) {
      logger.log(
        '[cascade-additions-are-justified] no bundle.json here — the cascade source is wheelhouse-only.',
      )
    }
    return 0
  }

  // `--self-test` drives a planted violation through the real matcher, so a
  // matcher that stopped firing cannot report green.
  if (selfTest) {
    const planted = findCascadeViolations({
      mirror: [{ path: 'planted/entry', tracked: true }],
    })
    if (planted.length !== 1 || planted[0]?.problem !== 'missing') {
      logger.error(
        '[cascade-additions-are-justified] SELF-TEST FAILED: a planted unjustified entry went undetected.',
      )
      return 1
    }
  }

  const violations = findCascadeViolations(
    JSON.parse(readFileSync(bundlePath, 'utf8')),
  )
  if (violations.length) {
    logger.error('[cascade-additions-are-justified] FAILED:')
    logger.group()
    for (let i = 0, { length } = violations; i < length; i += 1) {
      logger.fail(violationReport(violations[i]!))
    }
    logger.groupEnd()
    return 1
  }

  if (!quiet) {
    logger.success(
      `[cascade-additions-are-justified] every tracked cascade entry names a sanctioned reader${selfTest ? '. Self-test passed.' : '.'}`,
    )
  }
  return 0
}

const SCRIPT_META: ScriptMeta = {
  describe:
    'checks every tracked cascade entry names a sanctioned reader, so the fleet-pack stays the default',
  help: 'Usage: node scripts/fleet/check/cascade-additions-are-justified.mts [--quiet] [--self-test]',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
