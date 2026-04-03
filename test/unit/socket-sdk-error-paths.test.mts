/**
 * @fileoverview Error path tests for SocketSdk class methods.
 *
 * Covers ~58 catch blocks in socket-sdk-class.ts that call #handleApiError.
 * Each test triggers a 400 error response from a local HTTP server and asserts
 * the method returns { success: false }.
 *
 * Uses setupLocalHttpServer from test/utils/local-server-helpers.mts with a
 * handler that returns 400 for all requests, so every SDK method hits its
 * catch block and exercises #handleApiError with a client error.
 */

import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index'
import { setupLocalHttpServer } from '../utils/local-server-helpers.mts'

import type { IncomingMessage, ServerResponse } from 'node:http'

// A real file path we can use for upload-based methods.
const thisFile = fileURLToPath(import.meta.url)

// ---------------------------------------------------------------------------
// Shared server: returns 400 JSON error for every request.
// ---------------------------------------------------------------------------
const getBaseUrl = setupLocalHttpServer(
  (req: IncomingMessage, res: ServerResponse) => {
    // Consume request body for POST/PUT/DELETE before responding.
    let _body = ''
    req.on('data', (chunk: Buffer) => {
      _body += chunk.toString()
    })
    req.on('end', () => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'Bad Request' } }))
    })
    // For GET/DELETE without body, 'end' fires immediately after headers.
    // Node will emit 'end' even if no body is sent, so this works for all methods.
  },
)

function createClient(): SocketSdk {
  return new SocketSdk('test-token', {
    baseUrl: `${getBaseUrl()}/v0/`,
    retries: 0,
  })
}

// ---------------------------------------------------------------------------
// Helper: assert an error result from methods that return { success: false }.
// ---------------------------------------------------------------------------
function expectErrorResult(result: {
  status?: number
  success: boolean
}): void {
  expect(result.success).toBe(false)
  expect(result.status).toBe(400)
}

// ===========================================================================
// Batch methods
// ===========================================================================
describe('SocketSdk error paths - Batch methods', () => {
  it('batchOrgPackageFetch returns error on 400', async () => {
    const client = createClient()
    const result = await client.batchOrgPackageFetch('test-org', {
      components: [{ purl: 'pkg:npm/lodash@4.17.21' }],
    })
    expectErrorResult(result)
  })

  it('batchPackageFetch returns error on 400', async () => {
    const client = createClient()
    const result = await client.batchPackageFetch({
      components: [{ purl: 'pkg:npm/lodash@4.17.21' }],
    })
    expectErrorResult(result)
  })
})

// ===========================================================================
// Create methods
// ===========================================================================
describe('SocketSdk error paths - Create methods', () => {
  it('createDependenciesSnapshot returns error on 400', async () => {
    const client = createClient()
    const result = await client.createDependenciesSnapshot([thisFile], {
      pathsRelativeTo: '/',
    })
    expectErrorResult(result)
  })

  it('createFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.createFullScan('test-org', [thisFile], {
      repo: 'test-repo',
    })
    expectErrorResult(result)
  })

  it('createOrgDiffScanFromIds returns error on 400', async () => {
    const client = createClient()
    const result = await client.createOrgDiffScanFromIds('test-org', {
      after: 'scan-2',
      before: 'scan-1',
    })
    expectErrorResult(result)
  })

  it('createOrgFullScanFromArchive returns error on 400', async () => {
    const client = createClient()
    const result = await client.createOrgFullScanFromArchive(
      'test-org',
      thisFile,
      { repo: 'test-repo' },
    )
    expectErrorResult(result)
  })

  it('createOrgWebhook returns error on 400', async () => {
    const client = createClient()
    const result = await client.createOrgWebhook('test-org', {
      events: ['scan.complete'],
      name: 'test-webhook',
      secret: 'secret',
      url: 'https://example.com/webhook',
    })
    expectErrorResult(result)
  })

  it('createRepository returns error on 400', async () => {
    const client = createClient()
    const result = await client.createRepository('test-org', 'test-repo')
    expectErrorResult(result)
  })

  it('createRepositoryLabel returns error on 400', async () => {
    const client = createClient()
    const result = await client.createRepositoryLabel('test-org', {
      name: 'test-label',
    })
    expectErrorResult(result)
  })
})

// ===========================================================================
// Delete methods
// ===========================================================================
describe('SocketSdk error paths - Delete methods', () => {
  it('deleteFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteFullScan('test-org', 'scan-123')
    expectErrorResult(result)
  })

  it('deleteOrgDiffScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteOrgDiffScan('test-org', 'diff-123')
    expectErrorResult(result)
  })

  it('deleteOrgWebhook returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteOrgWebhook('test-org', 'webhook-123')
    expectErrorResult(result)
  })

  it('deleteRepository returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteRepository('test-org', 'test-repo')
    expectErrorResult(result)
  })

  it('deleteRepositoryLabel returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteRepositoryLabel('test-org', 'label-123')
    expectErrorResult(result)
  })
})

// ===========================================================================
// Download / Stream methods
// ===========================================================================
describe('SocketSdk error paths - Download and stream methods', () => {
  it('downloadOrgFullScanFilesAsTar returns error on 400', async () => {
    const client = createClient()
    const result = await client.downloadOrgFullScanFilesAsTar(
      'test-org',
      'scan-123',
      path.join(os.tmpdir(), 'test-output.tar'),
    )
    expectErrorResult(result)
  })

  it('streamFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.streamFullScan('test-org', 'scan-123')
    expectErrorResult(result)
  })
})

// ===========================================================================
// Export methods
// ===========================================================================
describe('SocketSdk error paths - Export methods', () => {
  it('exportCDX returns error on 400', async () => {
    const client = createClient()
    const result = await client.exportCDX('test-org', 'scan-123')
    expectErrorResult(result)
  })

  it('exportOpenVEX returns error on 400', async () => {
    const client = createClient()
    const result = await client.exportOpenVEX('test-org', 'scan-123')
    expectErrorResult(result)
  })

  it('exportSPDX returns error on 400', async () => {
    const client = createClient()
    const result = await client.exportSPDX('test-org', 'scan-123')
    expectErrorResult(result)
  })
})

// ===========================================================================
// Get methods (simple org-scoped)
// ===========================================================================
describe('SocketSdk error paths - Get methods', () => {
  it('getAPITokens returns error on 400', async () => {
    const client = createClient()
    const result = await client.getAPITokens('test-org')
    expectErrorResult(result)
  })

  it('getAuditLogEvents returns error on 400', async () => {
    const client = createClient()
    const result = await client.getAuditLogEvents('test-org')
    expectErrorResult(result)
  })

  it('getDiffScanById returns error on 400', async () => {
    const client = createClient()
    const result = await client.getDiffScanById('test-org', 'diff-123')
    expectErrorResult(result)
  })

  it('getDiffScanGfm returns error on 400', async () => {
    const client = createClient()
    const result = await client.getDiffScanGfm('test-org', 'diff-123')
    expectErrorResult(result)
  })

  it('getFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.getFullScan('test-org', 'scan-123')
    expectErrorResult(result)
  })

  it('getFullScanMetadata returns error on 400', async () => {
    const client = createClient()
    const result = await client.getFullScanMetadata('test-org', 'scan-123')
    expectErrorResult(result)
  })

  it('getIssuesByNpmPackage returns error on 400', async () => {
    const client = createClient()
    const result = await client.getIssuesByNpmPackage('lodash', '4.17.21')
    expectErrorResult(result)
  })

  it('getOrgAlertFullScans returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgAlertFullScans('test-org', {
      alertKey: 'npm/lodash/cve-2021-23337',
    })
    expectErrorResult(result)
  })

  it('getOrgAlertsList returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgAlertsList('test-org')
    expectErrorResult(result)
  })

  it('getOrgAnalytics returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgAnalytics('30d')
    expectErrorResult(result)
  })

  it('getOrgFixes returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgFixes('test-org', {
      allow_major_updates: false,
      vulnerability_ids: 'CVE-2021-23337',
    })
    expectErrorResult(result)
  })

  it('getOrgLicensePolicy returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgLicensePolicy('test-org')
    expectErrorResult(result)
  })

  it('getOrgSecurityPolicy returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgSecurityPolicy('test-org')
    expectErrorResult(result)
  })

  it('getOrgTelemetryConfig returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgTelemetryConfig('test-org')
    expectErrorResult(result)
  })

  it('getOrgTriage returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgTriage('test-org')
    expectErrorResult(result)
  })

  it('getOrgWebhook returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgWebhook('test-org', 'webhook-123')
    expectErrorResult(result)
  })

  it('getOrgWebhooksList returns error on 400', async () => {
    const client = createClient()
    const result = await client.getOrgWebhooksList('test-org')
    expectErrorResult(result)
  })

  it('getQuota returns error on 400', async () => {
    const client = createClient()
    const result = await client.getQuota()
    expectErrorResult(result)
  })

  it('getRepoAnalytics returns error on 400', async () => {
    const client = createClient()
    const result = await client.getRepoAnalytics('test-org/test-repo', '30d')
    expectErrorResult(result)
  })

  it('getRepository returns error on 400', async () => {
    const client = createClient()
    const result = await client.getRepository('test-org', 'test-repo')
    expectErrorResult(result)
  })

  it('getRepositoryLabel returns error on 400', async () => {
    const client = createClient()
    const result = await client.getRepositoryLabel('test-org', 'label-123')
    expectErrorResult(result)
  })

  it('getScoreByNpmPackage returns error on 400', async () => {
    const client = createClient()
    const result = await client.getScoreByNpmPackage('lodash', '4.17.21')
    expectErrorResult(result)
  })

  it('getSupportedFiles returns error on 400', async () => {
    const client = createClient()
    const result = await client.getSupportedFiles('test-org')
    expectErrorResult(result)
  })

  it('getSupportedScanFiles returns error on 400', async () => {
    const client = createClient()
    const result = await client.getSupportedScanFiles()
    expectErrorResult(result)
  })
})

// ===========================================================================
// List methods
// ===========================================================================
describe('SocketSdk error paths - List methods', () => {
  it('listFullScans returns error on 400', async () => {
    const client = createClient()
    const result = await client.listFullScans('test-org')
    expectErrorResult(result)
  })

  it('listOrganizations returns error on 400', async () => {
    const client = createClient()
    const result = await client.listOrganizations()
    expectErrorResult(result)
  })

  it('listOrgDiffScans returns error on 400', async () => {
    const client = createClient()
    const result = await client.listOrgDiffScans('test-org')
    expectErrorResult(result)
  })

  it('listRepositories returns error on 400', async () => {
    const client = createClient()
    const result = await client.listRepositories('test-org')
    expectErrorResult(result)
  })

  it('listRepositoryLabels returns error on 400', async () => {
    const client = createClient()
    const result = await client.listRepositoryLabels('test-org')
    expectErrorResult(result)
  })
})

// ===========================================================================
// Post methods (tokens, telemetry, settings)
// ===========================================================================
describe('SocketSdk error paths - Post methods', () => {
  it('postAPIToken returns error on 400', async () => {
    const client = createClient()
    const result = await client.postAPIToken('test-org', {
      name: 'test-token',
    })
    expectErrorResult(result)
  })

  it('postAPITokensRevoke returns error on 400', async () => {
    const client = createClient()
    const result = await client.postAPITokensRevoke('test-org', 'token-123')
    expectErrorResult(result)
  })

  it('postAPITokensRotate returns error on 400', async () => {
    const client = createClient()
    const result = await client.postAPITokensRotate('test-org', 'token-123')
    expectErrorResult(result)
  })

  it('postAPITokenUpdate returns error on 400', async () => {
    const client = createClient()
    const result = await client.postAPITokenUpdate('test-org', 'token-123', {
      name: 'updated-name',
    })
    expectErrorResult(result)
  })

  it('postOrgTelemetry returns error on 400', async () => {
    const client = createClient()
    const result = await client.postOrgTelemetry('test-org', {
      events: [],
    } as Parameters<SocketSdk['postOrgTelemetry']>[1])
    expectErrorResult(result)
  })

  it('postSettings returns error on 400', async () => {
    const client = createClient()
    const result = await client.postSettings([{ organization: 'test-org' }])
    expectErrorResult(result)
  })
})

// ===========================================================================
// Rescan and search
// ===========================================================================
describe('SocketSdk error paths - Rescan and search', () => {
  it('rescanFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.rescanFullScan('test-org', 'scan-123')
    expectErrorResult(result)
  })

  it('searchDependencies returns error on 400', async () => {
    const client = createClient()
    const result = await client.searchDependencies({ q: 'lodash' })
    expectErrorResult(result)
  })
})

// ===========================================================================
// Update methods
// ===========================================================================
describe('SocketSdk error paths - Update methods', () => {
  it('updateOrgAlertTriage returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateOrgAlertTriage('test-org', 'alert-123', {
      status: 'resolved',
    })
    expectErrorResult(result)
  })

  it('updateOrgLicensePolicy returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateOrgLicensePolicy('test-org', {
      policy: 'strict',
    })
    expectErrorResult(result)
  })

  it('updateOrgSecurityPolicy returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateOrgSecurityPolicy('test-org', {
      policy: 'strict',
    })
    expectErrorResult(result)
  })

  it('updateOrgTelemetryConfig returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateOrgTelemetryConfig('test-org', {
      enabled: true,
    })
    expectErrorResult(result)
  })

  it('updateOrgWebhook returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateOrgWebhook('test-org', 'webhook-123', {
      name: 'updated-webhook',
    })
    expectErrorResult(result)
  })

  it('updateRepository returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateRepository('test-org', 'test-repo', {
      description: 'updated',
    })
    expectErrorResult(result)
  })

  it('updateRepositoryLabel returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateRepositoryLabel('test-org', 'label-123', {
      name: 'updated-label',
    })
    expectErrorResult(result)
  })
})

// ===========================================================================
// Upload methods
// ===========================================================================
describe('SocketSdk error paths - Upload methods', () => {
  it('uploadManifestFiles returns error on 400', async () => {
    const client = createClient()
    const result = await client.uploadManifestFiles('test-org', [thisFile], {
      pathsRelativeTo: '/',
    })
    expectErrorResult(result)
  })
})

// ===========================================================================
// Methods that throw on error (viewPatch)
// ===========================================================================
describe('SocketSdk error paths - Throwing methods', () => {
  it('viewPatch throws on 400', async () => {
    const client = createClient()
    await expect(client.viewPatch('test-org', 'patch-uuid')).rejects.toThrow()
  })
})
