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
   * The literal segments joined with slashes.
   */
  readonly tail: string
  readonly files: readonly string[]
}

import { parseSync } from 'rolldown/utils'

interface PathNode {
  [key: string]: unknown
  type: string
  name?: string | undefined
  value?: unknown | undefined
  callee?: PathNode | undefined
  object?: PathNode | undefined
  property?: PathNode | undefined
  arguments?: PathNode[] | undefined
}

function pathTailInCall(node: PathNode): string | undefined {
  const callee = node.callee
  if (
    node.type !== 'CallExpression' ||
    callee?.type !== 'MemberExpression' ||
    callee.object?.type !== 'Identifier' ||
    callee.object.name !== 'path' ||
    callee.property?.type !== 'Identifier' ||
    callee.property.name !== 'join' ||
    callee['computed']
  ) {
    return undefined
  }
  const args = node.arguments ?? []
  const tail = args.slice(1)
  if (
    args.length < 3 ||
    !tail.every(arg => arg.type === 'Literal' && typeof arg.value === 'string')
  ) {
    return undefined
  }
  const segments = tail.map(arg => arg.value as string)
  return segments.every(segment => segment === '..')
    ? undefined
    : segments.join('/')
}

/**
 * The literal tails one file builds, each with at least two segments.
 */
export function literalTailsInSource(
  source: string,
  options?: { filePath?: string | undefined } | undefined,
): string[] {
  const { filePath = 'source.mts' } = {
    __proto__: null,
    ...options,
  } as NonNullable<typeof options>
  const tails: string[] = []
  let parsed = parseSync(filePath, source)
  if (parsed.errors.length) {
    parsed = parseSync(filePath, `async function workflow() {\n${source}\n}`)
  }
  if (parsed.errors.length) {
    throw new SyntaxError(
      `Cannot inspect path calls in ${filePath}. Saw invalid source syntax; wanted a parseable source file. Fix its syntax before checking path ownership.`,
      { cause: { filePath } },
    )
  }
  const pending: unknown[] = [parsed.program]
  while (pending.length) {
    const value = pending.pop()
    if (value === null || typeof value !== 'object') {
      continue
    }
    const node = value as PathNode
    const tail = pathTailInCall(node)
    if (tail !== undefined) {
      tails.push(tail)
    }
    const children = Object.values(node)
    for (let i = 0, { length } = children; i < length; i += 1) {
      const child = children[i]
      if (Array.isArray(child)) {
        pending.push(...child)
      } else if (typeof child === 'object' && child !== null) {
        pending.push(child)
      }
    }
  }
  return tails.toReversed()
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
    for (const tail of literalTailsInSource(source, { filePath: file })) {
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
