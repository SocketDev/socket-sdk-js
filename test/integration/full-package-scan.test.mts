/**
 * @fileoverview Integration test for full package scanning workflow.
 * Tests the complete flow of scanning a package and retrieving results.
 */

import { describe, expect, it } from 'vitest'
import nock from 'nock'

import {
  createTestClient,
  setupTestEnvironment,
} from '../utils/environment.mts'
import type { FullScanIssues } from '../../types/api.d.ts'

describe('Integration - Full Package Scan Workflow', () => {
  setupTestEnvironment()

  it('should perform complete package scan workflow', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    // Mock package search
    nock('https://api.socket.dev')
      .get('/v0/npm/search')
      .query({ query: 'lodash', limit: 1 })
      .reply(200, {
        results: [
          {
            package: {
              name: 'lodash',
              version: '4.17.21',
            },
          },
        ],
      })

    // Mock full scan request
    nock('https://api.socket.dev')
      .post('/v0/npm/full-scan/lodash/4.17.21')
      .reply(200, {
        status: 'success',
        data: {
          id: 'scan-123',
          package: 'lodash',
          version: '4.17.21',
          status: 'completed',
        },
      })

    // Mock full scan result retrieval
    const mockIssues: FullScanIssues = {
      critical: [],
      high: [],
      medium: [
        {
          type: 'deprecated',
          severity: 'medium',
          title: 'Package is deprecated',
          description: 'This package is no longer maintained',
        },
      ],
      low: [],
    }

    nock('https://api.socket.dev')
      .get('/v0/npm/full-scan/lodash/4.17.21/issues')
      .reply(200, {
        status: 'success',
        data: mockIssues,
      })

    // Execute the workflow
    const searchResult = await client.searchPackages({
      query: 'lodash',
      limit: 1,
    })
    expect(searchResult.results).toHaveLength(1)
    expect(searchResult.results[0].package.name).toBe('lodash')

    const scanResult = await client.fullScanPackage('lodash', '4.17.21')
    expect(scanResult.status).toBe('completed')
    expect(scanResult.id).toBe('scan-123')

    const issues = await client.getFullScanIssues('lodash', '4.17.21')
    expect(issues.medium).toHaveLength(1)
    expect(issues.medium[0].type).toBe('deprecated')
  })

  it('should handle multi-package comparison workflow', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    const packages = [
      { name: 'axios', version: '1.6.0' },
      { name: 'node-fetch', version: '3.3.2' },
    ]

    // Mock multiple package scores
    for (const pkg of packages) {
      nock('https://api.socket.dev')
        .get(`/v0/npm/score/${pkg.name}/${pkg.version}`)
        .reply(200, {
          status: 'success',
          data: {
            package: pkg.name,
            version: pkg.version,
            score: 85,
            supplyChainRisk: 'low',
          },
        })
    }

    // Fetch all scores
    const scores = await Promise.all(
      packages.map(pkg => client.getPackageScore(pkg.name, pkg.version)),
    )

    expect(scores).toHaveLength(2)
    expect(scores[0].package).toBe('axios')
    expect(scores[1].package).toBe('node-fetch')
    expect(scores.every(s => s.score > 0)).toBe(true)
  })

  it('should handle organization workflow with repo creation and settings', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    // Mock org list
    nock('https://api.socket.dev')
      .get('/v0/organizations')
      .reply(200, {
        organizations: [
          {
            id: 'org-123',
            name: 'Test Org',
            plan: 'pro',
          },
        ],
      })

    // Mock repo creation
    nock('https://api.socket.dev')
      .post('/v0/repos', {
        name: 'test-repo',
        homepage: 'https://github.com/test/repo',
        default_branch: 'main',
      })
      .reply(201, {
        id: 'repo-456',
        name: 'test-repo',
        homepage: 'https://github.com/test/repo',
        default_branch: 'main',
      })

    // Mock repo settings retrieval
    nock('https://api.socket.dev')
      .get('/v0/repos/repo-456/settings')
      .reply(200, {
        status: 'success',
        data: {
          diffs: true,
          issues_breaking: 'error',
          issues_high: 'warn',
        },
      })

    // Execute workflow
    const orgs = await client.getOrganizations()
    expect(orgs.organizations).toHaveLength(1)
    expect(orgs.organizations[0].id).toBe('org-123')

    const repo = await client.createRepository({
      name: 'test-repo',
      homepage: 'https://github.com/test/repo',
      default_branch: 'main',
    })
    expect(repo.id).toBe('repo-456')

    const settings = await client.getRepositorySettings('repo-456')
    expect(settings.diffs).toBe(true)
    expect(settings.issues_breaking).toBe('error')
  })
})
