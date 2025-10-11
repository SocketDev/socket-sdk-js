/** @fileoverview Tests for quota utility error handling and edge cases. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Quota Utils - Error Handling', () => {
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    vi.resetModules()
  })

  afterEach(() => {
    process.chdir(originalCwd)
    vi.restoreAllMocks()
    vi.resetModules()
  })

  describe('loadRequirements error paths', () => {
    it('should throw error when requirements.json file cannot be read', async () => {
      // Mock fs.readFileSync to throw an error
      vi.doMock('node:fs', () => ({
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => {
          throw new Error('ENOENT: no such file or directory')
        }),
      }))

      const { getQuotaCost } = await import('../src/quota-utils')

      expect(() => getQuotaCost('someMethod')).toThrow(
        'Failed to load SDK method requirements',
      )
    })

    it('should throw error when requirements.json contains invalid JSON', async () => {
      // Mock fs.readFileSync to return invalid JSON
      vi.doMock('node:fs', () => ({
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => 'invalid json content {'),
      }))

      const { getQuotaCost } = await import('../src/quota-utils')

      expect(() => getQuotaCost('someMethod')).toThrow(
        'Failed to load SDK method requirements',
      )
    })

    it('should throw error when requirements.json file does not exist', async () => {
      // Mock fs.existsSync to return false
      vi.doMock('node:fs', () => ({
        existsSync: vi.fn(() => false),
        readFileSync: vi.fn(),
      }))

      const { getQuotaCost } = await import('../src/quota-utils')

      // The error is caught and wrapped, so we expect the wrapper message
      expect(() => getQuotaCost('someMethod')).toThrow(
        'Failed to load SDK method requirements',
      )
    })
  })

  describe('method validation error paths', () => {
    it('should throw error when method not found in getMethodRequirements', async () => {
      // Mock valid requirements but without the requested method
      vi.doMock('node:fs', () => ({
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() =>
          JSON.stringify({
            api: {
              validMethod: { quota: 10, permissions: [] },
            },
          }),
        ),
      }))

      const { getMethodRequirements } = await import('../src/quota-utils')

      expect(() => getMethodRequirements('missingMethod')).toThrow(
        'Unknown SDK method: "missingMethod"',
      )
    })

    it('should throw error when method not found in getRequiredPermissions', async () => {
      // Mock valid requirements but without the requested method
      vi.doMock('node:fs', () => ({
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() =>
          JSON.stringify({
            api: {
              validMethod: { quota: 10, permissions: [] },
            },
          }),
        ),
      }))

      const { getRequiredPermissions } = await import('../src/quota-utils')

      expect(() => getRequiredPermissions('missingMethod')).toThrow(
        'Unknown SDK method: "missingMethod"',
      )
    })
  })
})
