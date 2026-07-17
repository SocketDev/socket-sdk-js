/**
 * @file Tests for main module exports and public API surface.
 */
import { describe, expect, it } from 'vitest'

import * as sdk from '../../../src/index.mts'

describe('index.ts exports', () => {
  it('should export ResponseError class', () => {
    expect(sdk.ResponseError).toBeDefined()
    expect(typeof sdk.ResponseError).toBe('function')
  })

  it('should export SocketSdk class', () => {
    expect(sdk.SocketSdk).toBeDefined()
    expect(typeof sdk.SocketSdk).toBe('function')
  })

  it('should export user-agent function', () => {
    expect(typeof sdk.createUserAgentFromPkgJson).toBe('function')
  })

  it('should export all quota utility functions', () => {
    expect(typeof sdk.calculateTotalQuotaCost).toBe('function')
    expect(typeof sdk.getAllMethodRequirements).toBe('function')
    expect(typeof sdk.getMethodRequirements).toBe('function')
    expect(typeof sdk.getMethodsByPermissions).toBe('function')
    expect(typeof sdk.getMethodsByQuotaCost).toBe('function')
    expect(typeof sdk.getQuotaCost).toBe('function')
    expect(typeof sdk.getQuotaUsageSummary).toBe('function')
    expect(typeof sdk.getRequiredPermissions).toBe('function')
    expect(typeof sdk.hasQuotaForMethods).toBe('function')
  })

  it('should have a comprehensive export list', () => {
    const expectedExports = [
      // Main SDK class
      'ResponseError',
      'SocketSdk',

      // Quota utility functions
      'calculateTotalQuotaCost',
      'getAllMethodRequirements',
      'getMethodRequirements',
      'getMethodsByPermissions',
      'getMethodsByQuotaCost',
      'getQuotaCost',
      'getQuotaUsageSummary',
      'getRequiredPermissions',
      'hasQuotaForMethods',

      // User agent function
      'createUserAgentFromPkgJson',

      // Blob helpers
      'fetchBlob',
      'fetchChunkedBytes',
      'fetchRawBytes',
      'tryDecodeText',

      // v1 full-scan and blob-upload primitives
      'assembleManifest',
      'deriveApiV1BaseUrl',
      'hashFile',
    ]

    for (let i = 0, { length } = expectedExports; i < length; i += 1) {
      const exportName = expectedExports[i]!
      expect(sdk).toHaveProperty(exportName)
    }
  })

  it('should not export unexpected functions', () => {
    const sdkKeys = Object.keys(sdk)
    const expectedKeys = new Set([
      'assembleManifest',
      'calculateTotalQuotaCost',
      'createUserAgentFromPkgJson',
      'deriveApiV1BaseUrl',
      'fetchBlob',
      'fetchChunkedBytes',
      'fetchRawBytes',
      'getAllMethodRequirements',
      'getMethodRequirements',
      'getMethodsByPermissions',
      'getMethodsByQuotaCost',
      'getQuotaCost',
      'getQuotaUsageSummary',
      'getRequiredPermissions',
      'hashFile',
      'hasQuotaForMethods',
      'ResponseError',
      'SocketSdk',
      'tryDecodeText',
    ])

    // Check that we don't have unexpected exports (CommonJS build adds 'default')
    const unexpectedExports = sdkKeys.filter(
      key => !expectedKeys.has(key) && key !== 'default',
    )
    expect(unexpectedExports).toEqual([])
  })
})
