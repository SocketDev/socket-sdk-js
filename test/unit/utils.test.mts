/**
 * @fileoverview Consolidated utility function tests.
 * Tests for promise utilities, query parameters, user-agent generation,
 * and JSON request body creation.
 *
 * Consolidates:
 * - promise-with-resolvers.test.mts
 * - query-params-normalization.test.mts
 * - user-agent.test.mts
 * - create-request-body-json.test.mts
 */

import { describe, expect, it } from 'vitest'

import {
  createRequestBodyForJson,
  promiseWithResolvers,
  queryToSearchParams,
} from '../../src/index'
import { createUserAgentFromPkgJson } from '../../src/user-agent'

// =============================================================================
// Promise Utilities
// =============================================================================

describe('Utility Functions - Promise Resolvers', () => {
  describe('promiseWithResolvers', () => {
    it('should return promise, resolve, and reject functions', () => {
      const { promise, reject, resolve } = promiseWithResolvers<string>()

      expect(promise).toBeInstanceOf(Promise)
      expect(typeof resolve).toBe('function')
      expect(typeof reject).toBe('function')
    })

    it('should resolve promise with provided value', async () => {
      const { promise, resolve } = promiseWithResolvers<number>()

      resolve(42)

      await expect(promise).resolves.toBe(42)
    })

    it('should reject promise with provided error', async () => {
      const { promise, reject } = promiseWithResolvers<string>()
      const error = new Error('Test error')

      reject(error)

      await expect(promise).rejects.toBe(error)
    })

    it('should work with complex types', async () => {
      const { promise, resolve } = promiseWithResolvers<{ data: string[] }>()
      const testData = { data: ['test', 'data'] }

      resolve(testData)

      const result = await promise
      expect(result).toEqual(testData)
      expect(result.data).toHaveLength(2)
    })
  })
})

// =============================================================================
// Query Parameter Normalization
// =============================================================================

describe('Query Parameter Normalization', () => {
  describe('queryToSearchParams', () => {
    it('should convert defaultBranch parameter to default_branch', () => {
      const params = { defaultBranch: 'main', other: 'value' }
      const result = queryToSearchParams(params)

      expect(result.toString()).toBe('default_branch=main&other=value')
    })

    it('should convert perPage parameter to per_page', () => {
      const params = { perPage: '50', other: 'value' }
      const result = queryToSearchParams(params)

      expect(result.toString()).toBe('per_page=50&other=value')
    })

    it('should filter out empty string values', () => {
      const params = { key1: '', key2: 'value', key3: '' }
      const result = queryToSearchParams(params)

      expect(result.toString()).toBe('key2=value')
    })

    it('should handle multiple parameters including defaultBranch', () => {
      const params = {
        active: 'true',
        count: '10',
        defaultBranch: 'develop',
        name: 'test-repo',
      }
      const result = queryToSearchParams(params)
      const resultString = result.toString()

      expect(resultString).toContain('default_branch=develop')
      expect(resultString).toContain('name=test-repo')
      expect(resultString).toContain('active=true')
      expect(resultString).toContain('count=10')
    })

    it('should handle empty defaultBranch parameter', () => {
      const params = { defaultBranch: '' }
      const result = queryToSearchParams(params)

      // Empty strings are filtered out by the function
      expect(result.toString()).toBe('')
    })

    it('should handle defaultBranch with special characters', () => {
      const params = { defaultBranch: 'feature/test-branch' }
      const result = queryToSearchParams(params)

      expect(result.toString()).toContain(
        'default_branch=feature%2Ftest-branch',
      )
    })

    it('should not affect other parameters', () => {
      const params = {
        anotherParam: '123',
        defaultBranch: 'master',
        regularParam: 'value',
      }
      const result = queryToSearchParams(params)
      const resultString = result.toString()

      expect(resultString).toContain('regularParam=value')
      expect(resultString).toContain('anotherParam=123')
      expect(resultString).toContain('default_branch=master')
      expect(resultString).not.toContain('defaultBranch=')
    })
  })
})

// =============================================================================
// User-Agent Generation
// =============================================================================

describe('User-Agent Generation', () => {
  describe('createUserAgentFromPkgJson', () => {
    it('should generate User-Agent without homepage', () => {
      const result = createUserAgentFromPkgJson({
        name: '@socketsecurity/sdk',
        version: '1.0.0',
      })
      expect(result).toBe('socketsecurity-sdk/1.0.0')
    })

    it('should generate User-Agent with homepage', () => {
      const result = createUserAgentFromPkgJson({
        homepage: 'https://socket.dev',
        name: '@socketsecurity/sdk',
        version: '1.0.0',
      })
      expect(result).toBe('socketsecurity-sdk/1.0.0 (https://socket.dev)')
    })

    it('should handle package names without scope', () => {
      const result = createUserAgentFromPkgJson({
        homepage: 'https://example.com',
        name: 'my-package',
        version: '2.5.3',
      })
      expect(result).toBe('my-package/2.5.3 (https://example.com)')
    })

    it('should replace @ and / in scoped package names', () => {
      const result = createUserAgentFromPkgJson({
        name: '@org/my-package',
        version: '1.2.3',
      })
      expect(result).toBe('org-my-package/1.2.3')
    })
  })
})

// =============================================================================
// JSON Request Body Creation
// =============================================================================

describe('JSON Request Body Creation', () => {
  describe('createRequestBodyForJson', () => {
    it('should create request body for JSON data with default basename', () => {
      const jsonData = { number: 42, test: 'data' }
      const result = createRequestBodyForJson(jsonData)

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="data"')
      expect(result[0]).toContain('filename="data.json"')
      expect(result[0]).toContain('Content-Type: application/json')
      expect(result[2]).toBe('\r\n')
    })

    it('should create request body for JSON data with custom basename', () => {
      const jsonData = { custom: true }
      const result = createRequestBodyForJson(jsonData, 'custom-file.json')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="custom-file"')
      expect(result[0]).toContain('filename="custom-file.json"')
      expect(result[0]).toContain('Content-Type: application/json')
    })

    it('should handle basename without extension', () => {
      const jsonData = { test: 'no-ext' }
      const result = createRequestBodyForJson(jsonData, 'noextension')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="noextension"')
      expect(result[0]).toContain('filename="noextension"')
      expect(result[0]).toContain('Content-Type: application/json')
    })

    it('should handle complex JSON data', () => {
      const jsonData = {
        array: [1, 2, 3],
        boolean: false,
        nested: { object: true },
        null: null,
        number: 123.45,
        string: 'test',
      }
      const result = createRequestBodyForJson(jsonData, 'complex.json')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="complex"')
      expect(result[0]).toContain('filename="complex.json"')
      expect(result[0]).toContain('Content-Type: application/json')
    })

    it('should handle empty object', () => {
      const jsonData = {}
      const result = createRequestBodyForJson(jsonData, 'empty.json')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="empty"')
      expect(result[0]).toContain('filename="empty.json"')
    })

    it('should handle null data', () => {
      const jsonData = null
      const result = createRequestBodyForJson(jsonData, 'null.json')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="null"')
      expect(result[0]).toContain('filename="null.json"')
    })

    it('should handle different file extensions', () => {
      const jsonData = { test: true }
      const result = createRequestBodyForJson(jsonData, 'data.manifest')

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('name="data"')
      expect(result[0]).toContain('filename="data.manifest"')
    })
  })
})
