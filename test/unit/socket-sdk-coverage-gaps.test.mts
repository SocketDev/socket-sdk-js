/**
 * @fileoverview Coverage gap tests for SocketSdk class methods.
 *
 * Targets uncovered lines in socket-sdk-class.ts including:
 * - batchOrgPackageFetch success and NDJSON parsing (local HTTP server)
 * - searchDependencies success path
 * - viewPatch success path
 * - File validation callback paths for createDependenciesSnapshot,
 *   createFullScan, and uploadManifestFiles
 * - getApi/sendApi with various response types and throws modes
 */

import { describe, expect, it, vi } from 'vitest'

import { MAX_FIREWALL_COMPONENTS } from '../../src/constants.js'
import { SocketSdk } from '../../src/index'
import { setupLocalHttpServer } from '../utils/local-server-helpers.mts'

import type { SocketSdkGenericResult } from '../../src/index'
import type { IncomingMessage, ServerResponse } from 'node:http'

// ---------------------------------------------------------------------------
// batchOrgPackageFetch (local HTTP server to avoid nock issues with raw HTTP)
// ---------------------------------------------------------------------------
describe('SocketSdk - batchOrgPackageFetch', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      // Consume POST body before responding
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        if (url.includes('/orgs/test-org/purl') && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })

          if (url.includes('compact=true')) {
            // Compact mode response
            const artifact = { name: 'lodash', type: 'npm', version: '4.17.21' }
            res.end(`${JSON.stringify(artifact)}\n`)
          } else if (url.includes('invalid-lines')) {
            // Response with empty and invalid lines
            const artifact = {
              name: 'lodash',
              type: 'npm',
              version: '4.17.21',
            }
            res.end(`\n${JSON.stringify(artifact)}\nnot-json\n\n`)
          } else {
            // Default multi-artifact response
            const artifact1 = {
              name: 'lodash',
              purl: 'pkg:npm/lodash@4.17.21',
              type: 'npm',
              version: '4.17.21',
            }
            const artifact2 = {
              name: 'express',
              purl: 'pkg:npm/express@4.19.2',
              type: 'npm',
              version: '4.19.2',
            }
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

  it('should parse NDJSON response and return artifacts', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.batchOrgPackageFetch('test-org', {
      components: [
        { purl: 'pkg:npm/lodash@4.17.21' },
        { purl: 'pkg:npm/express@4.19.2' },
      ],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toHaveLength(2)
  })

  it('should handle compact query parameter', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.batchOrgPackageFetch(
      'test-org',
      { components: [{ purl: 'pkg:npm/lodash@4.17.21' }] },
      { compact: 'true' },
    )

    expect(result.success).toBe(true)
  })

  it('should skip empty and invalid JSON lines in NDJSON', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.batchOrgPackageFetch(
      'test-org',
      { components: [{ purl: 'pkg:npm/lodash@4.17.21' }] },
      { 'invalid-lines': 'true' },
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    // Only the valid artifact line should be parsed
    expect(result.data).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// searchDependencies (local HTTP server)
// ---------------------------------------------------------------------------
describe('SocketSdk - searchDependencies', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      // Consume POST body
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        if (url.includes('/dependencies/search') && req.method === 'POST') {
          const searchResults = {
            rows: [{ name: 'lodash', version: '4.17.21' }],
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(searchResults))
        } else {
          res.writeHead(404)
          res.end()
        }
      })
    },
  )

  it('should search dependencies', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.searchDependencies({ q: 'lodash' })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual({
      rows: [{ name: 'lodash', version: '4.17.21' }],
    })
  })
})

// ---------------------------------------------------------------------------
// viewPatch (local HTTP server)
// ---------------------------------------------------------------------------
describe('SocketSdk - viewPatch', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/patches/view/patch-uuid-1')) {
        const patchData = {
          description: 'Fixes XSS vulnerability',
          files: {
            'index.js': {
              original: 'sha256-original',
              patched: 'sha256-patched',
              socketBlob: 'sha256-blob',
            },
          },
          license: 'MIT',
          publishedAt: '2024-01-01T00:00:00Z',
          purl: 'pkg:npm/vulnerable-lib@1.0.0',
          securityAlerts: [],
          tier: 'free',
          uuid: 'patch-uuid-1',
          vulnerabilities: [],
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(patchData))
      } else if (url.includes('/patches/view/bad-uuid')) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'Patch not found' } }))
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  it('should return patch view data on success', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.viewPatch('test-org', 'patch-uuid-1')

    expect(result.description).toBe('Fixes XSS vulnerability')
    expect(result.uuid).toBe('patch-uuid-1')
    expect(result.files).toBeDefined()
  })

  it('should throw on error with meaningful message', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    await expect(client.viewPatch('test-org', 'bad-uuid')).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// File validation callback paths
// ---------------------------------------------------------------------------
describe('SocketSdk - File validation callbacks', () => {
  describe('createDependenciesSnapshot', () => {
    it('should invoke onFileValidation callback when files are invalid', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
        errorMessage: 'Invalid files detected',
        errorCause: 'Files are unreadable',
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.createDependenciesSnapshot(
        ['/nonexistent/file1.json', '/nonexistent/file2.json'],
        { pathsRelativeTo: '/' },
      )

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toBe('Invalid files detected')
      expect(onFileValidation).toHaveBeenCalledOnce()
    })

    it('should continue when callback returns shouldContinue: true', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: true,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      // All invalid files + callback says continue => should fail with "no readable files"
      const result = await client.createDependenciesSnapshot(
        ['/nonexistent/file1.json'],
        { pathsRelativeTo: '/' },
      )

      // With all files invalid and callback continuing, it falls through to
      // the "all files invalid" check and returns an error.
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toBe('No readable manifest files found')
    })

    it('should use default error message when callback omits errorMessage', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.createDependenciesSnapshot(
        ['/nonexistent/file1.json'],
        { pathsRelativeTo: '/' },
      )

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toBe('File validation failed')
    })

    it('should warn and continue when no callback and files are invalid', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const client = new SocketSdk('test-token', { retries: 0 })

      const result = await client.createDependenciesSnapshot(
        ['/nonexistent/file1.json'],
        { pathsRelativeTo: '/' },
      )

      // Without callback, it warns and then hits "all files invalid"
      expect(warnSpy).toHaveBeenCalled()
      expect(result.success).toBe(false)
      warnSpy.mockRestore()
    })
  })

  describe('createFullScan', () => {
    it('should invoke onFileValidation callback when files are invalid', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
        errorMessage: 'Scan file validation failed',
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.createFullScan(
        'test-org',
        ['/nonexistent/package.json'],
        { repo: 'test-repo' },
      )

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toBe('Scan file validation failed')
      expect(onFileValidation).toHaveBeenCalledOnce()
      // Verify context includes orgSlug
      const callContext = onFileValidation.mock.calls[0]![2]
      expect(callContext.operation).toBe('createFullScan')
      expect(callContext.orgSlug).toBe('test-org')
    })

    it('should continue when callback returns shouldContinue: true', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: true,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.createFullScan(
        'test-org',
        ['/nonexistent/package.json'],
        { repo: 'test-repo' },
      )

      // All files invalid, callback says continue, hits "all files invalid" check
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toBe('No readable manifest files found')
    })

    it('should warn without callback when files are invalid', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const client = new SocketSdk('test-token', { retries: 0 })

      const result = await client.createFullScan(
        'test-org',
        ['/nonexistent/package.json'],
        { repo: 'test-repo' },
      )

      expect(warnSpy).toHaveBeenCalled()
      expect(result.success).toBe(false)
      warnSpy.mockRestore()
    })
  })

  describe('uploadManifestFiles', () => {
    it('should invoke onFileValidation callback when files are invalid', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
        errorMessage: 'Upload validation failed',
        errorCause: 'Unreadable manifest files',
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.uploadManifestFiles('test-org', [
        '/nonexistent/package.json',
      ])

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toBe('Upload validation failed')
      expect(onFileValidation).toHaveBeenCalledOnce()
      // Verify context includes orgSlug
      const callContext = onFileValidation.mock.calls[0]![2]
      expect(callContext.operation).toBe('uploadManifestFiles')
      expect(callContext.orgSlug).toBe('test-org')
    })

    it('should continue when callback returns shouldContinue: true', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: true,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.uploadManifestFiles('test-org', [
        '/nonexistent/package.json',
      ])

      // All files invalid, callback continues, hits "all files invalid" check
      expect(result.success).toBe(false)
    })

    it('should use default error message when callback omits errorMessage', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.uploadManifestFiles('test-org', [
        '/nonexistent/package.json',
      ])

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toBe('File validation failed')
    })

    it('should warn without callback when files are invalid and truncate display for many files', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const client = new SocketSdk('test-token', { retries: 0 })

      // Pass 5 invalid files to trigger the truncation (>3 triggers "... and N more")
      const result = await client.uploadManifestFiles('test-org', [
        '/nonexistent/a.json',
        '/nonexistent/b.json',
        '/nonexistent/c.json',
        '/nonexistent/d.json',
        '/nonexistent/e.json',
      ])

      expect(warnSpy).toHaveBeenCalled()
      const warnMsg = warnSpy.mock.calls[0]![0] as string
      expect(warnMsg).toContain('... and 2 more')
      expect(result.success).toBe(false)
      warnSpy.mockRestore()
    })
  })
})

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
    })) as SocketSdkGenericResult<IncomingMessage>

    expect(result.success).toBe(true)
    if (!result.success) return
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
    if (!result.success) return
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
    expect((result as IncomingMessage).statusCode).toBe(200)
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
    if (!result.success) return
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
    if (!result.success) return
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
    if (!result.success) return
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
    if (!result.success) return
    expect(result.data).toBeDefined()
  })

  it('should rescan a full scan', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.rescanFullScan('test-org', 'scan-123')

    expect(result.success).toBe(true)
    if (!result.success) return
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
    if (!result.success) return
    expect(result.data).toBeDefined()
  })
})
