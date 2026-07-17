#!/usr/bin/env node
/*
 * @file Commit-time dedup gate — the code-as-law surface the
 *   `deduping-dependencies` skill cites. Parses `pnpm-lock.yaml` and reports
 *   two avoidable shapes the dedup decision tree is meant to eliminate:
 *
 *   1. CROSS-MAJOR DUPLICATES — a package resolved at more than one distinct
 *      major version in the install tree. Each extra major is dead weight
 *      (more bytes, more attack surface, bigger bundles). The skill's decision
 *      tree classifies whether a given family is collapsible; this gate just
 *      surfaces the family so it can't silently re-accumulate.
 *   2. UN-REDIRECTED DROP-INS — a package that has a known
 *      `@socketregistry/<name>` hardened drop-in yet still resolves from npm
 *      under its own bare name. The drop-in universe is learned from the
 *      RESOLVED world: every `@socketregistry/*` name the lockfile mentions
 *      (override values, resolved package keys, importer specifiers) plus the
 *      cascaded fleet catalog (`.config/fleet/pnpm-workspace.fleet.yaml`).
 *      pnpm rewrites every matching resolution when a redirect override is
 *      present, so a surviving bare package key IS a missing redirect — ranged
 *      overrides that let an old major escape included. A `@socketregistry/*`
 *      drop-in is Socket-published + audited + API-transparent and
 *      soak-exempt, so an un-redirected copy is a free hardening + dedup win
 *      left on the table.
 *
 *   The judgment (which collapse is safe — format-flip vs API break, the
 *   consumer-grep) stays in the skill; this is the mechanical scan only.
 *
 *   Cross-major enforcement is AUTO-GATED on rolldown — not a config opt-in and
 *   no "reviewed" escape list: a repo that bundles with rolldown pays real bytes
 *   for every duplicate major, so the bar is ZERO dups. Any cross-major family
 *   is a hard failure there — collapse it (force the format-flips, `pnpm patch`-
 *   and-force the API-breaks). Rolldown use is detected from a rolldown
 *   (dev)dependency OR a rolldown config file (scripts/plugins that bundle). A
 *   non-bundling repo keeps the cross-major report informational (exit 0). A
 *   missing `@socketregistry` redirect is always a hard failure (the redirect is
 *   safe to add). No-ops when `pnpm-lock.yaml` is absent. Exit codes:
 *
 *   - 0 — no missing `@socketregistry` redirect, and (rolldown repo) zero
 *     cross-major duplicates.
 *   - 1 — a missing `@socketregistry` redirect, or any cross-major duplicate in
 *     a rolldown repo.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { FLEET_CATALOG_YAML, PNPM_LOCK } from '../paths.mts'
import { isMainModule } from '../_shared/is-main-module.mts'

// A `packages:` (or `snapshots:`) key: `'<name>@<version>':` where name may be
// scoped (`@scope/pkg`). Indented exactly two spaces under the section header.
const PACKAGE_KEY_RE =
  /^ {2}'?((?:@[^@/'\s]+\/)?[^@'\s]+)@([^'\s(]+)(?:\([^)]*\))*'?:\s*$/
// Every `@socketregistry/<name>` mention in a text — override values
// (`npm:@socketregistry/x@1`), resolved package keys
// (`'@socketregistry/x@1.0.0':`), importer specifiers, catalog entries. The
// captured <name> is the drop-in's basename; socket-registry publishes each
// drop-in under its upstream package's name (a scoped upstream `@scope/pkg`
// is encoded `scope__pkg`).
const SOCKET_REGISTRY_NAME_RE = /@socketregistry\/([A-Za-z0-9._-]+)/g

export interface DuplicateFamily {
  name: string
  majors: string[]
}

export interface UnredirectedDropIn {
  name: string
  dropIn: string
}

export interface ScanResult {
  duplicates: DuplicateFamily[]
  unredirected: UnredirectedDropIn[]
}

// Rolldown config filenames a repo bundles from — scripts/plugins that use
// rolldown even without a direct package.json dep. Checked at repo root and
// under `.config/{fleet,repo}/`.
const ROLLDOWN_CONFIG_BASENAMES: readonly string[] = [
  'rolldown.config.mts',
  'rolldown.config.ts',
  'rolldown.config.mjs',
  'rolldown.config.js',
]

// A repo may use Rolldown only as a compiler while keeping every runtime
// dependency external. Those lockfile entries never reach the shipped bundle,
// so treating its dev-tool graph as a bundle-size failure is a false positive.
// This recognizes the canonical `external: externalDependencies` configuration
// after verifying that the variable is derived from package.json dependencies.
function externalizesAllRuntimeDependencies(repoRoot: string): boolean {
  const dirs = [
    repoRoot,
    path.join(repoRoot, '.config', 'fleet'),
    path.join(repoRoot, '.config', 'repo'),
  ]
  for (const dir of dirs) {
    for (const basename of ROLLDOWN_CONFIG_BASENAMES) {
      try {
        const config = readFileSync(path.join(dir, basename), 'utf8')
        if (
          /const\s+externalDependencies\s*=\s*Object\.keys\(\s*packageJson\.dependencies\s*\|\|\s*\{\}\s*\)/.test(
            config,
          ) && /external:\s*externalDependencies\b/.test(config)
        ) {
          return true
        }
      } catch {
        // Missing config files are normal for the other candidate directories.
      }
    }
  }
  return false
}

// True when the repo uses Rolldown and third-party dependency code can reach
// its output. In that case every extra major costs shipped bytes and is gated.
// A compiler-only Rolldown config with all runtime deps external remains
// informational: it has no bundled dependency closure to deduplicate.
export function repoUsesRolldown(repoRoot: string): boolean {
  let pkgRaw: string | undefined
  try {
    pkgRaw = readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  } catch {
    pkgRaw = undefined
  }
  if (pkgRaw) {
    const pkg = JSON.parse(pkgRaw) as {
      dependencies?: Record<string, string> | undefined
      devDependencies?: Record<string, string> | undefined
    }
    if (pkg.dependencies?.['rolldown'] ?? pkg.devDependencies?.['rolldown']) {
      return !externalizesAllRuntimeDependencies(repoRoot)
    }
  }
  const dirs = [
    repoRoot,
    path.join(repoRoot, '.config', 'fleet'),
    path.join(repoRoot, '.config', 'repo'),
  ]
  for (let i = 0, { length } = dirs; i < length; i += 1) {
    for (let j = 0, n = ROLLDOWN_CONFIG_BASENAMES.length; j < n; j += 1) {
      if (existsSync(path.join(dirs[i]!, ROLLDOWN_CONFIG_BASENAMES[j]!))) {
        return !externalizesAllRuntimeDependencies(repoRoot)
      }
    }
  }
  return false
}

// Reduce a semver-ish version string to its major component. A `0.x` package
// treats the MINOR as the breaking axis (semver's pre-1.0 rule), so
// `0.30.21` → `0.30` while `7.8.1` → `7`. Keeps a bare/odd version intact.
export function majorOf(version: string): string {
  const parts = version.split('.')
  const first = parts[0] ?? version
  if (first === '0' && parts.length > 1) {
    return `0.${parts[1]}`
  }
  return first
}

// A resolved version is semver-shaped when it starts with a digit. Git / tarball
// URL resolutions (`https://….tar.gz`, `git+ssh://…`) and other non-registry
// sources are NOT npm majors — they are source-pinned deps (e.g. a
// `packages/npm/<pkg>` drop-in testing against its upstream git tarball) that
// never reach the rolldown bundle, so they must not count toward cross-major
// dedup. Filtering them keeps the analysis to real registry majors.
export function isSemverVersion(version: string): boolean {
  return /^\d/.test(version)
}

// Collect every `<name>@<version>` key under a top-level section (`packages:`
// or `snapshots:`), returning name → set of distinct versions.
function collectResolvedVersions(lines: string[]): Map<string, Set<string>> {
  const byName = new Map<string, Set<string>>()
  let inSection = false
  for (let i = 0, { length } = lines; i < length; i += 1) {
    const line = lines[i] ?? ''
    if (line === 'packages:' || line === 'snapshots:') {
      inSection = true
      continue
    }
    // A new unindented top-level key ends the section.
    if (inSection && /^[A-Za-z_]/.test(line)) {
      inSection = false
      continue
    }
    if (!inSection) {
      continue
    }
    const m = PACKAGE_KEY_RE.exec(line)
    if (!m) {
      continue
    }
    const name = m[1]!
    const version = m[2]!
    let versions = byName.get(name)
    if (!versions) {
      versions = new Set<string>()
      byName.set(name, versions)
    }
    versions.add(version)
  }
  return byName
}

// Decode a drop-in basename back to the upstream package name it hardens
// (socket-registry's `scope__pkg` encoding for scoped upstreams).
function upstreamNameOf(dropIn: string): string {
  const sep = dropIn.indexOf('__')
  if (sep > 0) {
    return `@${dropIn.slice(0, sep)}/${dropIn.slice(sep + 2)}`
  }
  return dropIn
}

// Harvest the drop-in universe — every `@socketregistry/<name>` mentioned in
// the given texts. Textual on purpose: the lockfile mentions drop-ins in
// override values, resolved package keys, and importer specifiers, and the
// fleet catalog in entry keys and npm: alias values; all of them attest that
// `@socketregistry/<name>` exists as a published hardened package.
function collectDropInUniverse(texts: readonly string[]): Set<string> {
  const universe = new Set<string>()
  for (const text of texts) {
    for (const m of text.matchAll(SOCKET_REGISTRY_NAME_RE)) {
      universe.add(m[1]!)
    }
  }
  return universe
}

export interface ScanOptions {
  // Text of the cascaded fleet catalog
  // (`.config/fleet/pnpm-workspace.fleet.yaml`) when present — its
  // `@socketregistry/*` entries extend the drop-in universe beyond what the
  // lockfile already resolves.
  fleetCatalogText?: string | undefined
}

export function scan(
  text: string,
  options?: ScanOptions | undefined,
): ScanResult {
  const opts = { __proto__: null, ...options } as ScanOptions
  const lines = text.split('\n')
  const byName = collectResolvedVersions(lines)

  const duplicates: DuplicateFamily[] = []
  for (const [name, versions] of byName) {
    // Count registry semver resolutions only. A git or tarball URL resolution
    // is not an npm major and is excluded from cross-major dedup.
    const majors = [
      ...new Set([...versions].filter(isSemverVersion).map(majorOf)),
    ].toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    if (majors.length > 1) {
      duplicates.push({ majors, name })
    }
  }
  duplicates.sort((a, b) => a.name.localeCompare(b.name))

  // A universe name still resolving from npm under its bare upstream name
  // means the hardened copy was never wired in for that copy — pnpm rewrites
  // every matching resolution when a redirect override is present, so a
  // surviving bare package key IS the missing redirect (a version-pin
  // override keeps the bare resolution and so still flags; only the
  // npm:@socketregistry/... alias redirect clears it).
  const universe = collectDropInUniverse([text, opts.fleetCatalogText ?? ''])
  const unredirected: UnredirectedDropIn[] = []
  for (const dropIn of universe) {
    const name = upstreamNameOf(dropIn)
    if (byName.has(name)) {
      unredirected.push({ dropIn, name })
    }
  }
  unredirected.sort((a, b) => a.name.localeCompare(b.name))

  return { duplicates, unredirected }
}

function main(): void {
  let content: string
  try {
    content = readFileSync(PNPM_LOCK, 'utf8')
  } catch {
    // No pnpm-lock.yaml — not an installed workspace, nothing to check.
    process.exit(0)
  }
  let fleetCatalogText: string | undefined
  try {
    fleetCatalogText = readFileSync(FLEET_CATALOG_YAML, 'utf8')
  } catch {
    // Catalog absent (repo mid-transition / non-fleet checkout) — the
    // lockfile-learned drop-in universe still applies.
    fleetCatalogText = undefined
  }
  const { duplicates, unredirected } = scan(content, { fleetCatalogText })
  // Auto-gated on rolldown, no opt-in: a repo that bundles with rolldown pays
  // real bytes for every duplicate major, so there ANY cross-major family is a
  // hard failure — the bar is zero dups (force the format-flips, patch-and-force
  // the API-breaks). A non-bundling repo keeps the report informational.
  const enforce = repoUsesRolldown(path.dirname(PNPM_LOCK))
  let failed = false

  if (duplicates.length > 0) {
    process.stderr.write(
      `[check-dependencies-are-deduped] ${duplicates.length} package` +
        `${duplicates.length === 1 ? '' : 's'} resolved at >1 major ` +
        `(${enforce ? 'MUST collapse — this repo bundles with rolldown' : 'collapse candidates'}):\n`,
    )
    for (let i = 0, { length } = duplicates; i < length; i += 1) {
      const f = duplicates[i]!
      process.stderr.write(`  ${f.name}: majors ${f.majors.join(', ')}\n`)
    }
    process.stderr.write(
      `\nDrive duplicate majors to zero — force the format-flips, pnpm ` +
        `patch-and-force the API-breaks. See\n` +
        `.claude/skills/fleet/deduping-dependencies/SKILL.md.\n\n`,
    )
    if (enforce) {
      failed = true
    }
  }

  if (unredirected.length > 0) {
    process.stderr.write(
      `[check-dependencies-are-deduped] ${unredirected.length} package` +
        `${unredirected.length === 1 ? '' : 's'} with a @socketregistry ` +
        `drop-in but no redirect:\n`,
    )
    for (let i = 0, { length } = unredirected; i < length; i += 1) {
      const f = unredirected[i]!
      process.stderr.write(`  ${f.name} → @socketregistry/${f.dropIn}\n`)
    }
    process.stderr.write(
      `\nAdd the redirect to overrides: in pnpm-workspace.yaml (fleet-canonical\n` +
        `via FLEET_CANONICAL_OVERRIDES). A @socketregistry drop-in is audited +\n` +
        `soak-exempt — the redirect is always safe. See\n` +
        `.claude/skills/fleet/deduping-dependencies/SKILL.md.\n`,
    )
    failed = true
  }

  process.exit(failed ? 1 : 0)
}

// Run only when invoked directly (CLI / CI), not when imported by the unit
// tests for `scan` — `main()` calls `process.exit`, which would tear down the
// test runner mid-suite.
if (isMainModule(import.meta.url)) {
  main()
}
