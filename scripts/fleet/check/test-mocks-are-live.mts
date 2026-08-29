#!/usr/bin/env node
/*
 * @file `check --all` gate: every `vi.mock(...)` in a test names a module the
 *   code under test actually reaches. A mock whose target nothing imports does
 *   not fail - it simply stops intercepting, and the assertions around it run
 *   against the real code path and pass for the wrong reason.
 *
 *   Measured: the check-new-deps suite kept mocking `@socketsecurity/sdk` after
 *   the hook moved to `httpRequest`. Every malware-blocking assertion ran with
 *   no interception at all. The suite stayed green, and the hook's whole
 *   blocking path was untested until a transport change happened to break it
 *   loudly. A dead mock is worse than a missing one: it reads as coverage.
 *
 *   How the reach set is built: the test's own relative imports are the modules
 *   under test, and their relative imports are followed transitively to a depth
 *   cap. Every bare specifier seen along the way is reachable. A mocked
 *   specifier outside that set is dead.
 *
 *   Alias tolerance: the fleet imports `@socketsecurity/lib-stable`, a pnpm
 *   alias, while a mock may name the real package. Comparison strips a
 *   `-stable` segment from both sides, so the alias and its target match.
 *
 *   Deliberately quiet where it cannot be sure: a test that mocks something it
 *   imports directly, a dynamic specifier it cannot read statically, or a
 *   builtin, all pass. The gate exists to catch a specifier no longer present
 *   anywhere, which is unambiguous.
 *
 *   Runs per-tree. Exit: 0 - clean; 1 - a dead mock.
 *
 *   Usage: node scripts/fleet/check/test-mocks-are-live.mts [--quiet]
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { normalizePath } from '@socketsecurity/lib-stable/paths/normalize'

import { REPO_ROOT } from '../paths.mts'
import { isMainModule } from '../_shared/is-main-module.mts'
import { runMain } from '../_shared/run-main.mts'

import type { ScriptMeta } from '../_shared/run-main.mts'

const logger = getDefaultLogger()

// How far to follow relative imports out of a test file. Three hops reaches a
// hook, its _shared helpers, and their helpers, which is where a transport
// import lives. Deeper costs I/O for reach that no longer says much about what
// the test is exercising.
const MAX_DEPTH = 3

// Directories with nothing under test: dependencies, build output, and the
// vendored trees a walk would otherwise spend most of its time in.
const SKIP_DIRS = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'upstream',
])

// require-regex-comment: a `.test.` or `.spec.` segment before a js/ts
// extension, which is how every runner in the fleet names a test file.
const TEST_FILE_RE = /\.(?:spec|test)\.[cm]?[jt]sx?$/

// require-regex-comment: `vi.mock(` then either a quoted specifier or an
// `import('...')` form, capturing whichever quote style is used.
const MOCK_CALL_RE =
  /\bvi\s*\.\s*mock\s*\(\s*(?:import\s*\(\s*)?["'`]([^"'`]+)["'`]/g

// require-regex-comment: three import forms, all of which reach real code:
// a static `from '...'`, a bare side-effect `import '...'`, and the CALL form
// `import('...')`. The call form matters most here - a `*-main.test.mts` loads
// the module under test dynamically, so missing it emptied the reach set and
// reported every correct mock in the file as dead.
const IMPORT_RE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'`]([^"'`]+)["'`]/g

/**
 * Every specifier `vi.mock` names in `source`.
 *
 * Both spellings are collected: `vi.mock('x')` and the
 * `vi.mock(import('x'))` form the fleet's prefer-mock-import rule wants.
 */
/**
 * Whether `index` falls inside a string literal on its own line.
 *
 * A test that exercises a mock-DETECTING guard carries `vi.mock('x')` inside a
 * fixture string. Scanning raw text cannot tell that from a real call, and
 * reporting it would make this gate fire on the very tests that protect the
 * same property. Counting unescaped quotes before the match on its line is
 * enough: an odd count means the match is quoted.
 */
export function isInsideStringLiteral(source: string, index: number): boolean {
  const lineStart = source.lastIndexOf('\n', index) + 1
  const before = source.slice(lineStart, index)
  let quotes = 0
  for (let i = 0, { length } = before; i < length; i += 1) {
    const ch = before[i]!
    if (ch === '\\') {
      i += 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quotes += 1
    }
  }
  return quotes % 2 === 1
}

export function mockedSpecifiers(source: string): string[] {
  const found: string[] = []
  MOCK_CALL_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MOCK_CALL_RE.exec(source)) !== null) {
    if (isInsideStringLiteral(source, match.index)) {
      continue
    }
    found.push(match[1]!)
  }
  return found
}

/**
 * Every specifier `source` imports.
 */
export function importedSpecifiers(source: string): string[] {
  const found: string[] = []
  IMPORT_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = IMPORT_RE.exec(source)) !== null) {
    found.push(match[1]!)
  }
  return found
}

/**
 * A specifier reduced to the form two spellings of the same package share.
 *
 * `@socketsecurity/lib-stable/http-request` and
 * `@socketsecurity/lib/http-request` normalize alike, so a mock naming the real
 * package matches an import of its pnpm alias. Without this the gate would fire
 * on every correctly-aliased mock in the fleet.
 */
export function normalizeSpecifier(specifier: string): string {
  return specifier.replace(/-stable(?=\/|$)/g, '')
}

/**
 * Whether `mocked` is reached by anything in `reachable`.
 *
 * Matches on a package boundary rather than a bare substring: a mock of
 * `@scope/pkg` is satisfied by an import of `@scope/pkg/sub`, and is NOT
 * satisfied by `@scope/pkg-other`.
 */
export function isMockReached(
  mocked: string,
  reachable: ReadonlySet<string>,
): boolean {
  const target = normalizeSpecifier(mocked)
  for (const raw of reachable) {
    const candidate = normalizeSpecifier(raw)
    if (candidate === target) {
      return true
    }
    if (
      candidate.startsWith(`${target}/`) ||
      target.startsWith(`${candidate}/`)
    ) {
      return true
    }
  }
  return false
}

/**
 * Resolve a relative specifier against `fromFile`, trying the extensions these
 * trees actually use. Answers undefined when nothing exists, which the walk
 * treats as a leaf rather than an error.
 */
function resolveRelative(
  fromFile: string,
  specifier: string,
): string | undefined {
  const base = path.resolve(path.dirname(fromFile), specifier)
  const candidates = [
    base,
    `${base}.mts`,
    `${base}.ts`,
    `${base}.mjs`,
    path.join(base, 'index.mts'),
  ]
  for (let i = 0, { length } = candidates; i < length; i += 1) {
    const candidate = candidates[i]!
    if (existsSync(candidate) && !candidate.endsWith(path.sep)) {
      return candidate
    }
  }
  return undefined
}

/**
 * Every specifier reachable from `testFile` through its relative imports.
 *
 * Bare specifiers are collected at every hop; relative ones are followed. The
 * visited set makes a cycle terminate rather than recurse forever.
 */
export function reachableSpecifiers(testFile: string): Set<string> {
  const reachable = new Set<string>()
  const visited = new Set<string>()
  const queue: Array<{ depth: number; file: string }> = [
    { depth: 0, file: testFile },
  ]
  while (queue.length > 0) {
    const { depth, file } = queue.shift()!
    if (visited.has(file) || depth > MAX_DEPTH) {
      continue
    }
    visited.add(file)
    let source: string
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const specifiers = importedSpecifiers(source)
    for (let i = 0, { length } = specifiers; i < length; i += 1) {
      const specifier = specifiers[i]!
      if (specifier.startsWith('.')) {
        const resolved = resolveRelative(file, specifier)
        if (resolved !== undefined) {
          queue.push({ depth: depth + 1, file: resolved })
        }
        continue
      }
      reachable.add(specifier)
    }
  }
  return reachable
}

export interface DeadMock {
  readonly file: string
  readonly specifier: string
}

/**
 * Pure verdict: which mocks in `testFile` name nothing the test reaches.
 *
 * A node: builtin is never reported. Those are mocked to intercept platform
 * behavior rather than a dependency, and a test file that mocks one may
 * legitimately not import it at all.
 */
export function deadMocksIn(
  testFile: string,
  source: string,
  reachable: ReadonlySet<string>,
): DeadMock[] {
  const dead: DeadMock[] = []
  const mocks = mockedSpecifiers(source)
  for (let i = 0, { length } = mocks; i < length; i += 1) {
    const specifier = mocks[i]!
    if (specifier.startsWith('node:') || specifier.startsWith('.')) {
      continue
    }
    if (!isMockReached(specifier, reachable)) {
      dead.push({
        file: normalizePath(path.relative(REPO_ROOT, testFile)),
        specifier,
      })
    }
  }
  return dead
}

/**
 * Every test file under `dir`, found by walking rather than globbing so the
 * check needs no runner config to say which files are tests.
 */
export function collectTestFiles(dir: string): string[] {
  const found: string[] = []
  const stack: string[] = [dir]
  while (stack.length > 0) {
    const current = stack.pop()!
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (let i = 0, { length } = entries; i < length; i += 1) {
      const entry = entries[i]!
      if (SKIP_DIRS.has(entry.name)) {
        continue
      }
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (TEST_FILE_RE.test(entry.name)) {
        found.push(full)
      }
    }
  }
  return found.toSorted()
}

async function main(): Promise<void> {
  const files = collectTestFiles(REPO_ROOT)
  const dead: DeadMock[] = []
  for (let i = 0, { length } = files; i < length; i += 1) {
    const file = files[i]!
    let source: string
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    // No text pre-filter. mockedSpecifiers already answers empty for a file
    // holding no call, and sniffing for the substring first would match a file
    // that only mentions `vi.mock` inside a fixture string.
    const mocks = mockedSpecifiers(source)
    if (mocks.length === 0) {
      continue
    }
    dead.push(...deadMocksIn(file, source, reachableSpecifiers(file)))
  }
  if (dead.length === 0) {
    if (!process.argv.includes('--quiet')) {
      logger.log('test-mocks-are-live: every vi.mock names a reachable module.')
    }
    process.exitCode = 0
    return
  }
  logger.fail(`test-mocks-are-live: ${dead.length} dead mock(s):`)
  logger.group()
  for (let i = 0, { length } = dead; i < length; i += 1) {
    logger.fail(`${dead[i]!.file}: ${dead[i]!.specifier}`)
  }
  logger.groupEnd()
  logger.fail(
    'What:  a vi.mock names a module the code under test no longer imports, so it intercepts nothing.',
  )
  logger.fail(
    'Saw:   assertions running against the real code path and passing for the wrong reason.',
  )
  logger.fail(
    'Fix:   point the mock at what the code imports now, or delete it if the dependency is gone.',
  )
  process.exitCode = 1
}

const SCRIPT_META: ScriptMeta = {
  describe: 'verifies every vi.mock names a module the test actually reaches',
  help: `Usage: node scripts/fleet/check/test-mocks-are-live.mts [flags]

  --quiet  suppress the success message`,
}

/* c8 ignore start - entrypoint guard; exercised via subprocess */
if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
/* c8 ignore stop */
