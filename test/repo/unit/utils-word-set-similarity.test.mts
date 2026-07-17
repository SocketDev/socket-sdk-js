/**
 * @file Word-set similarity tests mirroring src/utils.ts. Covers the Jaccard
 *   overlap detector and its consumers: calculateWordSetSimilarity,
 *   shouldOmitReason, and filterRedundantCause.
 */

import { describe, expect, it } from 'vitest'

import {
  calculateWordSetSimilarity,
  filterRedundantCause,
  shouldOmitReason,
} from '../../../src/utils.mts'

// =============================================================================
// Word Set Similarity (Jaccard Overlap Detection)
// =============================================================================

describe('Word Set Similarity', () => {
  describe('calculateWordSetSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const result = calculateWordSetSimilarity('hello world', 'hello world')
      expect(result).toBe(1)
    })

    it('should return 1.0 for same words in different order', () => {
      const result = calculateWordSetSimilarity('hello world', 'world hello')
      expect(result).toBe(1)
    })

    it('should return 0 for completely different strings', () => {
      const result = calculateWordSetSimilarity('hello world', 'goodbye moon')
      expect(result).toBe(0)
    })

    it('should calculate partial overlap correctly', () => {
      // 'world' is shared, {'hello', 'world', 'goodbye'} = 3 total
      // Intersection = 1, union = 3, similarity = 1/3 ≈ 0.33
      const result = calculateWordSetSimilarity('hello world', 'goodbye world')
      expect(result).toBeCloseTo(0.33, 2)
    })

    it('should be case insensitive', () => {
      const result = calculateWordSetSimilarity('Hello World', 'HELLO WORLD')
      expect(result).toBe(1)
    })

    it('should ignore punctuation and special characters', () => {
      const result = calculateWordSetSimilarity('hello, world!', 'hello world')
      expect(result).toBe(1)
    })

    it('should handle duplicate words in same string', () => {
      // Sets eliminate duplicates, so 'hello hello world' becomes {hello, world}
      const result = calculateWordSetSimilarity(
        'hello hello world',
        'hello world',
      )
      expect(result).toBe(1)
    })

    it('should return 1.0 for both empty strings', () => {
      const result = calculateWordSetSimilarity('', '')
      expect(result).toBe(1)
    })

    it('should return 0 for one empty string', () => {
      expect(calculateWordSetSimilarity('hello', '')).toBe(0)
      expect(calculateWordSetSimilarity('', 'world')).toBe(0)
    })

    it('should handle strings with only special characters', () => {
      // Both normalize to empty sets
      const result = calculateWordSetSimilarity('!!!', '???')
      expect(result).toBe(1)
    })

    it('should calculate overlap for error messages', () => {
      // Real-world example: error vs reason
      // Words: {invalid, token} vs {the, token, is, invalid}
      // Intersection: {invalid, token} = 2
      // Union: {invalid, token, the, is} = 4
      // Similarity: 2/4 = 0.5
      const error = 'Invalid token'
      const reason = 'The token is invalid'
      const result = calculateWordSetSimilarity(error, reason)
      expect(result).toBe(0.5)
    })

    it('should detect high similarity in redundant messages', () => {
      // Words: {request, failed} vs {request, failed, due, to, timeout}
      // Intersection: {request, failed} = 2
      // Union: 5
      // Similarity: 2/5 = 0.4
      const error = 'Request failed'
      const reason = 'Request failed due to timeout'
      const result = calculateWordSetSimilarity(error, reason)
      expect(result).toBe(0.4)
    })

    it('should detect low similarity in distinct messages', () => {
      // Words: {request, failed} vs {rate, limit, exceeded}
      // Intersection: {} = 0
      // Union: 5
      // Similarity: 0/5 = 0
      const error = 'Request failed'
      const reason = 'Rate limit exceeded'
      const result = calculateWordSetSimilarity(error, reason)
      expect(result).toBe(0)
    })

    it('should handle numbers in strings', () => {
      const result = calculateWordSetSimilarity(
        'error 404 not found',
        'not found error 404',
      )
      expect(result).toBe(1)
    })

    it('should handle hyphenated words', () => {
      // Regex \w+ treats hyphens as separators
      // Both become {rate, limit, exceeded}
      const result = calculateWordSetSimilarity(
        'rate-limit exceeded',
        'rate limit exceeded',
      )
      expect(result).toBe(1)
    })

    it('should handle multi-line strings', () => {
      const str1 = 'hello\nworld'
      const str2 = 'world\nhello'
      const result = calculateWordSetSimilarity(str1, str2)
      expect(result).toBe(1)
    })
  })

  describe('shouldOmitReason', () => {
    it('should return true for undefined reason', () => {
      const result = shouldOmitReason('Error message', undefined)
      expect(result).toBe(true)
    })

    it('should return true for empty string reason', () => {
      const result = shouldOmitReason('Error message', '')
      expect(result).toBe(true)
    })

    it('should return true for whitespace-only reason', () => {
      const result = shouldOmitReason('Error message', '   \n  ')
      expect(result).toBe(true)
    })

    it('should return true for high similarity (above threshold)', () => {
      // Similarity = 0.5, default threshold = 0.6 is NOT met, so return false
      // Let's use a case that DOES meet threshold
      // Same words, similarity = 1.0
      const error = 'Invalid API token'
      const reason = 'API token invalid'
      const result = shouldOmitReason(error, reason)
      // 1.0 >= 0.6
      expect(result).toBe(true)
    })

    it('should return false for low similarity (below threshold)', () => {
      // Similarity is low
      const error = 'Request failed'
      const reason = 'Rate limit exceeded. Try again later.'
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(false)
    })

    it('should respect custom threshold', () => {
      // Similarity: {token, expired} vs {the, token, has, expired}
      // Intersection: 2, Union: 4, Similarity: 0.5
      const error = 'Token expired'
      const reason = 'The token has expired'
      // 0.5 >= 0.4
      expect(shouldOmitReason(error, reason, 0.4)).toBe(true)
      // 0.5 < 0.6
      expect(shouldOmitReason(error, reason, 0.6)).toBe(false)
    })

    it('should omit highly redundant reasons', () => {
      // Identical = 1.0 similarity
      const error = 'Authentication failed'
      const reason = 'Authentication failed'
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(true)
    })

    it('should keep distinct reasons with actionable guidance', () => {
      // Should keep because guidance adds value despite some word overlap
      const error = 'Socket API Request failed (401): Unauthorized'
      const reason = [
        '→ Authentication failed. API token is invalid or expired.',
        '→ Check: Your API token is correct and active.',
        '→ Generate a new token at: https://socket.dev/api-tokens',
      ].join('\n')
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(false)
    })

    it('should handle threshold edge cases', () => {
      // Similarity: {error, a, b} vs {error, a, b, c}
      // Intersection: 3, Union: 4, Similarity: 0.75
      const error = 'Error A B'
      const reason = 'Error A B C'
      // Exactly at threshold
      expect(shouldOmitReason(error, reason, 0.75)).toBe(true)
      // Above threshold
      expect(shouldOmitReason(error, reason, 0.76)).toBe(false)
    })

    it('should work with real SDK error scenarios', () => {
      // Scenario 1: Body message is subset of error message
      // Similarity is 0.33 (2/6), which is < 0.6 threshold, so should keep
      const error1 = 'Socket API Request failed (400): Bad Request'
      const reason1 = 'Bad Request'
      expect(shouldOmitReason(error1, reason1)).toBe(false)

      // Scenario 2: Identical redundant messages (should omit)
      // Similarity is 1.0, which is >= 0.6 threshold
      const error2 = 'Bad Request'
      const reason2 = 'Bad Request'
      expect(shouldOmitReason(error2, reason2)).toBe(true)

      // Scenario 3: Body message adds new information (should keep)
      // Low overlap
      const error3 = 'Socket API Request failed (400): Bad Request'
      const reason3 =
        'Invalid package URL format. Must be pkg:npm/package@1.0.0'
      expect(shouldOmitReason(error3, reason3)).toBe(false)
    })

    it('should handle actionable guidance with low word overlap', () => {
      // Low word overlap with actionable guidance = keep it
      const error = 'Request failed'
      const reason = [
        '→ Rate limit exceeded.',
        '→ Retry after 60 seconds.',
        '→ Try: Enable SDK retry option.',
      ].join('\n')
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(false)
    })

    it('should use default threshold of 0.6', () => {
      // Similarity: {token, invalid} vs {invalid, token, provided}
      // Intersection: 2, Union: 3, Similarity: 0.667
      // 0.667 >= 0.6 (default threshold)
      const error = 'Token invalid'
      const reason = 'Invalid token provided'
      const result = shouldOmitReason(error, reason)
      expect(result).toBe(true)
    })
  })

  describe('filterRedundantCause', () => {
    it('should return undefined for redundant cause', () => {
      const error = 'Invalid API token'
      const cause = 'API token invalid'
      const result = filterRedundantCause(error, cause)
      expect(result).toBeUndefined()
    })

    it('should return cause for distinct information', () => {
      const error = 'Request failed'
      const cause = 'Rate limit exceeded. Try again later.'
      const result = filterRedundantCause(error, cause)
      expect(result).toBe(cause)
    })

    it('should return undefined for empty cause', () => {
      const error = 'Some error'
      expect(filterRedundantCause(error, undefined)).toBeUndefined()
      expect(filterRedundantCause(error, '')).toBeUndefined()
      expect(filterRedundantCause(error, '   ')).toBeUndefined()
    })

    it('should respect custom threshold', () => {
      const error = 'Token expired'
      const cause = 'The token has expired'
      // Similarity: 0.5
      // With threshold 0.4, should omit (0.5 >= 0.4)
      expect(filterRedundantCause(error, cause, 0.4)).toBeUndefined()
      // With threshold 0.6, should keep (0.5 < 0.6)
      expect(filterRedundantCause(error, cause, 0.6)).toBe(cause)
    })

    it('should work with real error handling patterns', () => {
      // Simulating the pattern from socket-sdk-class.ts
      const errorMsg = 'File validation failed'
      const errorCause = 'File validation failed'
      const finalCause = filterRedundantCause(errorMsg, errorCause)
      expect(finalCause).toBeUndefined()
    })

    it('should keep actionable guidance', () => {
      const errorMsg = 'Socket API Request failed (401): Unauthorized'
      const errorCause = [
        '→ Authentication failed. API token is invalid or expired.',
        '→ Check: Your API token is correct and active.',
        '→ Generate a new token at: https://socket.dev/api-tokens',
      ].join('\n')
      const finalCause = filterRedundantCause(errorMsg, errorCause)
      expect(finalCause).toBe(errorCause)
    })

    it('should simplify error result creation', () => {
      // Example usage pattern
      const errorMessage = 'Operation failed'
      const reason = 'Operation failed due to network error'

      // Old pattern (verbose)
      const oldPattern = shouldOmitReason(errorMessage, reason)
        ? undefined
        : reason

      // New pattern (concise)
      const newPattern = filterRedundantCause(errorMessage, reason)

      expect(oldPattern).toBe(newPattern)
    })

    it('should intelligently handle colon-separated error messages', () => {
      // Common pattern: "Context: Main Error Message"
      // Should compare "Bad Request" with "Bad Request"
      const error = 'Socket API Request failed (400): Bad Request'
      const cause = 'Bad Request'
      const result = filterRedundantCause(error, cause)
      // Should omit because the cause matches the part after the colon
      expect(result).toBeUndefined()
    })

    it('should keep cause if different from colon-extracted message', () => {
      const error = 'Socket API Request failed (400): Bad Request'
      const cause = 'Invalid package URL format'
      const result = filterRedundantCause(error, cause)
      // Should keep because cause is different from "Bad Request"
      expect(result).toBe(cause)
    })

    it('should handle multiple colons correctly', () => {
      // Should check all parts split by colons
      const error = 'HTTP Error: Socket API: Bad Request'
      const cause = 'Bad Request'
      const result = filterRedundantCause(error, cause)
      // Should omit because cause matches one of the parts ("Bad Request")
      expect(result).toBeUndefined()
    })

    it('should match against any part in colon-separated message', () => {
      const error = 'Error: Authentication: Token expired'
      const cause = 'Token expired'
      const result = filterRedundantCause(error, cause)
      // Should omit because "Token expired" is one of the parts
      expect(result).toBeUndefined()
    })

    it('should still work for messages without colons', () => {
      const error = 'Authentication failed'
      const cause = 'Authentication failed'
      const result = filterRedundantCause(error, cause)
      // Should omit based on full message comparison
      expect(result).toBeUndefined()
    })

    it('should handle edge case with empty string after colon', () => {
      const error = 'Error message:'
      const cause = 'Some detailed cause'
      const result = filterRedundantCause(error, cause)
      // Empty main message should be ignored, keep the cause
      expect(result).toBe(cause)
    })
  })
})
