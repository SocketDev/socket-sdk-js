/**
 * @file Path utility helpers for script operations.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Get directory name from import.meta.url.
 */
export function getDirname(importMetaUrl: string): string {
  return path.dirname(fileURLToPath(importMetaUrl))
}

/**
 * Get root directory path from the calling script's location by walking up to
 * the nearest `package.json`-bearing ancestor (the repo root).
 * Depth-independent so a script moving between directories (e.g. the
 * scripts-into-`scripts/repo/` fleet migration) doesn't break path resolution —
 * a fixed `..` count would. Mirrors `resolveRepoRoot()` in
 * `scripts/fleet/paths.mts`.
 *
 * @throws If no `package.json` ancestor exists (= not inside a repo).
 */
export function getRootPath(importMetaUrl: string): string {
  let cur = getDirname(importMetaUrl)
  const { root } = path.parse(cur)
  while (cur && cur !== root) {
    if (existsSync(path.join(cur, 'package.json'))) {
      return cur
    }
    const parent = path.dirname(cur)
    if (parent === cur) {
      break
    }
    cur = parent
  }
  throw new Error(
    `Could not resolve repo root from ${fileURLToPath(importMetaUrl)} ` +
      '(no ancestor has package.json).',
  )
}
