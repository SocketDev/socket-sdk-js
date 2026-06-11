/**
 * @file Coverage gap tests for SocketSdk fetch methods. Targets uncovered lines
 *   in socket-sdk-class.ts including:
 *
 *   - batchOrgPackageFetch success and NDJSON parsing (local HTTP server)
 *   - searchDependencies success path
 *   - viewPatch success path
 */

import { describe, expect, it } from 'vitest'

import { SocketSdk } from '../../src/index.mts'
import { setupLocalHttpServer } from '../utils/local-server-helpers.mts'

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
    if (!result.success) {
      return
    }
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
    if (!result.success) {
      return
    }
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
    if (!result.success) {
      return
    }
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
