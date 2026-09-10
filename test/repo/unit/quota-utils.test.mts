/**
 * @file Tests for quota utility functions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  calculateTotalQuotaCost,
  getAllMethodRequirements,
  getMethodRequirements,
  getMethodsByPermissions,
  getMethodsByQuotaCost,
  getQuotaCost,
  getQuotaUsageSummary,
  getRequiredPermissions,
  hasQuotaForMethods,
} from '../../../src/quota-utils.mts'

import type * as NodeFs from 'node:fs'
import type * as MemoizeModule from '@socketsecurity/lib/memo/memoize'

describe('Quota Utils', () => {
  describe('getQuotaCost', () => {
    it.each([
      ['batchPackageFetch', 100],
      ['searchDependencies', 1],
      ['uploadManifestFiles', 100],
      ['getOrgAnalytics', 1],
      ['getAPITokens', 10],
      ['getScoreByNpmPackage', 1],
      ['getQuota', 0],
      ['getOrganizations', 1],
      ['getScan', 10],
    ])('should return %i quota cost for %s', (method, expectedCost) => {
      expect(getQuotaCost(method)).toBe(expectedCost)
    })

    it('should throw error for unknown method', () => {
      expect(() => getQuotaCost('unknownMethod')).toThrow(Error)
    })
  })

  describe('getRequiredPermissions', () => {
    it('should return correct permissions for package methods', () => {
      expect(getRequiredPermissions('batchPackageFetch')).toEqual([
        'packages:list',
      ])
      expect(getRequiredPermissions('uploadManifestFiles')).toEqual([
        'packages:upload',
      ])
    })

    it('should return correct permissions for scanning methods', () => {
      expect(getRequiredPermissions('createOrgFullScan')).toEqual([
        'full-scans:create',
      ])
      expect(getRequiredPermissions('deleteOrgFullScan')).toEqual([
        'full-scans:delete',
      ])
    })

    it('should return empty array for methods with no permissions', () => {
      expect(getRequiredPermissions('getQuota')).toEqual([])
      expect(getRequiredPermissions('getOrganizations')).toEqual([])
    })

    it('should throw error for unknown method', () => {
      expect(() => getRequiredPermissions('unknownMethod')).toThrow(Error)
    })
  })

  describe('getMethodRequirements', () => {
    it.each([
      ['createOrgWebhook', 1, ['webhooks:create']],
      ['getOrgWebhooksList', 1, ['webhooks:list']],
      ['getOrgTelemetryConfig', 1, []],
      ['updateOrgTelemetryConfig', 1, ['telemetry-policy:update']],
      ['postOrgTelemetry', 0, []],
      ['postAPITokenUpdate', 10, ['api-tokens:create']],
      ['updateOrgSecurityPolicy', 1, ['security-policy:update']],
      ['getDiffScanGfm', 1, ['diff-scans:list']],
      ['createOrgDiffScanFromIds', 1, ['diff-scans:create', 'full-scans:list']],
      ['createOrgFullScanFromArchive', 1, ['full-scans:create']],
      ['downloadOrgFullScanFilesAsTar', 1, ['full-scans:list']],
    ] as const)(
      'exposes verified backend requirements for %s',
      (method, quota, permissions) => {
        expect(getMethodRequirements(method)).toEqual({ quota, permissions })
      },
    )

    it('should return both quota and permissions for a method', () => {
      const requirements = getMethodRequirements('batchPackageFetch')
      expect(requirements).toEqual({
        quota: 100,
        permissions: ['packages:list'],
      })
    })

    it('should return requirements for free method with no permissions', () => {
      const requirements = getMethodRequirements('getQuota')
      expect(requirements).toEqual({
        quota: 0,
        permissions: [],
      })
    })
  })

  describe('calculateTotalQuotaCost', () => {
    it('should calculate total cost for multiple methods', () => {
      const methods = ['batchPackageFetch', 'getOrgAnalytics', 'getQuota']
      const total = calculateTotalQuotaCost(methods)
      expect(total).toBe(101)
    })

    it('should return 0 for empty array', () => {
      expect(calculateTotalQuotaCost([])).toBe(0)
    })

    it('should return 0 for all free methods', () => {
      const methods = ['getQuota', 'getEnabledEntitlements', 'postOrgTelemetry']
      expect(calculateTotalQuotaCost(methods)).toBe(0)
    })
  })

  describe('getMethodsByQuotaCost', () => {
    it('should return high-cost methods', () => {
      const methods = getMethodsByQuotaCost(100)
      expect(methods).toContain('batchPackageFetch')
      expect(methods).toContain('createDependenciesSnapshot')
      expect(methods).toContain('uploadManifestFiles')
      expect(methods.length).toBeGreaterThan(0)
    })

    it('should return medium-cost methods', () => {
      const methods = getMethodsByQuotaCost(10)
      expect(methods).toContain('getScan')
      expect(methods).toContain('getAPITokens')
      expect(methods.length).toBeGreaterThan(0)
    })

    it('should return free methods', () => {
      const methods = getMethodsByQuotaCost(0)
      expect(methods).toContain('getQuota')
      expect(methods).toContain('getEnabledEntitlements')
      expect(methods).toContain('postOrgTelemetry')
    })
  })

  describe('getMethodsByPermissions', () => {
    it('should return methods requiring packages permissions', () => {
      const methods = getMethodsByPermissions(['packages:list'])
      expect(methods).toContain('batchPackageFetch')
      expect(methods).toContain('batchPackageStream')
    })

    it('should return methods requiring analytics permissions', () => {
      const methods = getMethodsByPermissions(['report:write'])
      expect(methods).toContain('getOrgAnalytics')
      expect(methods).toContain('getRepoAnalytics')
    })

    it('should return empty array for non-existent permission', () => {
      const methods = getMethodsByPermissions(['fake:permission'])
      expect(methods).toEqual([])
    })
  })

  describe('hasQuotaForMethods', () => {
    it('should return true when quota is sufficient', () => {
      expect(
        hasQuotaForMethods(200, ['batchPackageFetch', 'getOrgAnalytics']),
      ).toBe(true)
    })

    it('should return false when quota is insufficient', () => {
      expect(
        hasQuotaForMethods(50, ['batchPackageFetch', 'searchDependencies']),
      ).toBe(false)
    })

    it('should return true for exact quota match', () => {
      expect(
        hasQuotaForMethods(101, ['batchPackageFetch', 'getOrgAnalytics']),
      ).toBe(true)
    })

    it('should return true for free methods with zero quota', () => {
      expect(
        hasQuotaForMethods(0, ['getQuota', 'getEnabledEntitlements']),
      ).toBe(true)
    })
  })

  describe('getQuotaUsageSummary', () => {
    it('should group methods by quota cost', () => {
      const summary = getQuotaUsageSummary()

      expect(summary).toHaveProperty('0 units')
      expect(summary).toHaveProperty('10 units')
      expect(summary).toHaveProperty('100 units')

      expect(summary['0 units']).toContain('getQuota')
      expect(summary['1 units']).toContain('getOrgAnalytics')
      expect(summary['10 units']).toContain('getAPITokens')
      expect(summary['100 units']).toContain('batchPackageFetch')
    })

    it('should have sorted method names within each cost level', () => {
      const summary = getQuotaUsageSummary()

      const methodsList = Object.values(summary)
      for (let i = 0, { length } = methodsList; i < length; i += 1) {
        const methods = methodsList[i]!
        // Node 18 lacks toSorted; spreading creates a fresh array.
        // oxlint-disable-next-line unicorn/no-array-sort -- fresh array
        const sorted = [...methods].sort()
        expect(methods).toEqual(sorted)
      }
    })
  })

  describe('getAllMethodRequirements', () => {
    it('should return all methods with their requirements', () => {
      const allRequirements = getAllMethodRequirements()

      expect(allRequirements).toHaveProperty('batchPackageFetch')
      expect(allRequirements).toHaveProperty('getQuota')
      expect(allRequirements).toHaveProperty('uploadManifestFiles')

      expect(allRequirements['batchPackageFetch']).toEqual({
        quota: 100,
        permissions: ['packages:list'],
      })

      expect(allRequirements['getQuota']).toEqual({
        quota: 0,
        permissions: [],
      })
    })

    it('should return a copy of permissions arrays', () => {
      const allRequirements = getAllMethodRequirements()
      const permissions = allRequirements['batchPackageFetch']?.permissions

      if (permissions) {
        // Modify the returned array
        permissions.push('test:permission')

        // Get fresh copy and verify original wasn't modified
        const freshRequirements = getAllMethodRequirements()
        expect(freshRequirements['batchPackageFetch']?.permissions).toEqual([
          'packages:list',
        ])
      }
    })
  })

  describe('Error handling', () => {
    it('should throw for unknown method in getMethodRequirements', () => {
      expect(() => getMethodRequirements('unknownMethodName')).toThrow(Error)
    })

    it('should throw for unknown method in getQuotaCost', () => {
      expect(() => getQuotaCost('anotherUnknownMethod')).toThrow(Error)
    })

    it('should throw for unknown method in getRequiredPermissions', () => {
      expect(() => getRequiredPermissions('yetAnotherUnknownMethod')).toThrow(
        Error,
      )
    })
  })

  describe('File system error handling', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.resetModules()
    })

    it('should throw error when requirements.json file cannot be read', async () => {
      vi.doMock(
        import('node:fs'),
        () =>
          ({
            existsSync: vi.fn(() => true),
            readFileSync: vi.fn(() => {
              throw new Error('ENOENT: no such file or directory')
            }),
          }) as unknown as typeof NodeFs,
      )

      vi.doMock(
        import('@socketsecurity/lib/memo/memoize'),
        () =>
          ({
            memoize: (fn: unknown) => fn,
            once: (fn: unknown) => fn,
          }) as unknown as typeof MemoizeModule,
      )

      const { getQuotaCost: getQuotaCostMocked } =
        // oxlint-disable-next-line socket/no-dynamic-import-outside-bundle -- vi.doMock pattern (isolated test).
        await import('../../../src/quota-utils.mts')

      expect(() => getQuotaCostMocked('someMethod')).toThrow(Error)
    })

    it('should throw error when requirements.json contains invalid JSON', async () => {
      vi.doMock(
        import('node:fs'),
        () =>
          ({
            existsSync: vi.fn(() => true),
            readFileSync: vi.fn(() => 'invalid json content {'),
          }) as unknown as typeof NodeFs,
      )

      vi.doMock(
        import('@socketsecurity/lib/memo/memoize'),
        () =>
          ({
            memoize: (fn: unknown) => fn,
            once: (fn: unknown) => fn,
          }) as unknown as typeof MemoizeModule,
      )

      const { getQuotaCost: getQuotaCostMocked } =
        // oxlint-disable-next-line socket/no-dynamic-import-outside-bundle -- vi.doMock pattern (isolated test).
        await import('../../../src/quota-utils.mts')

      expect(() => getQuotaCostMocked('someMethod')).toThrow(Error)
    })

    it('should throw error when requirements.json file does not exist', async () => {
      vi.doMock(
        import('node:fs'),
        () =>
          ({
            existsSync: vi.fn(() => false),
            readFileSync: vi.fn(),
          }) as unknown as typeof NodeFs,
      )

      vi.doMock(
        import('@socketsecurity/lib/memo/memoize'),
        () =>
          ({
            memoize: (fn: unknown) => fn,
            once: (fn: unknown) => fn,
          }) as unknown as typeof MemoizeModule,
      )

      const { getQuotaCost: getQuotaCostMocked } =
        // oxlint-disable-next-line socket/no-dynamic-import-outside-bundle -- vi.doMock pattern (isolated test).
        await import('../../../src/quota-utils.mts')

      expect(() => getQuotaCostMocked('someMethod')).toThrow(Error)
    })
  })
})
