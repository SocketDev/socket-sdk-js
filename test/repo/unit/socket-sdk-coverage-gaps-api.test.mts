/**
 * @file Coverage gap tests for SocketSdk class API methods. Targets uncovered
 *   lines in socket-sdk-class.ts including:
 *
 *   - getApi response type handling (#handleQueryResponseData)
 *   - sendApi additional paths
 *   - checkMalware batch path (multiple components, empty list, error forwarding)
 *   - additional method success paths (exportOpenVEX, rescanFullScan,
 *     getEnabledEntitlements, getOrgAlertFullScans)
 */

import { describe, expect, it } from 'vitest'

import { MAX_FIREWALL_COMPONENTS } from '../../../src/constants.mts'
import { SocketSdk } from '../../../src/index.mts'
import { setupLocalHttpServer } from '../../utils/local-server-helpers.mts'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'
import type { SocketSdkGenericResult } from '../../../src/index.mts'
import type { IncomingMessage, ServerResponse } from 'node:http'

// ---------------------------------------------------------------------------
// getApi with different response types (covers #handleQueryResponseData)
// ---------------------------------------------------------------------------
describe('SocketSdk - getApi response type handling', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/raw-endpoint')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('raw data')
      } else if (url.includes('/text-endpoint')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('Hello, text!')
      } else if (url.includes('/json-endpoint')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ key: 'value', count: 42 }))
      } else if (url.includes('/text-nothrow')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('some text data')
      } else if (url.includes('/default-endpoint')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('data')
      } else if (url.includes('/large-text')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('x'.repeat(10_000))
      } else if (url.includes('/utf8-text')) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Hello 世界 Мир 🌍')
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  it('should return raw response when responseType is "response" and throws=false', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = (await client.getApi('raw-endpoint', {
      responseType: 'response',
      throws: false,
    })) as SocketSdkGenericResult<HttpResponse>

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data).toBeDefined()
    expect(result.status).toBe(200)
  })

  it('should return text when responseType is "text" and throws=true', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.getApi<string>('text-endpoint', {
      responseType: 'text',
    })

    expect(result).toBe('Hello, text!')
  })

  it('should return JSON when responseType is "json" and throws=true', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.getApi<{ count: number; key: string }>(
      'json-endpoint',
      { responseType: 'json' },
    )

    expect(result).toEqual({ key: 'value', count: 42 })
  })

  it('should return text in non-throwing mode with status', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = (await client.getApi<string>('text-nothrow', {
      responseType: 'text',
      throws: false,
    })) as SocketSdkGenericResult<string>

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data).toBe('some text data')
    expect(result.status).toBe(200)
  })

  it('should handle default responseType (response) without options', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.getApi('default-endpoint')
    expect(result).toBeDefined()
    expect((result as HttpResponse).status).toBe(200)
  })

  it('should handle large text responses within limit', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.getApi<string>('large-text', {
      responseType: 'text',
    })

    expect(result).toBe('x'.repeat(10_000))
  })

  it('should handle multi-byte UTF-8 text', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.getApi<string>('utf8-text', {
      responseType: 'text',
    })

    expect(result).toBe('Hello 世界 Мир 🌍')
  })
})

// ---------------------------------------------------------------------------
// sendApi additional coverage (local HTTP server)
// ---------------------------------------------------------------------------
describe('SocketSdk - sendApi additional paths', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      // Consume POST/PUT body
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        if (url.includes('/items') && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ id: 1, status: 'created' }))
        } else if (url.includes('/bad-items') && req.method === 'POST') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'Bad request' } }))
        } else {
          res.writeHead(404)
          res.end()
        }
      })
    },
  )

  it('should send POST with default method when not specified', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.sendApi<{ id: number; status: string }>(
      'items',
      { body: { name: 'test' } },
    )

    expect(result).toEqual({ id: 1, status: 'created' })
  })

  it('should return success result in non-throwing mode', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = (await client.sendApi<{ id: number; status: string }>(
      'items',
      {
        body: { name: 'test' },
        throws: false,
      },
    )) as SocketSdkGenericResult<{ id: number; status: string }>

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data).toEqual({ id: 1, status: 'created' })
    expect(result.status).toBe(200)
  })

  it('should throw on error when throws=true (default)', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    await expect(
      client.sendApi('bad-items', { body: { bad: true } }),
    ).rejects.toThrow()
  })

  it('should return error result in non-throwing mode on failure', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = (await client.sendApi('bad-items', {
      body: {},
      throws: false,
    })) as SocketSdkGenericResult<unknown>

    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checkMalware batch path (multiple components) - additional coverage
// ---------------------------------------------------------------------------
describe('SocketSdk - checkMalware batch path additional', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      // Consume POST body
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        if (url.includes('/purl') && req.method === 'POST') {
          // Parse request body to determine response
          const parsed = JSON.parse(body)
          const purls = (parsed.components || []).map(
            (c: { purl: string }) => c.purl,
          )

          if (purls.includes('pkg:npm/nonexistent@0.0.0')) {
            // Empty response
            res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
            res.end('\n')
          } else {
            // Multi-artifact response
            const artifact1 = {
              alerts: [
                {
                  key: 'cve-1',
                  severity: 'high',
                  type: 'criticalCVE',
                },
              ],
              name: 'pkg-a',
              type: 'npm',
              version: '1.0.0',
            }
            const artifact2 = {
              alerts: [],
              name: 'pkg-b',
              type: 'npm',
              version: '2.0.0',
            }
            res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
            res.end(
              `${JSON.stringify(artifact1)}\n${JSON.stringify(artifact2)}\n`,
            )
          }
        } else {
          res.writeHead(404)
          res.end()
        }
      })
    },
  )

  it('should handle empty artifact list from batch API', async () => {
    const count = MAX_FIREWALL_COMPONENTS + 1
    const client = new SocketSdk('test-api-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const components = Array.from({ length: count }, (_, i) => ({
      purl: `pkg:npm/nonexistent@0.0.${i}`,
    }))
    const result = await client.checkMalware(components)

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data).toEqual([])
  })

  it('should normalize multiple artifacts from batch response', async () => {
    const count = MAX_FIREWALL_COMPONENTS + 1
    const client = new SocketSdk('test-api-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const components = Array.from({ length: count }, (_, i) => ({
      purl: `pkg:npm/pkg-${String.fromCharCode(97 + i)}@${i + 1}.0.0`,
    }))
    const result = await client.checkMalware(components)

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    // Server returns 2 artifacts for non-nonexistent purls
    expect(result.data).toHaveLength(2)
    // criticalCVE is 'warn' in publicPolicy, so it should be included
    expect(result.data[0]!.alerts).toHaveLength(1)
    expect(result.data[0]!.alerts[0]!.type).toBe('criticalCVE')
    expect(result.data[1]!.alerts).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// checkMalwareBatch error forwarding
// ---------------------------------------------------------------------------
describe('SocketSdk - checkMalware batch error forwarding', () => {
  const getBaseUrl = setupLocalHttpServer(
    (_req: IncomingMessage, res: ServerResponse) => {
      // Return 401 for all requests to trigger batchPackageFetch error
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'Unauthorized' } }))
    },
  )

  it('should forward batchPackageFetch error from checkMalwareBatch', async () => {
    const count = MAX_FIREWALL_COMPONENTS + 1
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const components = Array.from({ length: count }, (_, i) => ({
      purl: `pkg:npm/lodash@4.17.${i}`,
    }))
    const result = await client.checkMalware(components)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
    }
  })
})

// ---------------------------------------------------------------------------
// Additional method success paths (prevent coverage regression)
// ---------------------------------------------------------------------------
describe('SocketSdk - additional method coverage', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        if (url.includes('/export/openvex/')) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ document: { '@context': 'openvex' } }))
        } else if (
          url.includes('/full-scans/') &&
          url.includes('/rescan') &&
          req.method === 'POST'
        ) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ id: 'scan-456', status: 'pending' }))
        } else if (url.includes('/entitlements')) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              items: [
                { enabled: true, key: 'feature-a' },
                { enabled: false, key: 'feature-b' },
                { enabled: true, key: 'feature-c' },
                { enabled: true, key: '' },
              ],
            }),
          )
        } else if (url.includes('/alert-full-scan-search')) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ results: [{ id: 'alert-1' }] }))
        } else {
          res.writeHead(404)
          res.end()
        }
      })
    },
  )

  it('should export OpenVEX successfully', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.exportOpenVEX('test-org', 'vex-123')

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data).toBeDefined()
  })

  it('should rescan a full scan', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.rescanFullScan('test-org', 'scan-123')

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data).toBeDefined()
  })

  it('should get enabled entitlements filtered', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.getEnabledEntitlements('test-org')

    expect(result).toEqual(['feature-a', 'feature-c'])
  })

  it('should get full scan alerts', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.getOrgAlertFullScans('test-org', {
      alertKey: 'malware',
    })

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data).toBeDefined()
  })
})
