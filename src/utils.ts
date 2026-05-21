/**
 * @file Utility functions for Socket SDK operations. Provides URL
 *   normalization, query parameter handling, and path resolution utilities.
 */
import path from 'node:path'
import process from 'node:process'

import { memoize } from '@socketsecurity/lib/memo/memoize'
import { normalizePath } from '@socketsecurity/lib/paths/normalize'
import { SetCtor } from '@socketsecurity/lib/primordials/map-set'
import { PromiseWithResolvers } from '@socketsecurity/lib/primordials/promise'
import {
  StringPrototypeEndsWith,
  StringPrototypeToLowerCase,
  StringPrototypeTrim,
} from '@socketsecurity/lib/primordials/string'
import { URLSearchParamsCtor } from '@socketsecurity/lib/primordials/url'

import type { QueryParams } from './types'

/**
 * Calculate Jaccard similarity coefficient between two strings based on word
 * sets. Returns a value between 0 (no overlap) and 1 (identical word sets).
 *
 * Formula: |A ∩ B| / |A ∪ B|
 *
 * @example
 *   ;```typescript
 *   calculateWordSetSimilarity('hello world', 'world hello') // 1.0 (same words)
 *   calculateWordSetSimilarity('hello world', 'goodbye world') // 0.33 (1/3 overlap)
 *   calculateWordSetSimilarity('hello', 'goodbye') // 0 (no overlap)
 *   ```
 *
 * @param str1 - First string to compare.
 * @param str2 - Second string to compare.
 *
 * @returns Similarity coefficient (0-1)
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

  // Calculate intersection size. Materialize set1 to an array so the
  // length is hoistable per prefer-cached-for-loop; Set iterators
  // allocate per-iteration.
  let intersectionSize = 0
  const set1Arr = [...set1]
  for (let i = 0, { length } = set1Arr; i < length; i += 1) {
    if (set2.has(set1Arr[i]!)) {
      intersectionSize++
    }
  }

  // Calculate union size
  const unionSize = set1.size + set2.size - intersectionSize

  return intersectionSize / unionSize
}

/**
 * Filter error cause based on similarity to error message. Returns undefined if
 * the cause should be omitted due to redundancy.
 *
 * Intelligently handles common error message patterns by: - Comparing full
 * messages - Splitting on colons and comparing each part - Finding the highest
 * similarity among all parts.
 *
 * Examples: - "Socket API Request failed (400): Bad Request" vs "Bad Request" -
 * "Error: Authentication: Token expired" vs "Token expired"
 *
 * @example
 *   ;```typescript
 *   filterRedundantCause('Invalid token', 'The token is invalid') // undefined
 *   filterRedundantCause('Request failed', 'Rate limit exceeded') // 'Rate limit exceeded'
 *   filterRedundantCause(
 *     'API Request failed (400): Bad Request',
 *     'Bad Request',
 *   ) // undefined
 *   filterRedundantCause('Error: Auth: Token expired', 'Token expired') // undefined
 *   ```
 *
 * @param errorMessage - Main error message.
 * @param errorCause - Detailed error cause/reason.
 * @param threshold - Similarity threshold (0-1), defaults to 0.6.
 *
 * @returns The error cause if it should be kept, undefined otherwise
 */
export function filterRedundantCause(
  errorMessage: string,
  errorCause: string | undefined,
  threshold = 0.6,
): string | undefined {
  if (!errorCause || !StringPrototypeTrim(errorCause)) {
    return undefined
  }

  // Split error message by colons to check each part
  // Example: "Socket API: Request failed (400): Bad Request" -> ["Socket API", "Request failed (400)", "Bad Request"]
  const messageParts = errorMessage
    .split(':')
    .map(part => StringPrototypeTrim(part))

  // Check similarity against each part, finding the maximum similarity
  for (let i = 0, { length } = messageParts; i < length; i += 1) {
    const part = messageParts[i]!
    if (part && shouldOmitReason(part, errorCause, threshold)) {
      return undefined
    }
  }

  return errorCause
}

/**
 * Normalize base URL by ensuring it ends with a trailing slash. Required for
 * proper URL joining with relative paths. Memoized for performance since base
 * URLs are typically reused.
 */
export const normalizeBaseUrl = memoize(
  (baseUrl: string): string => {
    return StringPrototypeEndsWith(baseUrl, '/') ? baseUrl : `${baseUrl}/`
  },
  { name: 'normalizeBaseUrl' },
)

/**
 * Normalize a string to a set of lowercase words (alphanumeric sequences).
 * Extracts word characters and creates a deduplicated set.
 *
 * @param s - String to normalize.
 *
 * @returns Set of normalized words
 */
function normalizeToWordSet(s: string): Set<string> {
  const words = StringPrototypeToLowerCase(s).match(/\w+/g)
  return new SetCtor(words ?? [])
}

/**
 * Create a promise with externally accessible resolve/reject functions.
 * Polyfill for Promise.withResolvers() on older Node.js versions.
 */
export function promiseWithResolvers<T>(): ReturnType<
  typeof Promise.withResolvers<T>
> {
  /* c8 ignore next 3 - polyfill for older Node versions without Promise.withResolvers */
  if (PromiseWithResolvers) {
    return PromiseWithResolvers() as ReturnType<typeof Promise.withResolvers<T>>
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
 * Convert query parameters to URLSearchParams with API-compatible key
 * normalization. Transforms camelCase keys to snake_case and filters out empty
 * values.
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
  const params = new URLSearchParamsCtor(
    init as ConstructorParameters<typeof URLSearchParams>[0],
  )
  // Check if normalization is needed before creating a second instance.
  // Materialize entries so length is hoistable (URLSearchParams iterator
  // would allocate per-iteration).
  const entries = [...params]
  let needsNormalization = false
  let hasEmpty = false
  for (let i = 0, { length } = entries; i < length; i += 1) {
    const pair = entries[i]!
    const key = pair[0]
    if (key === 'defaultBranch' || key === 'perPage') {
      needsNormalization = true
      break
    }
    if (!pair[1]) {
      hasEmpty = true
    }
  }
  if (!needsNormalization && !hasEmpty) {
    return params
  }
  const normalized = new URLSearchParamsCtor()
  for (let i = 0, { length } = entries; i < length; i += 1) {
    const pair = entries[i]!
    const key = pair[0]
    const value = pair[1]
    if (!value) {
      continue
    }
    if (key === 'defaultBranch') {
      normalized.set('default_branch', value)
    } else if (key === 'perPage') {
      normalized.set('per_page', value)
    } else {
      normalized.set(key, value)
    }
  }
  return normalized
}

/**
 * Convert relative file paths to absolute paths. Resolves paths relative to
 * specified base directory or current working directory.
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
 * Resolve base path to an absolute directory path. Converts relative paths to
 * absolute using current working directory as reference.
 */
export function resolveBasePath(pathsRelativeTo = '.'): string {
  // Node's path.resolve will process path segments from right to left until
  // it creates a valid absolute path. So if `pathsRelativeTo` is an absolute
  // path, process.cwd() is not used, which is the common expectation. If none
  // of the paths resolve then it defaults to process.cwd().
  return normalizePath(path.resolve(process.cwd(), pathsRelativeTo))
}

/**
 * Determine if a "reason" string should be omitted due to high similarity with
 * error message. Uses Jaccard similarity to detect redundant phrasing.
 *
 * @example
 *   ;```typescript
 *   shouldOmitReason('Invalid token', 'The token is invalid') // true (high overlap)
 *   shouldOmitReason('Request failed', 'Rate limit exceeded') // false (low overlap)
 *   ```
 *
 * @param errorMessage - Main error message.
 * @param reason - Detailed reason/cause string.
 * @param threshold - Similarity threshold (0-1), defaults to 0.6.
 *
 * @returns True if reason should be omitted (too similar)
 */
export function shouldOmitReason(
  errorMessage: string,
  reason: string | undefined,
  threshold = 0.6,
): boolean {
  // Omit empty/whitespace-only reasons
  if (!reason || !StringPrototypeTrim(reason)) {
    return true
  }

  const similarity = calculateWordSetSimilarity(errorMessage, reason)
  return similarity >= threshold
}
