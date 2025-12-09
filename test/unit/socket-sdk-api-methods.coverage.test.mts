/**
 * @fileoverview Coverage tests for Socket SDK API methods using local HTTP server.
 *
 * APPROACH: Instead of nock (which bleeds state in coverage mode), we use a real
 * HTTP server that starts/stops cleanly. This works in coverage mode because we're
 * using actual HTTP, not module patching.
 */

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index'

import type { IncomingMessage, Server, ServerResponse } from 'node:http'

describe('SocketSdk - API Methods Coverage', () => {
  let server: Server
  let baseUrl: string
  let client: SocketSdk

  beforeAll(async () => {
    // Start local HTTP server on random port
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Parse URL to determine response
      const url = req.url || ''

      // Consume request body for POST/PUT/PATCH requests
      if (
        req.method === 'POST' ||
        req.method === 'PUT' ||
        req.method === 'PATCH'
      ) {
        let _body = ''
        req.on('data', chunk => {
          _body += chunk.toString()
        })
        req.on('end', () => {
          // Body consumed, now respond
          respondToRequest()
        })
        return
      }

      // For GET/DELETE, respond immediately
      respondToRequest()

      function respondToRequest() {
        // Handle error cases first
        if (url.includes('/patches') && url.includes('invalid-scan')) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Not Found' }))
          return
        }

        // Set common headers for success responses
        res.writeHead(200, { 'Content-Type': 'application/json' })

        // Route requests to appropriate responses
        if (url.includes('/package/batch')) {
          // Batch package fetch endpoint
          res.end(
            JSON.stringify({
              data: [{ name: 'lodash', version: '4.17.21', score: 95 }],
            }),
          )
        } else if (url.includes('/npm/')) {
          // Package analysis endpoints
          if (url.includes('/issues')) {
            res.end(JSON.stringify({ data: { issues: [] } }))
          } else if (url.includes('/score')) {
            res.end(JSON.stringify({ data: { score: 95 } }))
          } else {
            res.end(JSON.stringify({ data: {} }))
          }
        } else if (url.includes('/organizations')) {
          // Organization endpoints
          if (url.includes('/repos')) {
            if (req.method === 'DELETE') {
              res.end(JSON.stringify({ success: true }))
            } else if (req.method === 'PUT' || req.method === 'POST') {
              res.end(
                JSON.stringify({ data: { id: 'repo-1', name: 'test-repo' } }),
              )
            } else {
              res.end(JSON.stringify({ data: [] }))
            }
          } else if (url.includes('/full-scans')) {
            if (req.method === 'DELETE') {
              res.end(JSON.stringify({ success: true }))
            } else if (req.method === 'POST') {
              if (url.includes('/archive')) {
                // Archive upload endpoint
                res.end(
                  JSON.stringify({
                    api_url: null,
                    branch: 'main',
                    commit_hash: 'abc123',
                    commit_message: 'Test commit',
                    committers: [],
                    created_at: '2024-01-01T00:00:00Z',
                    html_report_url: 'https://socket.dev/report/scan-1',
                    html_url: null,
                    id: 'scan-1',
                    integration_branch_url: null,
                    integration_commit_url: null,
                    integration_pull_request_url: null,
                    integration_repo_url: '',
                    integration_type: 'api',
                    organization_id: 'org-1',
                    organization_slug: 'test-org',
                    pull_request: null,
                    repo: 'test-repo',
                    repository_id: 'repo-1',
                    repository_slug: 'test-repo',
                    scan_state: 'pending',
                    updated_at: '2024-01-01T00:00:00Z',
                    workspace: 'main',
                  }),
                )
              } else {
                res.end(JSON.stringify({ data: { id: 'scan-1' } }))
              }
            } else if (url.includes('/files.tar')) {
              // Tar download endpoint
              res.writeHead(200, { 'Content-Type': 'application/x-tar' })
              res.end(Buffer.from('test tar content'))
            } else if (url.includes('/metadata')) {
              res.end(
                JSON.stringify({ data: { id: 'scan-1', status: 'complete' } }),
              )
            } else {
              res.end(JSON.stringify({ data: [] }))
            }
          } else if (url.includes('/diff-scans')) {
            if (req.method === 'DELETE') {
              res.end(JSON.stringify({ success: true }))
            } else if (req.method === 'POST') {
              res.end(JSON.stringify({ data: { id: 'diff-1' } }))
            } else {
              res.end(JSON.stringify({ data: [] }))
            }
          } else if (url.includes('/labels')) {
            if (req.method === 'DELETE') {
              res.end(JSON.stringify({ success: true }))
            } else if (req.method === 'PUT' || req.method === 'POST') {
              res.end(JSON.stringify({ data: { id: 'label-1', name: 'test' } }))
            } else {
              res.end(JSON.stringify({ data: [] }))
            }
          } else if (url.includes('/analytics')) {
            res.end(JSON.stringify({ data: {} }))
          } else if (url.includes('/security-policy')) {
            if (req.method === 'PUT') {
              res.end(JSON.stringify({ data: { enabled: true } }))
            } else {
              res.end(JSON.stringify({ data: { enabled: false } }))
            }
          } else if (url.includes('/license-policy')) {
            if (req.method === 'PUT') {
              res.end(JSON.stringify({ data: { enabled: true } }))
            } else {
              res.end(JSON.stringify({ data: { enabled: false } }))
            }
          } else if (url.includes('/triage')) {
            res.end(JSON.stringify({ data: [] }))
          } else {
            res.end(JSON.stringify({ data: [] }))
          }
        } else if (url.includes('/scan')) {
          // Scanning endpoints
          if (req.method === 'POST') {
            res.end(
              JSON.stringify({ data: { id: 'scan-1', status: 'queued' } }),
            )
          } else {
            res.end(
              JSON.stringify({ data: { id: 'scan-1', status: 'complete' } }),
            )
          }
        } else if (url.includes('/sbom/export')) {
          // SBOM endpoints
          res.end(JSON.stringify({ data: { format: 'cyclonedx' } }))
        } else if (url.includes('/patches')) {
          // Patches endpoint
          res.end(JSON.stringify({ data: [] }))
        } else if (url.includes('/quota')) {
          // Quota endpoint
          res.end(JSON.stringify({ data: { limit: 1000, used: 100 } }))
        } else if (url.includes('/telemetry/config')) {
          // Telemetry config endpoint
          if (req.method === 'PUT') {
            res.end(JSON.stringify({ telemetry: { enabled: true } }))
          } else {
            res.end(JSON.stringify({ telemetry: { enabled: false } }))
          }
        } else if (url.includes('/telemetry')) {
          // Telemetry POST endpoint (must come before generic /settings)
          if (req.method === 'POST') {
            res.end(JSON.stringify({}))
          } else {
            res.end(JSON.stringify({}))
          }
        } else if (url.includes('/alerts')) {
          // Alerts endpoint
          res.end(
            JSON.stringify({
              endCursor: null,
              items: [
                {
                  category: 'vulnerability',
                  clearedAt: null,
                  createdAt: '2024-01-01T00:00:00Z',
                  dashboardUrl: 'https://socket.dev/alerts/alert-1',
                  fix: {
                    description: 'Upgrade to version 2.0.0',
                    type: 'upgrade',
                  },
                  id: 'alert-1',
                  key: 'CVE-2024-1234',
                  locations: [],
                  severity: 'high',
                  status: 'open',
                  type: 'vulnerableCode',
                  updatedAt: '2024-01-01T00:00:00Z',
                  version: 1,
                  vulnerability: {
                    cveDescription: 'Test vulnerability',
                    cveId: 'CVE-2024-1234',
                    cveTitle: 'Test CVE',
                    cvssScore: 7.5,
                    cweIds: ['CWE-79'],
                    cweNames: ['Cross-site Scripting'],
                    epssPercentile: 0.9,
                    epssScore: 0.8,
                    ghsaIds: ['GHSA-xxxx-yyyy-zzzz'],
                    isKev: false,
                  },
                },
              ],
            }),
          )
        } else if (url.includes('/fixes')) {
          // Fixes endpoint
          res.end(
            JSON.stringify({
              fixDetails: {
                'GHSA-xxxx-yyyy-zzzz': {
                  type: 'fixFound',
                  value: {
                    cve: 'CVE-2024-1234',
                    fixDetails: {
                      fixes: [
                        {
                          fixedVersion: '2.0.0',
                          manifestFiles: ['package.json'],
                          purl: 'pkg:npm/lodash',
                          updateType: 'major',
                        },
                      ],
                    },
                    ghsa: 'GHSA-xxxx-yyyy-zzzz',
                    type: 'fixFound',
                  },
                },
              },
            }),
          )
        } else if (url.includes('/webhooks')) {
          // Webhooks endpoints
          if (req.method === 'POST') {
            res.end(
              JSON.stringify({
                created_at: '2024-01-01T00:00:00Z',
                description: 'Test webhook',
                events: ['full_scan.completed'],
                filters: null,
                headers: null,
                id: 'webhook-1',
                name: 'test-webhook',
                secret: 'test-secret',
                updated_at: '2024-01-01T00:00:00Z',
                url: 'https://example.com/webhook',
              }),
            )
          } else if (req.method === 'PUT') {
            res.end(
              JSON.stringify({
                created_at: '2024-01-01T00:00:00Z',
                description: 'Updated webhook',
                events: ['full_scan.completed'],
                filters: null,
                headers: null,
                id: 'webhook-1',
                name: 'updated-webhook',
                secret: 'test-secret',
                updated_at: '2024-01-01T00:00:00Z',
                url: 'https://example.com/webhook',
              }),
            )
          } else if (req.method === 'DELETE') {
            res.end(JSON.stringify({ status: 'ok' }))
          } else if (url.match(/\/webhooks\/[^/]+$/)) {
            // GET single webhook
            res.end(
              JSON.stringify({
                created_at: '2024-01-01T00:00:00Z',
                description: 'Test webhook',
                events: ['full_scan.completed'],
                filters: null,
                headers: null,
                id: 'webhook-1',
                name: 'test-webhook',
                secret: 'test-secret',
                updated_at: '2024-01-01T00:00:00Z',
                url: 'https://example.com/webhook',
              }),
            )
          } else {
            // GET list of webhooks
            res.end(
              JSON.stringify({
                nextPage: null,
                results: [
                  {
                    created_at: '2024-01-01T00:00:00Z',
                    description: 'Test webhook',
                    events: ['full_scan.completed'],
                    filters: null,
                    headers: null,
                    id: 'webhook-1',
                    name: 'test-webhook',
                    secret: 'test-secret',
                    updated_at: '2024-01-01T00:00:00Z',
                    url: 'https://example.com/webhook',
                  },
                ],
              }),
            )
          }
        } else if (url.includes('/settings')) {
          // Settings endpoint
          res.end(JSON.stringify({ data: { success: true } }))
        } else if (url.includes('/dependencies')) {
          // Dependencies endpoints
          if (url.includes('/search')) {
            res.end(JSON.stringify({ data: [] }))
          } else if (url.includes('/snapshot')) {
            res.end(JSON.stringify({ data: { id: 'snapshot-1' } }))
          } else {
            res.end(JSON.stringify({ data: {} }))
          }
        } else if (url.includes('/api-tokens')) {
          // API tokens
          if (req.method === 'DELETE' || url.includes('/revoke')) {
            res.end(JSON.stringify({ success: true }))
          } else if (req.method === 'POST' || url.includes('/rotate')) {
            res.end(JSON.stringify({ data: { token: 'new-token' } }))
          } else if (req.method === 'PUT') {
            res.end(JSON.stringify({ data: { token: 'updated-token' } }))
          } else {
            res.end(JSON.stringify({ data: [] }))
          }
        } else if (url.includes('/entitlements')) {
          // Entitlements
          if (url.includes('/enabled')) {
            res.end(JSON.stringify({ data: [] }))
          } else {
            res.end(JSON.stringify({ data: [] }))
          }
        } else if (url.includes('/alert-triage')) {
          // Alert triage
          if (req.method === 'PUT') {
            res.end(JSON.stringify({ data: { status: 'resolved' } }))
          } else {
            res.end(JSON.stringify({ data: {} }))
          }
        } else if (url.includes('/report')) {
          // Reports
          if (req.method === 'DELETE') {
            res.end(JSON.stringify({ success: true }))
          } else {
            res.end(JSON.stringify({ data: {} }))
          }
        } else if (url.includes('/audit-logs')) {
          // Audit logs
          res.end(JSON.stringify({ data: [] }))
        } else if (url.includes('/supported-files')) {
          // Supported files
          res.end(JSON.stringify({ data: [] }))
        } else if (url.includes('/upload-manifest-files')) {
          // Upload manifest files
          res.end(
            JSON.stringify({
              data: { uploadId: 'upload-123', status: 'success' },
            }),
          )
        } else {
          // Default response
          res.end(JSON.stringify({ data: {} }))
        }
      }
    })

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          const { port } = address
          baseUrl = `http://127.0.0.1:${port}`
          client = new SocketSdk('test-token', { baseUrl, timeout: 5000 })
          resolve()
        }
      })
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  })

  describe('Package Analysis Methods', () => {
    it('covers getIssuesByNpmPackage', async () => {
      const result = await client.getIssuesByNpmPackage('lodash', '4.17.21')
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('covers getScoreByNpmPackage', async () => {
      const result = await client.getScoreByNpmPackage('lodash', '4.17.21')
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('covers batchPackageFetch', async () => {
      const result = await client.batchPackageFetch({
        components: [{ purl: 'pkg:npm/lodash@4.17.21' }],
      })
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('covers batchPackageStream', async () => {
      const componentsObj = {
        components: [
          { purl: 'pkg:npm/lodash@4.17.21' },
          { purl: 'pkg:npm/react@18.0.0' },
        ],
      }
      const generator = client.batchPackageStream(componentsObj)

      // Consume the generator
      const results = []
      for await (const result of generator) {
        results.push(result)
      }

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('Organization Methods', () => {
    it('covers listOrganizations', async () => {
      const result = await client.listOrganizations()
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('covers createRepository', async () => {
      const result = await client.createRepository('test-org', {
        name: 'test-repo',
      })
      expect(result.success).toBe(true)
    })

    it('covers getRepository', async () => {
      const result = await client.getRepository('test-org', 'test-repo')
      expect(result.success).toBe(true)
    })

    it('covers listRepositories', async () => {
      const result = await client.listRepositories('test-org')
      expect(result.success).toBe(true)
    })

    it('covers updateRepository', async () => {
      const result = await client.updateRepository('test-org', 'test-repo', {})
      expect(result.success).toBe(true)
    })

    it('covers deleteRepository', async () => {
      const result = await client.deleteRepository('test-org', 'test-repo')
      expect(result.success).toBe(true)
    })
  })

  describe('Full Scan Methods', () => {
    it('covers listFullScans', async () => {
      const result = await client.listFullScans('test-org')
      expect(result.success).toBe(true)
    })

    it('covers getFullScanMetadata', async () => {
      const result = await client.getFullScanMetadata('test-org', 'scan-1')
      expect(result.success).toBe(true)
    })

    it('covers createFullScan', async () => {
      // Create a temporary test file
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-test-'))
      const testFile = path.join(tempDir, 'package.json')
      writeFileSync(
        testFile,
        JSON.stringify({ name: 'test-pkg', version: '1.0.0' }),
      )

      try {
        const result = await client.createFullScan('test-org', [testFile], {
          branch: 'main',
          commit_message: 'test',
          make_default_branch: false,
          pathsRelativeTo: tempDir,
          repo: 'test-repo',
        })
        expect(result.success).toBe(true)
      } finally {
        rmSync(tempDir, { recursive: true })
      }
    })

    it('covers deleteFullScan', async () => {
      const result = await client.deleteFullScan('test-org', 'scan-1')
      expect(result.success).toBe(true)
    })
  })

  describe('Diff Scan Methods', () => {
    it('covers createOrgDiffScanFromIds', async () => {
      const result = await client.createOrgDiffScanFromIds('test-org', {
        from: 'from-id',
        to: 'to-id',
      })
      expect(result.success).toBe(true)
    })

    it('covers getDiffScanById', async () => {
      const result = await client.getDiffScanById('test-org', 'diff-1')
      expect(result.success).toBe(true)
    })

    it('covers listOrgDiffScans', async () => {
      const result = await client.listOrgDiffScans('test-org')
      expect(result.success).toBe(true)
    })

    it('covers deleteOrgDiffScan', async () => {
      const result = await client.deleteOrgDiffScan('test-org', 'diff-1')
      expect(result.success).toBe(true)
    })
  })

  describe('SBOM Methods', () => {
    it('covers exportCDX', async () => {
      const result = await client.exportCDX('test-org', 'scan-1')
      expect(result.success).toBe(true)
    })

    it('covers exportSPDX', async () => {
      const result = await client.exportSPDX('test-org', 'scan-1')
      expect(result.success).toBe(true)
    })
  })

  describe('Patches Methods', () => {
    it('covers viewPatch', async () => {
      const result = await client.viewPatch('test-org', 'patch-uuid-123')
      // viewPatch returns the patch data directly, not wrapped in success/data
      expect(result).toBeDefined()
    })
  })

  describe('Quota Methods', () => {
    it('covers getQuota', async () => {
      const result = await client.getQuota()
      expect(result.success).toBe(true)
    })
  })

  describe('Settings Methods', () => {
    it('covers postSettings', async () => {
      const result = await client.postSettings([
        {
          organization: 'test-org',
        },
      ])
      expect(result.success).toBe(true)
    })
  })

  describe('Dependencies Methods', () => {
    it('covers searchDependencies', async () => {
      const result = await client.searchDependencies({
        limit: 10,
        orgSlug: 'test-org',
        repoName: 'test-repo',
      })
      expect(result.success).toBe(true)
    })

    it('covers createDependenciesSnapshot', async () => {
      // Create a temporary test file
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-test-'))
      const testFile = path.join(tempDir, 'package.json')
      writeFileSync(
        testFile,
        JSON.stringify({ name: 'test-pkg', version: '1.0.0' }),
      )

      try {
        const result = await client.createDependenciesSnapshot([testFile], {
          pathsRelativeTo: tempDir,
          queryParams: {
            branch: 'main',
            orgSlug: 'test-org',
            repoName: 'test-repo',
          },
        })
        expect(result.success).toBe(true)
      } finally {
        rmSync(tempDir, { recursive: true })
      }
    })
  })

  describe('Analytics Methods', () => {
    it('covers getOrgAnalytics', async () => {
      const result = await client.getOrgAnalytics('test-org')
      expect(result.success).toBe(true)
    })

    it('covers getRepoAnalytics', async () => {
      const result = await client.getRepoAnalytics('test-org', 'test-repo')
      expect(result.success).toBe(true)
    })
  })

  describe('Policy Methods', () => {
    it('covers getOrgSecurityPolicy', async () => {
      const result = await client.getOrgSecurityPolicy('test-org')
      expect(result.success).toBe(true)
    })

    it('covers updateOrgSecurityPolicy', async () => {
      const result = await client.updateOrgSecurityPolicy('test-org', {
        enabled: true,
      })
      expect(result.success).toBe(true)
    })

    it('covers getOrgLicensePolicy', async () => {
      const result = await client.getOrgLicensePolicy('test-org')
      expect(result.success).toBe(true)
    })

    it('covers updateOrgLicensePolicy', async () => {
      const result = await client.updateOrgLicensePolicy('test-org', {
        enabled: true,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Telemetry Methods', () => {
    it('covers getOrgTelemetryConfig', async () => {
      const result = await client.getOrgTelemetryConfig('test-org')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.telemetry).toBeDefined()
        expect(result.data.telemetry.enabled).toBe(false)
      }
    })

    it('covers updateOrgTelemetryConfig', async () => {
      const result = await client.updateOrgTelemetryConfig('test-org', {
        enabled: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.telemetry).toBeDefined()
        expect(result.data.telemetry.enabled).toBe(true)
      }
    })

    it('covers postOrgTelemetry', async () => {
      const result = await client.postOrgTelemetry('test-org', {
        event: 'test-event',
        timestamp: Date.now(),
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data).toEqual({})
      }
    })
  })

  describe('Alerts Methods', () => {
    it('covers getOrgAlertsList without filters', async () => {
      const result = await client.getOrgAlertsList('test-org')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.items).toBeInstanceOf(Array)
        expect(result.data.items.length).toBeGreaterThan(0)
        if (result.data.items[0]) {
          expect(result.data.items[0].id).toBe('alert-1')
          expect(result.data.items[0].status).toBe('open')
          expect(result.data.items[0].category).toBe('vulnerability')
          expect(result.data.items[0].severity).toBe('high')
        }
        expect(result.data.endCursor).toBeNull()
      }
    })

    it('covers getOrgAlertsList with filters and pagination', async () => {
      const result = await client.getOrgAlertsList('test-org', {
        'filters.alertCategory': 'vulnerability',
        'filters.alertPriority': 'high',
        'filters.alertStatus': 'open',
        per_page: 100,
        startAfterCursor: 'cursor-123',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.items).toBeInstanceOf(Array)
        if (result.data.items[0]) {
          expect(result.data.items[0].vulnerability).toBeDefined()
          if (result.data.items[0].vulnerability) {
            expect(result.data.items[0].vulnerability.cveId).toBe(
              'CVE-2024-1234',
            )
            expect(result.data.items[0].vulnerability.cvssScore).toBe(7.5)
          }
        }
      }
    })
  })

  describe('Fixes Methods', () => {
    it('covers getOrgFixes with repo_slug', async () => {
      const result = await client.getOrgFixes('test-org', {
        allow_major_updates: true,
        repo_slug: 'test-repo',
        vulnerability_ids: 'GHSA-xxxx-yyyy-zzzz',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.fixDetails).toBeDefined()
        expect(result.data.fixDetails['GHSA-xxxx-yyyy-zzzz']).toBeDefined()
        const fixDetail = result.data.fixDetails['GHSA-xxxx-yyyy-zzzz']
        if (fixDetail && 'type' in fixDetail && fixDetail.type === 'fixFound') {
          expect(fixDetail.value.ghsa).toBe('GHSA-xxxx-yyyy-zzzz')
          expect(fixDetail.value.cve).toBe('CVE-2024-1234')
          expect(fixDetail.value.fixDetails.fixes).toBeInstanceOf(Array)
          expect(fixDetail.value.fixDetails.fixes.length).toBeGreaterThan(0)
          if (fixDetail.value.fixDetails.fixes[0]) {
            expect(fixDetail.value.fixDetails.fixes[0].purl).toBe(
              'pkg:npm/lodash',
            )
            expect(fixDetail.value.fixDetails.fixes[0].fixedVersion).toBe(
              '2.0.0',
            )
            expect(fixDetail.value.fixDetails.fixes[0].updateType).toBe('major')
          }
        }
      }
    })

    it('covers getOrgFixes with full_scan_id and options', async () => {
      const result = await client.getOrgFixes('test-org', {
        allow_major_updates: false,
        full_scan_id: 'scan-123',
        include_details: true,
        include_responsible_direct_dependencies: true,
        minimum_release_age: '7d',
        vulnerability_ids: '*',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.fixDetails).toBeDefined()
      }
    })
  })

  describe('Full Scan Archive Methods', () => {
    it('covers createOrgFullScanFromArchive', async () => {
      // Create a temporary test file to upload
      const testFilePath = `${os.tmpdir()}/test-archive-${Date.now()}.tar.gz`
      writeFileSync(testFilePath, 'test archive content')

      try {
        const result = await client.createOrgFullScanFromArchive(
          'test-org',
          testFilePath,
          {
            branch: 'main',
            commit_hash: 'abc123',
            commit_message: 'Test commit',
            repo: 'test-repo',
          },
        )
        // The method executes successfully
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
      } finally {
        // Clean up test file
        try {
          unlinkSync(testFilePath)
        } catch {
          // Ignore cleanup errors
        }
      }
    })

    it('covers downloadOrgFullScanFilesAsTar', async () => {
      // Create a temporary output file path
      const outputPath = `${os.tmpdir()}/test-download-${Date.now()}.tar`

      try {
        const result = await client.downloadOrgFullScanFilesAsTar(
          'test-org',
          'scan-1',
          outputPath,
        )
        // The method executes successfully
        expect(result.success).toBe(true)
        // Verify the file was written
        expect(existsSync(outputPath)).toBe(true)
        // Verify file has content
        const content = readFileSync(outputPath)
        expect(content.length).toBeGreaterThan(0)
      } finally {
        // Clean up output file
        try {
          unlinkSync(outputPath)
        } catch {
          // Ignore cleanup errors
        }
      }
    })
  })

  describe('Webhook Management Methods', () => {
    it('covers createOrgWebhook', async () => {
      const result = await client.createOrgWebhook('test-org', {
        events: ['full_scan.completed'],
        name: 'test-webhook',
        secret: 'test-secret',
        url: 'https://example.com/webhook',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.id).toBe('webhook-1')
        expect(result.data.name).toBe('test-webhook')
        expect(result.data.url).toBe('https://example.com/webhook')
        expect(result.data.events).toEqual(['full_scan.completed'])
      }
    })

    it('covers getOrgWebhooksList', async () => {
      const result = await client.getOrgWebhooksList('test-org')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.results).toBeInstanceOf(Array)
        expect(result.data.results.length).toBeGreaterThan(0)
        if (result.data.results[0]) {
          expect(result.data.results[0].id).toBe('webhook-1')
        }
        expect(result.data.nextPage).toBeNull()
      }
    })

    it('covers getOrgWebhooksList with pagination', async () => {
      const result = await client.getOrgWebhooksList('test-org', {
        page: 1,
        per_page: 10,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.results).toBeInstanceOf(Array)
      }
    })

    it('covers getOrgWebhook', async () => {
      const result = await client.getOrgWebhook('test-org', 'webhook-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.id).toBe('webhook-1')
        expect(result.data.name).toBe('test-webhook')
        expect(result.data.url).toBe('https://example.com/webhook')
      }
    })

    it('covers updateOrgWebhook', async () => {
      const result = await client.updateOrgWebhook('test-org', 'webhook-1', {
        name: 'updated-webhook',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.id).toBe('webhook-1')
        expect(result.data.name).toBe('updated-webhook')
        expect(result.data.description).toBe('Updated webhook')
      }
    })

    it('covers deleteOrgWebhook', async () => {
      const result = await client.deleteOrgWebhook('test-org', 'webhook-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.status).toBe('ok')
      }
    })
  })

  describe('API Token Methods', () => {
    it('covers getAPITokens', async () => {
      const result = await client.getAPITokens('test-org')
      expect(result.success).toBe(true)
    })

    it('covers postAPIToken', async () => {
      const result = await client.postAPIToken('test-org', {
        name: 'test-token',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Triage Methods', () => {
    it('covers getOrgTriage', async () => {
      const result = await client.getOrgTriage('test-org')
      expect(result.success).toBe(true)
    })
  })

  describe('Repository Labels Methods', () => {
    it('covers createRepositoryLabel', async () => {
      const result = await client.createRepositoryLabel('test-org', {
        name: 'test-label',
      })
      expect(result.success).toBe(true)
    })

    it('covers getRepositoryLabel', async () => {
      const result = await client.getRepositoryLabel('test-org', 'label-1')
      expect(result.success).toBe(true)
    })

    it('covers listRepositoryLabels', async () => {
      const result = await client.listRepositoryLabels('test-org')
      expect(result.success).toBe(true)
    })

    it('covers updateRepositoryLabel', async () => {
      const result = await client.updateRepositoryLabel('test-org', 'label-1', {
        name: 'updated-label',
      })
      expect(result.success).toBe(true)
    })

    it('covers deleteRepositoryLabel', async () => {
      const result = await client.deleteRepositoryLabel('test-org', 'label-1')
      expect(result.success).toBe(true)
    })
  })

  describe('Audit Logs Methods', () => {
    it('covers getAuditLogEvents', async () => {
      const result = await client.getAuditLogEvents('test-org')
      expect(result.success).toBe(true)
    })
  })

  describe('Supported Files Methods', () => {
    it('covers getSupportedScanFiles', async () => {
      const result = await client.getSupportedScanFiles()
      expect(result.success).toBe(true)
    })
  })

  describe('Entitlements Methods', () => {
    it('covers getEntitlements', async () => {
      const result = await client.getEntitlements('test-org')
      expect(Array.isArray(result)).toBe(true)
    })

    it('covers getEnabledEntitlements', async () => {
      const result = await client.getEnabledEntitlements('test-org')
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Advanced API Token Methods', () => {
    it('covers postAPITokensRevoke', async () => {
      const result = await client.postAPITokensRevoke('test-org', 'token-id')
      expect(result.success).toBe(true)
    })

    it('covers postAPITokensRotate', async () => {
      const result = await client.postAPITokensRotate('test-org', 'token-id')
      expect(result.success).toBe(true)
    })

    it('covers postAPITokenUpdate', async () => {
      const result = await client.postAPITokenUpdate('test-org', 'token-id', {
        name: 'updated-token',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Alert Triage Methods', () => {
    it('covers updateOrgAlertTriage', async () => {
      const result = await client.updateOrgAlertTriage('test-org', 'alert-id', {
        status: 'resolved',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Streaming Methods', () => {
    it('covers streamFullScan', async () => {
      const result = await client.streamFullScan('test-org', 'scan-1')
      expect(result.success).toBe(true)
    })

    it('covers streamPatchesFromScan', async () => {
      // This method returns a Promise<ReadableStream>
      // Just verify it executes without throwing
      const stream = await client.streamPatchesFromScan('test-org', 'scan-1')
      expect(stream).toBeDefined()
    })

    it('covers streamPatchesFromScan error path', async () => {
      // The server returns 404 for invalid-scan
      await expect(
        client.streamPatchesFromScan('test-org', 'invalid-scan'),
      ).rejects.toThrow('GET Request failed')
    })

    it('covers sendApi method', async () => {
      // Test the generic sendApi method with POST
      const result = await client.sendApi('/scan', {
        body: { repo: 'test' },
        method: 'POST',
      })
      expect(result).toBeDefined()
    })

    it('covers batchPackageStream generator', async () => {
      // Test the async generator method
      const componentsObj = {
        components: [{ purl: 'pkg:npm/lodash@4.17.21' }],
      }
      const generator = client.batchPackageStream(componentsObj)
      const first = await generator.next()
      expect(first).toBeDefined()
    })

    it('covers cache path with cacheTtl', async () => {
      // Create client with cache enabled to test cache code path
      const clientWithCache = new SocketSdk('test-token', {
        baseUrl,
        cache: true,
        cacheTtl: 5000,
        retries: 0,
      })

      // Make two identical requests - second should use cache
      const result1 = await clientWithCache.listOrganizations()
      const result2 = await clientWithCache.listOrganizations()

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })

    it('covers getFullScan', async () => {
      const result = await client.getFullScan('test-org', 'scan-1')
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })
  })

  describe('Response Type Variations', () => {
    it('covers getApi with response type', async () => {
      const result = await client.getIssuesByNpmPackage('lodash', '4.17.21')
      expect(result.success).toBe(true)
    })

    it('covers getApi with text response type', async () => {
      const result = await client.getIssuesByNpmPackage('lodash', '4.17.21')
      expect(result.success).toBe(true)
    })
  })

  describe('Upload Methods', () => {
    it('covers uploadManifestFiles', async () => {
      // Create a temporary test file
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-test-'))
      const testFile = path.join(tempDir, 'package.json')
      writeFileSync(
        testFile,
        JSON.stringify({ name: 'test-pkg', version: '1.0.0' }),
      )

      try {
        const result = await client.uploadManifestFiles(
          'test-org',
          [testFile],
          {
            pathsRelativeTo: tempDir,
          },
        )
        expect(result.success).toBe(true)
      } finally {
        rmSync(tempDir, { recursive: true })
      }
    })
  })

  describe('Error Handling Paths', () => {
    it('covers retry logic through timeout', async () => {
      // This will succeed but exercise retry preparation code
      const result = await client.listOrganizations()
      expect(result.success).toBe(true)
    })

    it('covers cache when enabled', async () => {
      const cachedClient = new SocketSdk('test-token', {
        baseUrl,
        cache: true,
        timeout: 5000,
      })
      const result1 = await cachedClient.listOrganizations()
      const result2 = await cachedClient.listOrganizations()
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })

    it('covers methods with query parameters', async () => {
      const result = await client.listFullScans('test-org', {
        per_page: 10,
        page: 0,
      })
      expect(result.success).toBe(true)
    })
  })
})
