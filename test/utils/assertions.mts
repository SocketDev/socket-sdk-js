/**
 * @file Reusable assertion helpers for SDK test suites. Reduces duplication in
 *   test assertions for success/error responses.
 */

import { expect } from 'vitest'

import type { SocketSdkGenericResult } from '../../src/index'

/**
 * Assert that an SDK result is an error with Socket API format.
 *
 * @example
 *   ;```ts
 *   const res = await client.getRepo('org', 'invalid')
 *   assertApiError(res, 404)
 *   ```
 *
 * @param result - The SDK result to check.
 * @param statusCode - Expected HTTP status code.
 */
export function assertApiError<T>(
  result: SocketSdkGenericResult<T>,
  statusCode: number,
): asserts result is Extract<SocketSdkGenericResult<T>, { success: false }> {
  assertError(result, statusCode, `Socket API Request failed (${statusCode})`)
}

/**
 * Assert that an SDK result is an error response.
 *
 * @example
 *   ;```ts
 *   const res = await client.getRepo('org', 'invalid')
 *   assertError(res, 404, 'not found')
 *   ```
 *
 * @param result - The SDK result to check.
 * @param statusCode - Expected HTTP status code.
 * @param errorSubstring - Optional substring expected in error message.
 */
export function assertError<T>(
  result: SocketSdkGenericResult<T>,
  statusCode: number,
  errorSubstring?: string | undefined,
): asserts result is Extract<SocketSdkGenericResult<T>, { success: false }> {
  expect(result.success).toBe(false)
  expect(result.status).toBe(statusCode)
  expect(result.data).toBeUndefined()
  expect(result.error).toBeDefined()

  if (errorSubstring) {
    expect(result.error).toContain(errorSubstring)
  }
}

/**
 * Assert that an SDK result is a successful response.
 *
 * @example
 *   ;```ts
 *   const res = await client.getRepo('org', 'repo')
 *   assertSuccess(res)
 *   ```
 *
 * @param result - The SDK result to check.
 * @param statusCode - Expected HTTP status code (default: 200)
 */
export function assertSuccess<T>(
  result: SocketSdkGenericResult<T>,
  statusCode = 200,
): asserts result is Extract<SocketSdkGenericResult<T>, { success: true }> {
  expect(result.success).toBe(true)
  expect(result.status).toBe(statusCode)
  expect(result.error).toBeUndefined()
  expect(result.data).toBeDefined()
}
