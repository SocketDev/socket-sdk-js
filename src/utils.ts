/**
 * @fileoverview Utility functions for Socket SDK operations.
 * Provides URL normalization, query parameter handling, and path resolution utilities.
 */
import path from 'node:path'

import { memoize } from '@socketsecurity/lib/memoization'
import { normalizePath } from '@socketsecurity/lib/paths/normalize'

import type { QueryParams } from './types'

// Re-export user agent function for convenience
export { createUserAgentFromPkgJson } from './user-agent'

/**
 * Normalize base URL by ensuring it ends with a trailing slash.
 * Required for proper URL joining with relative paths.
 * Memoized for performance since base URLs are typically reused.
 */
export const normalizeBaseUrl = memoize(
  (baseUrl: string): string => {
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  },
  { name: 'normalizeBaseUrl' },
)

/**
 * Create a promise with externally accessible resolve/reject functions.
 * Polyfill for Promise.withResolvers() on older Node.js versions.
 */
export function promiseWithResolvers<T>(): ReturnType<
  typeof Promise.withResolvers<T>
> {
  /* c8 ignore next 3 - polyfill for older Node versions without Promise.withResolvers */
  if (Promise.withResolvers) {
    return Promise.withResolvers<T>()
  }

  /* c8 ignore next 7 - polyfill implementation for older Node versions */
  const obj = {} as ReturnType<typeof Promise.withResolvers<T>>
  obj.promise = new Promise<T>((resolver, reject) => {
    obj.resolve = resolver
    obj.reject = reject
  })
  return obj
}

/**
 * Convert query parameters to URLSearchParams with API-compatible key normalization.
 * Transforms camelCase keys to snake_case and filters out empty values.
 */
export function queryToSearchParams(
  init?:
    | URLSearchParams
    | string
    | QueryParams
    | Iterable<[string, unknown]>
    | ReadonlyArray<[string, unknown]>
    | null
    | undefined,
): URLSearchParams {
  const params = new URLSearchParams(
    init as ConstructorParameters<typeof URLSearchParams>[0],
  )
  const normalized = { __proto__: null } as unknown as QueryParams
  const entries: Iterable<[string, string]> = params.entries()
  for (const entry of entries) {
    let key: string = entry[0]
    const value: string = entry[1]
    if (key === 'defaultBranch') {
      key = 'default_branch'
    } else if (key === 'perPage') {
      key = 'per_page'
    }
    if (value) {
      normalized[key] = value
    }
  }
  return new URLSearchParams(normalized as unknown as Record<string, string>)
}

/**
 * Convert relative file paths to absolute paths.
 * Resolves paths relative to specified base directory or current working directory.
 */
export function resolveAbsPaths(
  filepaths: string[],
  pathsRelativeTo?: string | undefined,
): string[] {
  const basePath = resolveBasePath(pathsRelativeTo)
  // Node's path.resolve will process path segments from right to left until
  // it creates a valid absolute path. So if `pathsRelativeTo` is an absolute
  // path, process.cwd() is not used, which is the common expectation. If none
  // of the paths resolve then it defaults to process.cwd().
  return filepaths.map(p => normalizePath(path.resolve(basePath, p)))
}

/**
 * Resolve base path to an absolute directory path.
 * Converts relative paths to absolute using current working directory as reference.
 */
export function resolveBasePath(pathsRelativeTo = '.'): string {
  // Node's path.resolve will process path segments from right to left until
  // it creates a valid absolute path. So if `pathsRelativeTo` is an absolute
  // path, process.cwd() is not used, which is the common expectation. If none
  // of the paths resolve then it defaults to process.cwd().
  return normalizePath(path.resolve(process.cwd(), pathsRelativeTo))
}

/**
 * Normalize a string to a set of lowercase words (alphanumeric sequences).
 * Extracts word characters and creates a deduplicated set.
 *
 * @param s - String to normalize
 * @returns Set of normalized words
 */
function normalizeToWordSet(s: string): Set<string> {
  const words = s.toLowerCase().match(/\w+/g)
  return new Set(words ?? [])
}

/**
 * Calculate Jaccard similarity coefficient between two strings based on word sets.
 * Returns a value between 0 (no overlap) and 1 (identical word sets).
 *
 * Formula: |A ∩ B| / |A ∪ B|
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity coefficient (0-1)
 *
 * @example
 * ```typescript
 * calculateWordSetSimilarity('hello world', 'world hello') // 1.0 (same words)
 * calculateWordSetSimilarity('hello world', 'goodbye world') // 0.33 (1/3 overlap)
 * calculateWordSetSimilarity('hello', 'goodbye') // 0 (no overlap)
 * ```
 */
export function calculateWordSetSimilarity(str1: string, str2: string): number {
  const set1 = normalizeToWordSet(str1)
  const set2 = normalizeToWordSet(str2)

  // Both empty = identical
  if (set1.size === 0 && set2.size === 0) {
    return 1
  }
  // One empty = no overlap
  if (set1.size === 0 || set2.size === 0) {
    return 0
  }

  // Calculate intersection size
  let intersectionSize = 0
  for (const word of set1) {
    if (set2.has(word)) {
      intersectionSize++
    }
  }

  // Calculate union size
  const unionSize = set1.size + set2.size - intersectionSize

  return intersectionSize / unionSize
}

/**
 * Determine if a "reason" string should be omitted due to high similarity with error message.
 * Uses Jaccard similarity to detect redundant phrasing.
 *
 * @param errorMessage - Main error message
 * @param reason - Detailed reason/cause string
 * @param threshold - Similarity threshold (0-1), defaults to 0.6
 * @returns true if reason should be omitted (too similar)
 *
 * @example
 * ```typescript
 * shouldOmitReason('Invalid token', 'The token is invalid') // true (high overlap)
 * shouldOmitReason('Request failed', 'Rate limit exceeded') // false (low overlap)
 * ```
 */
export function shouldOmitReason(
  errorMessage: string,
  reason: string | undefined,
  threshold = 0.6,
): boolean {
  // Omit empty/whitespace-only reasons
  if (!reason || !reason.trim()) {
    return true
  }

  const similarity = calculateWordSetSimilarity(errorMessage, reason)
  return similarity >= threshold
}

/**
 * Filter error cause based on similarity to error message.
 * Returns undefined if the cause should be omitted due to redundancy.
 *
 * Intelligently handles common error message patterns by:
 * - Comparing full messages
 * - Splitting on colons and comparing each part
 * - Finding the highest similarity among all parts
 *
 * Examples:
 * - "Socket API Request failed (400): Bad Request" vs "Bad Request"
 * - "Error: Authentication: Token expired" vs "Token expired"
 *
 * @param errorMessage - Main error message
 * @param errorCause - Detailed error cause/reason
 * @param threshold - Similarity threshold (0-1), defaults to 0.6
 * @returns The error cause if it should be kept, undefined otherwise
 *
 * @example
 * ```typescript
 * filterRedundantCause('Invalid token', 'The token is invalid') // undefined
 * filterRedundantCause('Request failed', 'Rate limit exceeded') // 'Rate limit exceeded'
 * filterRedundantCause('API Request failed (400): Bad Request', 'Bad Request') // undefined
 * filterRedundantCause('Error: Auth: Token expired', 'Token expired') // undefined
 * ```
 */
export function filterRedundantCause(
  errorMessage: string,
  errorCause: string | undefined,
  threshold = 0.6,
): string | undefined {
  if (!errorCause || !errorCause.trim()) {
    return undefined
  }

  // Split error message by colons to check each part
  // Example: "Socket API: Request failed (400): Bad Request" -> ["Socket API", "Request failed (400)", "Bad Request"]
  const messageParts = errorMessage.split(':').map(part => part.trim())

  // Check similarity against each part, finding the maximum similarity
  for (const part of messageParts) {
    if (part && shouldOmitReason(part, errorCause, threshold)) {
      return undefined
    }
  }

  return errorCause
}
