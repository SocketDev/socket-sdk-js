/** @fileoverview Tests for reshapeArtifactForPublicPolicy function edge cases. */

import { describe, expect, it } from 'vitest'

import { reshapeArtifactForPublicPolicy } from '../../src/http-client.js'

describe('reshapeArtifactForPublicPolicy - Complete Coverage', () => {
  describe('when user is authenticated', () => {
    it('should return data unchanged for authenticated users', () => {
      const data = {
        artifacts: [{ name: 'test', alerts: [{ severity: 'high' }] }],
      }

      const result = reshapeArtifactForPublicPolicy(data, true)

      expect(result).toBe(data)
    })
  })

  describe('when user is not authenticated', () => {
    describe('object with artifacts array', () => {
      it('should reshape artifacts array for unauthenticated users', () => {
        // publicPolicy: malware→error, criticalCVE→warn, deprecated→monitor
        const data = {
          artifacts: [
            {
              name: 'test-package',
              version: '1.0.0',
              size: 1000,
              author: 'test-author',
              type: 'npm',
              supplyChainRisk: 0.5,
              scorecards: { overall: 8 },
              topLevelAncestors: ['parent'],
              extra: 'should-be-removed',
              alerts: [
                {
                  type: 'criticalCVE',
                  severity: 'high',
                  key: 'alert1',
                },
                {
                  type: 'malware',
                  severity: 'low',
                  key: 'alert2',
                },
                {
                  type: 'deprecated',
                  severity: 'medium',
                  key: 'alert3',
                },
              ],
            },
          ],
          metadata: 'should-remain',
        }

        const result = reshapeArtifactForPublicPolicy(data, false)

        expect(result).toEqual({
          artifacts: [
            {
              name: 'test-package',
              version: '1.0.0',
              size: 1000,
              author: 'test-author',
              type: 'npm',
              supplyChainRisk: 0.5,
              scorecards: { overall: 8 },
              topLevelAncestors: ['parent'],
              alerts: [
                {
                  action: 'warn',
                  key: 'alert1',
                  severity: 'high',
                  type: 'criticalCVE',
                },
                {
                  action: 'monitor',
                  key: 'alert3',
                  severity: 'medium',
                  type: 'deprecated',
                },
              ],
            },
          ],
          metadata: 'should-remain',
        })
      })

      it('should filter alerts by actions when provided', () => {
        // publicPolicy: malware→error, criticalCVE→warn, deprecated→monitor
        const data = {
          artifacts: [
            {
              name: 'test',
              alerts: [
                {
                  severity: 'high',
                  type: 'malware',
                  key: 'alert1',
                },
                {
                  severity: 'high',
                  type: 'criticalCVE',
                  key: 'alert2',
                },
                {
                  severity: 'high',
                  type: 'deprecated',
                  key: 'alert3',
                },
              ],
            },
          ],
        }

        const result = reshapeArtifactForPublicPolicy(data, false, 'error,warn')

        expect(result.artifacts?.[0]?.alerts).toEqual([
          { action: 'error', key: 'alert1', severity: 'high', type: 'malware' },
          {
            action: 'warn',
            key: 'alert2',
            severity: 'high',
            type: 'criticalCVE',
          },
        ])
      })

      it('should handle actions with exact match (no whitespace trimming)', () => {
        // actions are split by comma — ' warn' (with space) should NOT match 'warn'
        const data = {
          artifacts: [
            {
              name: 'test',
              alerts: [
                {
                  severity: 'high',
                  type: 'malware',
                  key: 'alert1',
                },
                {
                  severity: 'high',
                  type: 'criticalCVE',
                  key: 'alert2',
                },
              ],
            },
          ],
        }

        // ' warn' (with leading space) should NOT match the 'warn' action
        const result = reshapeArtifactForPublicPolicy(
          data,
          false,
          'error, warn',
        )

        // Only 'error' should match exactly; ' warn' (with space) does not match 'warn'
        expect(result.artifacts?.[0]?.alerts).toEqual([
          {
            action: 'error',
            key: 'alert1',
            severity: 'high',
            type: 'malware',
          },
        ])
      })

      it('should handle artifacts with no alerts', () => {
        const data = {
          artifacts: [
            {
              name: 'test-package',
              version: '1.0.0',
            },
          ],
        }

        const result = reshapeArtifactForPublicPolicy(data, false)

        expect(result.artifacts?.[0]).toEqual({
          name: 'test-package',
          version: '1.0.0',
        })
      })
    })

    describe('single artifact with alerts', () => {
      it('should reshape single artifact for unauthenticated users', () => {
        const data = {
          name: 'single-package',
          version: '2.0.0',
          size: 2000,
          author: 'single-author',
          type: 'npm',
          supplyChainRisk: 0.3,
          scorecards: { overall: 9 },
          topLevelAncestors: ['ancestor'],
          extra: 'should-be-removed',
          alerts: [
            { type: 'criticalCVE', severity: 'high', key: 'alert1' },
            {
              type: 'malware',
              severity: 'low',
              key: 'alert2',
            },
          ],
        }

        const result = reshapeArtifactForPublicPolicy(data, false)

        expect(result).toEqual({
          name: 'single-package',
          version: '2.0.0',
          size: 2000,
          author: 'single-author',
          type: 'npm',
          supplyChainRisk: 0.3,
          scorecards: { overall: 9 },
          topLevelAncestors: ['ancestor'],
          alerts: [
            {
              action: 'warn',
              key: 'alert1',
              severity: 'high',
              type: 'criticalCVE',
            },
          ],
        })
      })

      it('should filter single artifact alerts by actions', () => {
        // publicPolicy: malware→error, criticalCVE→warn
        const data = {
          name: 'test',
          alerts: [
            { severity: 'high', type: 'criticalCVE', key: 'alert1' },
            {
              severity: 'critical',
              type: 'malware',
              key: 'alert2',
            },
          ],
        }

        const result = reshapeArtifactForPublicPolicy(data, false, 'error')

        expect(result.alerts).toEqual([
          {
            action: 'error',
            key: 'alert2',
            severity: 'critical',
            type: 'malware',
          },
        ])
      })
    })

    describe('data with neither artifacts nor alerts', () => {
      it('should return data unchanged when no artifacts or alerts present', () => {
        const data = {
          metadata: 'some-data',
          info: 'other-info',
        }

        const result = reshapeArtifactForPublicPolicy(data, false)

        expect(result).toBe(data)
      })
    })

    describe('edge cases with actions parameter', () => {
      it('should handle empty actions string', () => {
        const data = {
          alerts: [{ severity: 'high', type: 'criticalCVE', key: 'alert1' }],
        }

        const result = reshapeArtifactForPublicPolicy(data, false, '')

        expect(result.alerts).toEqual([
          {
            action: 'warn',
            key: 'alert1',
            severity: 'high',
            type: 'criticalCVE',
          },
        ])
      })

      it('should handle undefined actions parameter', () => {
        const data = {
          alerts: [{ severity: 'high', type: 'criticalCVE', key: 'alert1' }],
        }

        const result = reshapeArtifactForPublicPolicy(data, false, undefined)

        expect(result.alerts).toEqual([
          {
            action: 'warn',
            key: 'alert1',
            severity: 'high',
            type: 'criticalCVE',
          },
        ])
      })

      it('should pass alerts with unknown types when no actions filter', () => {
        const data = {
          alerts: [{ severity: 'high', type: 'unknownType', key: 'alert1' }],
        }

        const result = reshapeArtifactForPublicPolicy(data, false)

        expect(result.alerts).toEqual([
          {
            action: undefined,
            key: 'alert1',
            severity: 'high',
            type: 'unknownType',
          },
        ])
      })
    })
  })
})
