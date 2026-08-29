/*
 * @file Finds a literal path built in more than one file.
 *
 * `paths.mts` is the single owner of every constructed path. The failure this
 * detects is a literal tail like `path.join(repoRoot, '.config', 'repo')`
 * written out again in a second file: two definitions of one path, so a move
 * fixes one and silently strands the other.
 *
 * Only the LITERAL tail counts. The first argument is a root variable and
 * varies by caller, so `path.join(cwd, 'package.json')` and
 * `path.join(dir, 'package.json')` are the same tail. A tail of one segment is
 * ignored: joining a bare filename onto a caller's directory is ordinary, and
 * banning it would flag every read in the fleet.
 *
 * The detector is pure and takes file contents, so a test drives it without a
 * repo on disk.
 */

/**
 * A literal tail and the files that build it.
 */
export interface TailUsage {
  /**
   * The literal segments, slash-joined, as the burn-down records them.
   */
  readonly tail: string
  readonly files: readonly string[]
}

/**
 * `path.join(...)` calls with no nested call in their arguments. A nested call
 * means at least one argument is computed, so the tail is not a literal one.
 */
const JOIN_CALL_RE = /path\.join\(([^()]*)\)/gs

const SINGLE_QUOTED_RE = /^'[^']*'$/

/**
 * The literal tails one file builds, each with at least two segments.
 */
export function literalTailsInSource(source: string): string[] {
  const tails: string[] = []
  for (const match of source.matchAll(JOIN_CALL_RE)) {
    const args = (match[1] ?? '')
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0)
    // One root plus at least two literal segments. A shorter tail is a bare
    // filename joined onto a caller's directory, which is not a shared path.
    if (args.length < 3) {
      continue
    }
    const tail = args.slice(1)
    if (!tail.every(a => SINGLE_QUOTED_RE.test(a))) {
      continue
    }
    const segments = tail.map(a => a.slice(1, -1))
    // A tail of nothing but `..` walks up from wherever the caller sits. It
    // names no shared location, so two files climbing three levels are not
    // two definitions of one path.
    if (segments.every(s => s === '..')) {
      continue
    }
    tails.push(segments.join('/'))
  }
  return tails
}

/**
 * Every literal tail built in two or more of `sources`, sorted by tail.
 *
 * Keyed by file, so two builds of one tail inside a single file are not a
 * finding: that is one owner repeating itself, which `paths.mts` does not
 * govern.
 */
export function findDuplicateTails(
  sources: ReadonlyMap<string, string>,
): TailUsage[] {
  const byTail = new Map<string, Set<string>>()
  for (const [file, source] of sources) {
    for (const tail of literalTailsInSource(source)) {
      let set = byTail.get(tail)
      if (set === undefined) {
        set = new Set<string>()
        byTail.set(tail, set)
      }
      set.add(file)
    }
  }
  const dups: TailUsage[] = []
  for (const [tail, files] of byTail) {
    if (files.size > 1) {
      dups.push({ files: [...files].toSorted(), tail })
    }
  }
  return dups.toSorted((a, b) =>
    a.tail < b.tail ? -1 : a.tail > b.tail ? 1 : 0,
  )
}

/**
 * Split the duplicates against a burn-down list.
 *
 * `added` is a duplicate the burn-down does not record, which fails the gate.
 * `cleared` is a recorded tail that no longer duplicates, which the operator
 * drops so the list can only shrink.
 */
export function diffAgainstBurnDown(
  duplicates: readonly TailUsage[],
  burnDown: readonly string[],
): { added: TailUsage[]; cleared: string[] } {
  const recorded = new Set(burnDown)
  const live = new Set(duplicates.map(d => d.tail))
  return {
    added: duplicates.filter(d => !recorded.has(d.tail)),
    cleared: burnDown.filter(t => !live.has(t)).toSorted(),
  }
}
