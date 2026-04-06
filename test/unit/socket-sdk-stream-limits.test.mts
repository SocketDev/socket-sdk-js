/** @fileoverview Tests for streaming behavior in SocketSdk download/stream methods. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const { SocketSdk } = await import('../../src/socket-sdk-class.js')

const { setupLocalHttpServer } =
  await import('../utils/local-server-helpers.mts')

import type { IncomingMessage, ServerResponse } from 'node:http'

describe('SocketSdk - Streaming downloads', () => {
  let tmpDir: string

  const getBaseUrl = setupLocalHttpServer(
    (_req: IncomingMessage, res: ServerResponse) => {
      const body = Buffer.alloc(200, 'x')
      res.writeHead(200, {
        'Content-Length': body.length,
        'Content-Type': 'application/octet-stream',
      })
      res.end(body)
    },
  )

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'sdk-stream-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should stream downloadOrgFullScanFilesAsTar to file', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })
    const outputPath = path.join(tmpDir, 'output.tar')

    const result = await client.downloadOrgFullScanFilesAsTar(
      'test-org',
      'scan-123',
      outputPath,
    )

    expect(result.success).toBe(true)
    const content = readFileSync(outputPath)
    expect(content.length).toBe(200)
  })

  it('should stream streamFullScan to file', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })
    const outputPath = path.join(tmpDir, 'scan-output.json')

    const result = await client.streamFullScan('test-org', 'scan-456', {
      output: outputPath,
    })

    expect(result.success).toBe(true)
    const content = readFileSync(outputPath)
    expect(content.length).toBe(200)
  })

  it('should stream streamFullScan to stdout', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const chunks: Buffer[] = []
    const origWrite = process.stdout.write
    process.stdout.write = ((chunk: unknown): boolean => {
      if (Buffer.isBuffer(chunk)) chunks.push(chunk)
      return true
    }) as typeof process.stdout.write

    try {
      const result = await client.streamFullScan('test-org', 'scan-789', {
        output: true,
      })

      expect(result.success).toBe(true)
      expect(Buffer.concat(chunks).length).toBe(200)
    } finally {
      process.stdout.write = origWrite
    }
  })
})
