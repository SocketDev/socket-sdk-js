/**
 * @file Error path tests for SocketSdk class methods (batch, create, delete,
 *   download/stream, export, post, rescan/search, update, upload, and throwing
 *   methods). Each test triggers a 400 error response from a local HTTP server
 *   and asserts the method returns { success: false }. Uses
 *   setupLocalHttpServer from test/utils/local-server-helpers.mts with a
 *   handler that returns 400 for all requests, so every SDK method hits its
 *   catch block and exercises #handleApiError with a client error. Get and List
 *   read-method error paths live in socket-sdk-error-paths-read.test.mts.
 */

import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { setupLocalHttpServer } from '../../utils/local-server-helpers.mts'

import type { IncomingMessage, ServerResponse } from 'node:http'

// A real file path we can use for upload-based methods.
const thisFile = fileURLToPath(import.meta.url)

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
// Batch methods
// ===========================================================================
describe('SocketSdk error paths - Batch methods', () => {
  it('batchOrgPackageFetch returns error on 400', async () => {
    const client = createClient()
    const result = await client.batchOrgPackageFetch('test-org', {
      components: [{ purl: 'pkg:npm/lodash@4.17.21' }],
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('batchPackageFetch returns error on 400', async () => {
    const client = createClient()
    const result = await client.batchPackageFetch({
      components: [{ purl: 'pkg:npm/lodash@4.17.21' }],
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
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
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('createFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.createFullScan('test-org', [thisFile], {
      repo: 'test-repo',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('createOrgDiffScanFromIds returns error on 400', async () => {
    const client = createClient()
    const result = await client.createOrgDiffScanFromIds('test-org', {
      after: 'scan-2',
      before: 'scan-1',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('createOrgFullScanFromArchive returns error on 400', async () => {
    const client = createClient()
    const result = await client.createOrgFullScanFromArchive(
      'test-org',
      thisFile,
      { repo: 'test-repo' },
    )
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('createOrgWebhook returns error on 400', async () => {
    const client = createClient()
    const result = await client.createOrgWebhook('test-org', {
      events: ['scan.complete'],
      name: 'test-webhook',
      secret: 'secret',
      url: 'https://example.com/webhook',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('createRepository returns error on 400', async () => {
    const client = createClient()
    const result = await client.createRepository('test-org', 'test-repo')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('createRepositoryLabel returns error on 400', async () => {
    const client = createClient()
    const result = await client.createRepositoryLabel('test-org', {
      name: 'test-label',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })
})

// ===========================================================================
// Delete methods
// ===========================================================================
describe('SocketSdk error paths - Delete methods', () => {
  it('deleteFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteFullScan('test-org', 'scan-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('deleteOrgDiffScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteOrgDiffScan('test-org', 'diff-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('deleteOrgWebhook returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteOrgWebhook('test-org', 'webhook-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('deleteRepository returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteRepository('test-org', 'test-repo')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('deleteRepositoryLabel returns error on 400', async () => {
    const client = createClient()
    const result = await client.deleteRepositoryLabel('test-org', 'label-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
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
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('streamFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.streamFullScan('test-org', 'scan-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })
})

// ===========================================================================
// Export methods
// ===========================================================================
describe('SocketSdk error paths - Export methods', () => {
  it('exportCDX returns error on 400', async () => {
    const client = createClient()
    const result = await client.exportCDX('test-org', 'scan-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('exportOpenVEX returns error on 400', async () => {
    const client = createClient()
    const result = await client.exportOpenVEX('test-org', 'scan-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('exportSPDX returns error on 400', async () => {
    const client = createClient()
    const result = await client.exportSPDX('test-org', 'scan-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
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
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('postAPITokensRevoke returns error on 400', async () => {
    const client = createClient()
    const result = await client.postAPITokensRevoke('test-org', 'token-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('postAPITokensRotate returns error on 400', async () => {
    const client = createClient()
    const result = await client.postAPITokensRotate('test-org', 'token-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('postAPITokenUpdate returns error on 400', async () => {
    const client = createClient()
    const result = await client.postAPITokenUpdate('test-org', 'token-123', {
      name: 'updated-name',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('postOrgTelemetry returns error on 400', async () => {
    const client = createClient()
    const result = await client.postOrgTelemetry('test-org', {
      events: [],
    } as Parameters<SocketSdk['postOrgTelemetry']>[1])
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('postSettings returns error on 400', async () => {
    const client = createClient()
    const result = await client.postSettings([{ organization: 'test-org' }])
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })
})

// ===========================================================================
// Rescan and search
// ===========================================================================
describe('SocketSdk error paths - Rescan and search', () => {
  it('rescanFullScan returns error on 400', async () => {
    const client = createClient()
    const result = await client.rescanFullScan('test-org', 'scan-123')
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('searchDependencies returns error on 400', async () => {
    const client = createClient()
    const result = await client.searchDependencies({ q: 'lodash' })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
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
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('updateOrgLicensePolicy returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateOrgLicensePolicy('test-org', {
      policy: 'strict',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('updateOrgSecurityPolicy returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateOrgSecurityPolicy('test-org', {
      policy: 'strict',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('updateOrgTelemetryConfig returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateOrgTelemetryConfig('test-org', {
      enabled: true,
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('updateOrgWebhook returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateOrgWebhook('test-org', 'webhook-123', {
      name: 'updated-webhook',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('updateRepository returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateRepository('test-org', 'test-repo', {
      description: 'updated',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
  })

  it('updateRepositoryLabel returns error on 400', async () => {
    const client = createClient()
    const result = await client.updateRepositoryLabel('test-org', 'label-123', {
      name: 'updated-label',
    })
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
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
    expect(result.success).toBe(false)
    expect((result as ErrorResult).status).toBe(400)
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
