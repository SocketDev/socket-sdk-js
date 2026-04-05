/** @fileoverview Tests for streaming size limit enforcement in SocketSdk. */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.doMock to override MAX_STREAM_SIZE to a tiny value for testing.
vi.doMock('../../src/constants.js', async importOriginal => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return { ...orig, MAX_STREAM_SIZE: 100 }
})

// Dynamic import AFTER the mock so the mock takes effect.
const { SocketSdk } = await import('../../src/socket-sdk-class.js')

// Use setupLocalHttpServer instead of nock — works in both threads and forks pools.
const { setupLocalHttpServer } =
  await import('../utils/local-server-helpers.mts')

import type { IncomingMessage, ServerResponse } from 'node:http'

describe('SocketSdk - Stream size limits', () => {
  let tmpDir: string

  const getBaseUrl = setupLocalHttpServer(
    (_req: IncomingMessage, res: ServerResponse) => {
      // Return 200 bytes (exceeds mocked MAX_STREAM_SIZE of 100)
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

  it('should enforce size limit on downloadOrgFullScanFilesAsTar', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })
    const outputPath = path.join(tmpDir, 'output.tar')

    // Size limit (100 bytes) is exceeded by the 200-byte response,
    // causing res.destroy() which propagates as a thrown error.
    await expect(
      client.downloadOrgFullScanFilesAsTar('test-org', 'scan-123', outputPath),
    ).rejects.toThrow()
  })

  it('should enforce size limit on streamFullScan file output', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })
    const outputPath = path.join(tmpDir, 'scan-output.json')

    await expect(
      client.streamFullScan('test-org', 'scan-456', { output: outputPath }),
    ).rejects.toThrow()
  })

  it('should enforce size limit on streamFullScan stdout output', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    // Stub process.stdout.write to prevent actual terminal output.
    const origWrite = process.stdout.write
    process.stdout.write = ((_chunk: unknown): boolean =>
      true) as typeof process.stdout.write

    try {
      await expect(
        client.streamFullScan('test-org', 'scan-789', {
          output: true,
        }),
      ).rejects.toThrow()
    } finally {
      process.stdout.write = origWrite
    }
  })
})
