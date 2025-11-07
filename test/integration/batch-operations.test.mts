/**
 * @fileoverview Integration test for batch operations and concurrent requests.
 * Tests bulk scanning, parallel API calls, and rate limiting.
 */

import { describe, expect, it } from 'vitest'
import nock from 'nock'

import {
  createTestClient,
  setupTestEnvironment,
} from '../utils/environment.mts'

describe('Integration - Batch Operations', () => {
  setupTestEnvironment()

  it('should handle batch package scanning', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    const packages = [
      { name: 'react', version: '18.2.0' },
      { name: 'vue', version: '3.3.4' },
      { name: 'angular', version: '16.2.0' },
      { name: 'svelte', version: '4.2.0' },
    ]

    // Mock batch scan endpoint
    nock('https://api.socket.dev')
      .post('/v0/npm/batch-scan', body => {
        return body.packages && body.packages.length === 4
      })
      .reply(200, {
        status: 'success',
        data: {
          batch_id: 'batch-456',
          total: 4,
          queued: 4,
          status: 'processing',
        },
      })

    // Mock batch status check
    nock('https://api.socket.dev')
      .get('/v0/npm/batch-scan/batch-456/status')
      .reply(200, {
        status: 'success',
        data: {
          batch_id: 'batch-456',
          total: 4,
          completed: 4,
          failed: 0,
          status: 'completed',
          results: packages.map((pkg, index) => ({
            package: pkg.name,
            version: pkg.version,
            score: 80 + index * 2,
            issues: index,
          })),
        },
      })

    const batchResult = await client.batchScanPackages(packages)
    expect(batchResult.batch_id).toBe('batch-456')
    expect(batchResult.total).toBe(4)

    const status = await client.getBatchScanStatus('batch-456')
    expect(status.completed).toBe(4)
    expect(status.results).toHaveLength(4)
    expect(status.status).toBe('completed')
  })

  it('should handle concurrent API requests with proper throttling', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    const packageNames = ['lodash', 'axios', 'express', 'react', 'vue']

    // Mock multiple concurrent requests
    for (const name of packageNames) {
      nock('https://api.socket.dev')
        .get(`/v0/npm/package/${name}/latest`)
        .reply(200, {
          status: 'success',
          data: {
            name,
            version: '1.0.0',
            score: 85,
          },
        })
    }

    const startTime = Date.now()

    // Execute concurrent requests
    const results = await Promise.all(
      packageNames.map(name => client.getPackageLatest(name)),
    )

    const duration = Date.now() - startTime

    expect(results).toHaveLength(5)
    expect(results.every(r => r.score === 85)).toBe(true)

    // With proper concurrency, should complete quickly (< 1 second for mock requests)
    expect(duration).toBeLessThan(1000)
  })

  it('should handle bulk dependency analysis', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    const lockfileContent = `
{
  "name": "test-project",
  "lockfileVersion": 3,
  "packages": {
    "node_modules/express": {
      "version": "4.18.2"
    },
    "node_modules/lodash": {
      "version": "4.17.21"
    },
    "node_modules/axios": {
      "version": "1.6.0"
    }
  }
}
`

    // Mock bulk analysis
    nock('https://api.socket.dev')
      .post('/v0/dependencies/analyze', body => {
        return body.includes('lockfileVersion')
      })
      .reply(200, {
        status: 'success',
        data: {
          analysis_id: 'analysis-789',
          total_packages: 3,
          direct_dependencies: 3,
          transitive_dependencies: 0,
          vulnerabilities: {
            critical: 0,
            high: 0,
            medium: 1,
            low: 2,
          },
          supply_chain_risk: 'low',
          packages: [
            {
              name: 'express',
              version: '4.18.2',
              score: 90,
              issues: [],
            },
            {
              name: 'lodash',
              version: '4.17.21',
              score: 85,
              issues: [
                {
                  type: 'deprecated',
                  severity: 'medium',
                },
              ],
            },
            {
              name: 'axios',
              version: '1.6.0',
              score: 92,
              issues: [],
            },
          ],
        },
      })

    const analysis = await client.analyzeDependencies(lockfileContent)

    expect(analysis.analysis_id).toBe('analysis-789')
    expect(analysis.total_packages).toBe(3)
    expect(analysis.packages).toHaveLength(3)
    expect(analysis.vulnerabilities.medium).toBe(1)
    expect(analysis.supply_chain_risk).toBe('low')

    const lodashPackage = analysis.packages.find(p => p.name === 'lodash')
    expect(lodashPackage?.issues).toHaveLength(1)
    expect(lodashPackage?.issues[0].type).toBe('deprecated')
  })

  it('should handle paginated bulk results', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    // Mock first page
    nock('https://api.socket.dev')
      .get('/v0/repositories')
      .query({ limit: 10, offset: 0 })
      .reply(200, {
        status: 'success',
        data: {
          repositories: Array.from({ length: 10 }, (_, i) => ({
            id: `repo-${i}`,
            name: `repo-${i}`,
          })),
          total: 25,
          limit: 10,
          offset: 0,
          has_more: true,
        },
      })

    // Mock second page
    nock('https://api.socket.dev')
      .get('/v0/repositories')
      .query({ limit: 10, offset: 10 })
      .reply(200, {
        status: 'success',
        data: {
          repositories: Array.from({ length: 10 }, (_, i) => ({
            id: `repo-${i + 10}`,
            name: `repo-${i + 10}`,
          })),
          total: 25,
          limit: 10,
          offset: 10,
          has_more: true,
        },
      })

    // Mock third page
    nock('https://api.socket.dev')
      .get('/v0/repositories')
      .query({ limit: 10, offset: 20 })
      .reply(200, {
        status: 'success',
        data: {
          repositories: Array.from({ length: 5 }, (_, i) => ({
            id: `repo-${i + 20}`,
            name: `repo-${i + 20}`,
          })),
          total: 25,
          limit: 10,
          offset: 20,
          has_more: false,
        },
      })

    // Fetch all pages
    const allRepos: Array<{ id: string; name: string }> = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const page = await client.getRepositories({ limit: 10, offset })
      allRepos.push(...page.repositories)
      hasMore = page.has_more
      offset += page.repositories.length
    }

    expect(allRepos).toHaveLength(25)
    expect(allRepos[0].id).toBe('repo-0')
    expect(allRepos[24].id).toBe('repo-24')
  })
})
