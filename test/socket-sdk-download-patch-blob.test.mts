/**
 * @fileoverview Tests for downloadPatch method using local HTTP server.
 *
 * This test suite validates the downloadPatch method which downloads
 * patch files from the public Socket blob store.
 */
import { createServer } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

import type { IncomingMessage, Server, ServerResponse } from 'node:http'

describe('SocketSdk - downloadPatch', () => {
  let server: Server
  let baseUrl: string
  let client: SocketSdk

  beforeAll(async () => {
    // Start local HTTP server on random port.
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      // Handle blob download requests.
      if (url.startsWith('/blob/')) {
        const hash = decodeURIComponent(url.replace('/blob/', ''))

        // Mock different scenarios based on hash.
        if (hash === 'sha256-notfound') {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not Found')
        } else if (hash === 'sha256-servererror') {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Internal Server Error')
        } else if (hash === 'sha256-forbidden') {
          res.writeHead(403, { 'Content-Type': 'text/plain' })
          res.end('Forbidden')
        } else if (hash === 'sha256-dmgqn8O75il1F24lQfOagWiHfYKNXK2LVkYfw2rCuFY=') {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('console.log("patched code")')
        } else if (hash === '76682a9fc3bbe62975176e2541f39a8168877d828d5cad8b56461fc36ac2b856') {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('module.exports = {}')
        } else if (hash === 'sha256-largefile') {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('x'.repeat(1000000))
        } else if (hash === 'sha256-emptyfile') {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('')
        } else if (hash === 'sha256-utf8content') {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('// Comment: Привет мир 你好世界 🎉')
        } else if (hash === 'sha256-abc+def/ghi=') {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('content')
        } else if (hash === 'sha256-responseerror') {
          // Simulate response error after headers.
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.write('partial')
          // Destroy the response stream to trigger error event.
          res.destroy(new Error('Simulated response error'))
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('mock content')
        }
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        const addr = server.address()
        const port = typeof addr === 'object' ? addr?.port : 0
        baseUrl = `http://localhost:${port}`
        resolve()
      })
    })

    // Create client pointing to local server.
    client = new SocketSdk('test-token', { baseUrl })
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(err => {
        if (err) {reject(err)}
        else {resolve()}
      })
    })
  })

  it('should download patch with SSRI hash format', async () => {
    const mockContent = 'console.log("patched code")'
    const ssriHash = 'sha256-dmgqn8O75il1F24lQfOagWiHfYKNXK2LVkYfw2rCuFY='

    const result = await client.downloadPatch(ssriHash, { baseUrl })

    expect(result).toBe(mockContent)
  })

  it('should download patch with hex hash format', async () => {
    const mockContent = 'module.exports = {}'
    const hexHash =
      '76682a9fc3bbe62975176e2541f39a8168877d828d5cad8b56461fc36ac2b856'

    const result = await client.downloadPatch(hexHash, { baseUrl })

    expect(result).toBe(mockContent)
  })

  it('should throw error when patch not found (404)', async () => {
    const hash = 'sha256-notfound'

    await expect(client.downloadPatch(hash, { baseUrl })).rejects.toThrow(
      'Blob not found: sha256-notfound',
    )
  })

  it('should throw error when server returns 500', async () => {
    const hash = 'sha256-servererror'

    await expect(client.downloadPatch(hash, { baseUrl })).rejects.toThrow(
      'Failed to download blob: 500',
    )
  })

  it('should throw error when server returns 403', async () => {
    const hash = 'sha256-forbidden'

    await expect(client.downloadPatch(hash, { baseUrl })).rejects.toThrow(
      'Failed to download blob: 403',
    )
  })

  it('should properly encode special characters in hash', async () => {
    const hashWithSpecialChars = 'sha256-abc+def/ghi='

    const result = await client.downloadPatch(hashWithSpecialChars, { baseUrl })

    expect(result).toBe('content')
  })

  it('should download large patch content', async () => {
    const hash = 'sha256-largefile'

    const result = await client.downloadPatch(hash, { baseUrl })

    expect(result.length).toBe(1000000)
    expect(result).toBe('x'.repeat(1000000))
  })

  it('should download patch with empty content', async () => {
    const hash = 'sha256-emptyfile'

    const result = await client.downloadPatch(hash, { baseUrl })

    expect(result).toBe('')
  })

  it('should download patch with UTF-8 content', async () => {
    const utf8Content = '// Comment: Привет мир 你好世界 🎉'
    const hash = 'sha256-utf8content'

    const result = await client.downloadPatch(hash, { baseUrl })

    expect(result).toBe(utf8Content)
  })

  it('should handle response stream errors', async () => {
    const hash = 'sha256-responseerror'

    await expect(client.downloadPatch(hash, { baseUrl })).rejects.toThrow(
      /Error downloading blob|socket hang up/,
    )
  })

  it('should handle request errors', async () => {
    const hash = 'sha256-test'
    // Use invalid URL to trigger request error.
    const invalidBaseUrl = 'http://localhost:1'

    await expect(
      client.downloadPatch(hash, { baseUrl: invalidBaseUrl }),
    ).rejects.toThrow('Error downloading blob')
  })
})
