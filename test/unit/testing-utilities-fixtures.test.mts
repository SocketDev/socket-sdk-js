/**
 * @file Tests for SDK testing fixtures. Validates the fixture collections and
 *   the aggregator object exported from the testing utilities module.
 */

import { describe, expect, it } from 'vitest'

import {
  fixtures,
  issueFixtures,
  organizationFixtures,
  packageFixtures,
  repositoryFixtures,
  scanFixtures,
} from '../../src/testing.mts'

describe('Testing Utilities', () => {
  describe('Fixtures', () => {
    describe('organizationFixtures', () => {
      it('should have basic organization', () => {
        expect(organizationFixtures.basic).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          plan: expect.any(String),
        })
      })

      it('should have full organization', () => {
        expect(organizationFixtures.full).toMatchObject({
          created_at: expect.any(String),
          id: expect.any(String),
          name: expect.any(String),
          plan: expect.any(String),
          updated_at: expect.any(String),
        })
      })
    })

    describe('repositoryFixtures', () => {
      it('should have basic repository', () => {
        expect(repositoryFixtures.basic).toMatchObject({
          archived: false,
          default_branch: expect.any(String),
          id: expect.any(String),
          name: expect.any(String),
        })
      })

      it('should have archived repository', () => {
        expect(repositoryFixtures.archived).toMatchObject({
          archived: true,
          default_branch: expect.any(String),
          id: expect.any(String),
          name: expect.any(String),
        })
      })

      it('should have full repository', () => {
        expect(repositoryFixtures.full).toMatchObject({
          archived: expect.any(Boolean),
          created_at: expect.any(String),
          default_branch: expect.any(String),
          homepage: expect.any(String),
          id: expect.any(String),
          name: expect.any(String),
          updated_at: expect.any(String),
          visibility: expect.any(String),
        })
      })
    })

    describe('scanFixtures', () => {
      it('should have pending scan', () => {
        expect(scanFixtures.pending).toMatchObject({
          created_at: expect.any(String),
          id: expect.any(String),
          status: 'pending',
        })
      })

      it('should have completed scan', () => {
        expect(scanFixtures.completed).toMatchObject({
          completed_at: expect.any(String),
          created_at: expect.any(String),
          id: expect.any(String),
          issues_found: 0,
          status: 'completed',
        })
      })

      it('should have scan with issues', () => {
        expect(scanFixtures.withIssues).toMatchObject({
          issues_found: expect.any(Number),
          status: 'completed',
        })
        expect(scanFixtures.withIssues.issues_found).toBeGreaterThan(0)
      })

      it('should have failed scan', () => {
        expect(scanFixtures.failed).toMatchObject({
          created_at: expect.any(String),
          error: expect.any(String),
          id: expect.any(String),
          status: 'failed',
        })
      })
    })

    describe('packageFixtures', () => {
      it('should have safe package', () => {
        expect(packageFixtures.safe).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          score: expect.any(Number),
          version: expect.any(String),
        })
        expect(packageFixtures.safe.score).toBeGreaterThanOrEqual(90)
      })

      it('should have vulnerable package', () => {
        expect(packageFixtures.vulnerable).toMatchObject({
          id: expect.any(String),
          issues: expect.any(Array),
          name: expect.any(String),
          score: expect.any(Number),
          version: expect.any(String),
        })
        expect(packageFixtures.vulnerable.score).toBeLessThan(50)
      })

      it('should have malware package', () => {
        expect(packageFixtures.malware).toMatchObject({
          id: expect.any(String),
          issues: expect.arrayContaining(['malware']),
          name: expect.any(String),
          score: 0,
          version: expect.any(String),
        })
      })
    })

    describe('issueFixtures', () => {
      it('should have vulnerability issue', () => {
        expect(issueFixtures.vulnerability).toMatchObject({
          description: expect.any(String),
          key: expect.any(String),
          severity: expect.any(String),
          type: 'vulnerability',
        })
      })

      it('should have malware issue', () => {
        expect(issueFixtures.malware).toMatchObject({
          description: expect.any(String),
          severity: 'critical',
          type: 'malware',
        })
      })

      it('should have license issue', () => {
        expect(issueFixtures.license).toMatchObject({
          description: expect.any(String),
          severity: expect.any(String),
          type: 'license',
        })
      })
    })

    describe('fixtures object', () => {
      it('should export all fixture categories', () => {
        expect(fixtures).toHaveProperty('organizations')
        expect(fixtures).toHaveProperty('repositories')
        expect(fixtures).toHaveProperty('scans')
        expect(fixtures).toHaveProperty('packages')
        expect(fixtures).toHaveProperty('issues')
      })

      it('should expose every fixture collection', () => {
        // The aggregator must surface each fixture group. Assert the wiring via
        // the aggregator's own keys + shape — referencing the src bindings as
        // the expected value would validate src against itself.
        // oxlint-disable-next-line unicorn/no-array-sort -- toSorted throws on Node <20 (engines floor 18.20.8); Object.keys returns a fresh array so in-place sort is safe.
        expect(Object.keys(fixtures).sort()).toEqual([
          'issues',
          'organizations',
          'packages',
          'repositories',
          'scans',
        ])
        const groups = Object.values(fixtures)
        for (let i = 0, { length } = groups; i < length; i += 1) {
          const group = groups[i]!
          expect(group).toBeTypeOf('object')
          expect(group).not.toBeNull()
          expect(Object.keys(group as object).length).toBeGreaterThan(0)
        }
      })
    })
  })
})
