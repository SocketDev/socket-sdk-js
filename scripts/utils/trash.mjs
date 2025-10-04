/** @fileoverview Safe file removal utility with trash fallback. */
import { promises as fs } from 'node:fs'

import { pEach } from '@socketsecurity/registry/lib/promises'
import trash from 'trash'

// Max concurrent fs.rm operations when trash fails.
const DEFAULT_CONCURRENCY = 10

/**
 * Remove files or directories safely using trash with fs.rm fallback.
 * First attempts to move items to trash for recoverability. If trash fails
 * (e.g., on CI systems or when trash binary is unavailable), falls back to
 * permanent deletion using fs.rm with error handling.
 * @throws {Error} Never throws; logs warnings for non-ENOENT errors via spinner if provided.
 */
export async function safeRemove(paths, options) {
  const pathArray = Array.isArray(paths) ? paths : [paths]
  if (pathArray.length === 0) {
    return
  }

  try {
    await trash(pathArray)
  } catch {
    // If trash fails, fallback to fs.rm.
    const {
      concurrency = DEFAULT_CONCURRENCY,
      spinner,
      ...rmOptions
    } = { __proto__: null, ...options }
    const defaultRmOptions = { force: true, recursive: true, ...rmOptions }

    await pEach(
      pathArray,
      async p => {
        try {
          await fs.rm(p, defaultRmOptions)
        } catch (rmError) {
          // Only warn about non-ENOENT errors if a spinner is provided.
          if (spinner && rmError.code !== 'ENOENT') {
            spinner.warn(`Failed to remove ${p}: ${rmError.message}`)
          }
        }
      },
      { concurrency },
    )
  }
}
