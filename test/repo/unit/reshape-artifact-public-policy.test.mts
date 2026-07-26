/**
 * @file Tests for reshapeArtifactForPublicPolicy function edge cases.
 */

import { describe, expect, it } from 'vitest'

import { reshapeArtifactForPublicPolicy } from '../../../src/http-client.mts'

describe('reshapeArtifactForPublicPolicy - Complete Coverage', () => {
  describe('when user is authenticated', () => {
    it('should return data unchanged for authenticated users', () => {
      const data = {
        artifacts: [{ name: 'test', alerts: [{ severity: 'high' }] }],
      }

      const result = reshapeArtifactForPublicPolicy(data, {
        isAuthenticated: true,
      })

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

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

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

        const result = reshapeArtifactForPublicPolicy(data, {
          actions: 'error,warn',
          isAuthenticated: false,
        })

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
        const result = reshapeArtifactForPublicPolicy(data, {
          actions: 'error, warn',
          isAuthenticated: false,
        })

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

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

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

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

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

        const result = reshapeArtifactForPublicPolicy(data, {
          actions: 'error',
          isAuthenticated: false,
        })

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

    describe('inputPurl correlation key preservation', () => {
      it('should preserve inputPurl on each artifact in an artifacts array', () => {
        const data = {
          artifacts: [
            {
              inputPurl: 'pkg:npm/test-package@1.0.0',
              name: 'test-package',
              version: '1.0.0',
              alerts: [
                { type: 'criticalCVE', severity: 'high', key: 'alert1' },
              ],
            },
          ],
        }

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

        expect(result.artifacts?.[0]?.inputPurl).toBe(
          'pkg:npm/test-package@1.0.0',
        )
      })

      it('should preserve inputPurl on a single reshaped artifact', () => {
        const data = {
          inputPurl: 'pkg:npm/single-package@2.0.0',
          name: 'single-package',
          version: '2.0.0',
          alerts: [{ type: 'criticalCVE', severity: 'high', key: 'alert1' }],
        }

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

        expect(result.inputPurl).toBe('pkg:npm/single-package@2.0.0')
      })

      it('should preserve namespace and score on reshaped artifacts', () => {
        // namespace completes the coordinate for scoped/grouped packages and
        // score drives the public score bar; both must survive the reshape.
        const data = {
          artifacts: [
            {
              inputPurl: 'pkg:maven/org.example/lib@1.0.0',
              namespace: 'org.example',
              name: 'lib',
              version: '1.0.0',
              score: { overall: 0.8, maintenance: 0.9 },
              alerts: [{ type: 'criticalCVE', severity: 'high', key: 'a1' }],
            },
          ],
        }

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

        expect(result.artifacts?.[0]?.namespace).toBe('org.example')
        expect(result.artifacts?.[0]?.score).toEqual({
          overall: 0.8,
          maintenance: 0.9,
        })
      })

      it('should preserve deep-link qualifier fields when present', () => {
        const data = {
          artifacts: [
            {
              inputPurl: 'pkg:maven/org.example/lib@1.0.0',
              name: 'lib',
              version: '1.0.0',
              classifier: 'sources',
              ext: 'jar',
              platform: 'ruby',
              artifactId: 'lib-1.0.0.tar.gz',
              path: 'go.mod',
              section: 'files',
              params: { foo: 'bar' },
              alerts: [{ type: 'criticalCVE', severity: 'high', key: 'a1' }],
            },
          ],
        }

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

        const reshaped = result.artifacts?.[0]
        expect(reshaped?.classifier).toBe('sources')
        expect(reshaped?.ext).toBe('jar')
        expect(reshaped?.platform).toBe('ruby')
        expect(reshaped?.artifactId).toBe('lib-1.0.0.tar.gz')
        expect(reshaped?.path).toBe('go.mod')
        expect(reshaped?.section).toBe('files')
        expect(reshaped?.params).toEqual({ foo: 'bar' })
      })

      it('should omit deep-link qualifier fields when absent', () => {
        // Only copy qualifier fields that are actually present so the reshaped
        // shape stays minimal (npm artifacts carry none of them).
        const data = {
          artifacts: [
            {
              inputPurl: 'pkg:npm/test@1.0.0',
              name: 'test',
              version: '1.0.0',
              alerts: [{ type: 'criticalCVE', severity: 'high', key: 'a1' }],
            },
          ],
        }

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

        const reshaped = result.artifacts?.[0]
        expect(reshaped && 'classifier' in reshaped).toBe(false)
        expect(reshaped && 'ext' in reshaped).toBe(false)
        expect(reshaped && 'platform' in reshaped).toBe(false)
        expect(reshaped && 'artifactId' in reshaped).toBe(false)
        expect(reshaped && 'path' in reshaped).toBe(false)
        expect(reshaped && 'section' in reshaped).toBe(false)
        expect(reshaped && 'params' in reshaped).toBe(false)
      })

      it('should preserve inputPurl on error rows (no alerts) for symmetry', () => {
        // Error rows have no `alerts`/`artifacts`, so they fall through
        // unchanged. This confirms success and error rows both carry the
        // correlation key.
        const data = {
          inputPurl: 'pkg:npm/missing-package@9.9.9',
          error: 'Package not found',
        }

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

        expect(result).toBe(data)
        expect(result.inputPurl).toBe('pkg:npm/missing-package@9.9.9')
      })
    })

    describe('data with neither artifacts nor alerts', () => {
      it('should return data unchanged when no artifacts or alerts present', () => {
        const data = {
          metadata: 'some-data',
          info: 'other-info',
        }

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

        expect(result).toBe(data)
      })
    })

    describe('edge cases with actions parameter', () => {
      it('should handle empty actions string', () => {
        const data = {
          alerts: [{ severity: 'high', type: 'criticalCVE', key: 'alert1' }],
        }

        const result = reshapeArtifactForPublicPolicy(data, {
          actions: '',
          isAuthenticated: false,
        })

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

        const result = reshapeArtifactForPublicPolicy(data, {
          actions: undefined,
          isAuthenticated: false,
        })

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

        const result = reshapeArtifactForPublicPolicy(data, {
          isAuthenticated: false,
        })

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
