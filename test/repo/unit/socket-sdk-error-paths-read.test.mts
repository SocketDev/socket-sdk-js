/**
 * @file Error path tests for SocketSdk read methods (Get and List). Each test
 *   triggers a 400 error response from a local HTTP server and asserts the
 *   method returns { success: false }. Uses setupLocalHttpServer from
 *   test/utils/local-server-helpers.mts with a handler that returns 400 for all
 *   requests, so every SDK method hits its catch block and exercises
 *   #handleApiError with a client error.
 */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { setupLocalHttpServer } from '../../utils/local-server-helpers.mts'

import type { IncomingMessage, ServerResponse } from 'node:http'

// ---------------------------------------------------------------------------
// Shared server: returns 400 JSON error for every request.
// ---------------------------------------------------------------------------
const getBaseUrl = setupLocalHttpServer(
  (req: IncomingMessage, res: ServerResponse) => {
    // Consume request body for POST/PUT/DELETE before responding.
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'Bad Request' } }))
    })
    // For GET/DELETE without body, 'end' fires immediately after headers.
    // Node will emit 'end' even if no body is sent, so this works for all methods.
  },
)

export function createClient(): SocketSdk {
  return new SocketSdk('test-token', {
    baseUrl: `${getBaseUrl()}/v0/`,
    retries: 0,
  })
}

// ---------------------------------------------------------------------------
// Helper: shape of an error result from methods that return { success: false }.
// Assertions live inline in each test case so they run as test assertions
// (socket/no-vitest-standalone-expect).
// ---------------------------------------------------------------------------
export interface ErrorResult {
  status?: number | undefined
  success: boolean
}

// ===========================================================================
// Get methods (simple org-scoped)
// ===========================================================================
describe('SocketSdk error paths - Get methods', () => {
  it('getAPITokens returns error on 400', async () => {
    const client = createClient()
    const result = await client.getAPITokens('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getAuditLogEvents returns error on 400', async () => {
    const client = createClient()
    const result = await client.getAuditLogEvents('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getDiffScanById returns error on 400', async () => {
    const client = createClient()
    const result = await client.getDiffScanById('test-org', 'diff-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getDiffScanGfm returns error on 400', async () => {
    const client = createClient()
    const result = await client.getDiffScanGfm('test-org', 'diff-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.getFullScan('test-org', 'scan-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getFullScanMetadata returns error on 400', async () => {
    const client = createClient()
    const result = await client.getFullScanMetadata('test-org', 'scan-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getIssuesByNpmPackage returns error on 400', async () => {
    const client = createClient()
    const result = await client.getIssuesByNpmPackage('lodash', '4.17.21')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgAlertFullScans returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgAlertFullScans('test-org', {
      alertKey: 'npm/lodash/cve-2021-23337',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgAlertsList returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgAlertsList('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgAnalytics returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgAnalytics('30d')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgFixes returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgFixes('test-org', {
      allow_major_updates: false,
      vulnerability_ids: 'CVE-2021-23337',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgLicensePolicy returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgLicensePolicy('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgSecurityPolicy returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgSecurityPolicy('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgTelemetryConfig returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgTelemetryConfig('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgTriage returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgTriage('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgWebhook returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgWebhook('test-org', 'webhook-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getOrgWebhooksList returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgWebhooksList('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getQuota returns error on 400', async () => {
    const client = createClient()
    const result = await client.getQuota()
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getRepoAnalytics returns error on 400', async () => {
    const client = createClient()
    const result = await client.getRepoAnalytics('test-org/test-repo', '30d')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getRepository returns error on 400', async () => {
    const client = createClient()
    const result = await client.getRepository('test-org', 'test-repo')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getRepositoryLabel returns error on 400', async () => {
    const client = createClient()
    const result = await client.getRepositoryLabel('test-org', 'label-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getScoreByNpmPackage returns error on 400', async () => {
    const client = createClient()
    const result = await client.getScoreByNpmPackage('lodash', '4.17.21')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('getSupportedFiles returns error on 400', async () => {
    const client = createClient()
    const result = await client.getSupportedFiles('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })
})

// ===========================================================================
// List methods
// ===========================================================================
describe('SocketSdk error paths - List methods', () => {
  it('listFullScans returns error on 400', async () => {
    const client = createClient()
    const result = await client.listFullScans('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('listOrganizations returns error on 400', async () => {
    const client = createClient()
    const result = await client.listOrganizations()
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('listOrgDiffScans returns error on 400', async () => {
    const client = createClient()
    const result = await client.listOrgDiffScans('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('listRepositories returns error on 400', async () => {
    const client = createClient()
    const result = await client.listRepositories('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('listRepositoryLabels returns error on 400', async () => {
    const client = createClient()
    const result = await client.listRepositoryLabels('test-org')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })
})
