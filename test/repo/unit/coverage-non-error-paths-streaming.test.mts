/**
 * @file Tests covering socket-sdk-class.mts streaming
 *   non-error paths. Targets:
 *
 *   - downloadOrgFullScanFilesAsTar streaming (bytesWritten tracking)
 *   - streamFullScan data/error/end handlers (file output, stdout output)
 *   - uploadManifestFiles edge cases (>5 invalid files, validation callback)
 */

import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { setupLocalHttpServer } from '../../utils/local-server.mts'

import type { IncomingMessage, ServerResponse } from 'node:http'
import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'

// =============================================================================
// 4f. socket-sdk-class.ts — downloadOrgFullScanFilesAsTar streaming (1929-1949)
//     (bytesWritten tracking in data handler)
// =============================================================================

describe('SocketSdk - downloadOrgFullScanFilesAsTar streaming byte tracking', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/files/tar')) {
        res.writeHead(200, { 'Content-Type': 'application/x-tar' })
        // Send multiple chunks to exercise the data handler
        res.write(Buffer.from('chunk1'))
        res.write(Buffer.from('chunk2'))
        res.write(Buffer.from('chunk3'))
        res.end()
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  let tmpDir: string

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'sdk-tar-bytes-'))
  })

  afterAll(async () => {
    await safeDelete(tmpDir)
  })

  it('should track bytes through multiple data chunks', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const outputPath = path.join(tmpDir, 'multi-chunk.tar')
    const result = await client.downloadOrgFullScanFilesAsTar(
      'test-org',
      'scan-1',
      outputPath,
    )

    expect(result.success).toBe(true)
  })
})

// =============================================================================
// 4g. socket-sdk-class.ts — streamFullScan data/end handlers (3928-3967)
//     (file output with multiple data chunks, stdout output with end cleanup)
// =============================================================================

describe('SocketSdk - streamFullScan data handlers', () => {
  const getBaseUrl = setupLocalHttpServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || ''

      if (url.includes('/full-scans/')) {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        // Send multiple chunks to exercise the data size tracking handler
        const line1 = JSON.stringify({ name: 'lodash', version: '4.17.21' })
        const line2 = JSON.stringify({ name: 'express', version: '4.19.2' })
        res.write(`${line1}\n`)
        res.write(`${line2}\n`)
        res.end()
      } else {
        res.writeHead(404)
        res.end()
      }
    },
  )

  let tmpDir: string

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'sdk-stream-data-'))
  })

  afterAll(async () => {
    await safeDelete(tmpDir)
  })

  it('should track byte count through data handler for file output', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const outputPath = path.join(tmpDir, 'stream-track.json')
    const result = await client.streamFullScan('test-org', 'scan-data-1', {
      output: outputPath,
    })

    expect(result.success).toBe(true)
  })

  it('should handle stdout output', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    // Capture stdout writes
    const originalWrite = process.stdout.write
    const chunks: string[] = []
    process.stdout.write = (chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    }

    try {
      const result = await client.streamFullScan('test-org', 'scan-data-2', {
        output: true,
      })

      expect(result.success).toBe(true)
      expect(chunks.length).toBeGreaterThan(0)
    } finally {
      process.stdout.write = originalWrite
    }
  })

  it('should return response without streaming when output is false', async () => {
    const client = new SocketSdk('test-token', {
      baseUrl: `${getBaseUrl()}/v0/`,
      retries: 0,
    })

    const result = await client.streamFullScan('test-org', 'scan-data-3', {
      output: false,
    })

    expect(result.success).toBe(true)
  })
})

// =============================================================================
// 4h. socket-sdk-class.ts — uploadManifestFiles edge case (4497-4498)
//     Test the warning display when >3 files are invalid without callback,
//     and the "all files invalid" detailed error with >5 files.
// =============================================================================

describe('SocketSdk - uploadManifestFiles edge cases', () => {
  it('should show detailed error with >5 invalid files and truncation', async () => {
    const client = new SocketSdk('test-token', { retries: 0 })

    // Pass 7 invalid files to trigger the >5 truncation in "all files invalid" error
    const result = await client.uploadManifestFiles('test-org', [
      '/nonexistent/package.json',
      '/nonexistent/composer.json',
      '/nonexistent/pipfile.json',
      '/nonexistent/cargo.json',
      '/nonexistent/go.json',
      '/nonexistent/gemfile.json',
      '/nonexistent/lockfile.json',
    ])

    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.error).toBe('No readable manifest files found')
    // The cause should contain truncation for >5 files
    const cause = (result as { cause?: string | undefined }).cause ?? ''
    expect(cause).toContain('... and 2 more')
    expect(cause).toContain('Yarn Berry')
  })

  it('should include errorCause from validation callback when provided', async () => {
    const onFileValidation = vi.fn().mockResolvedValue({
      errorCause: 'Custom detailed cause',
      errorMessage: 'Custom validation error',
      shouldContinue: false,
    })

    const client = new SocketSdk('test-token', {
      onFileValidation,
      retries: 0,
    })

    const result = await client.uploadManifestFiles('test-org', [
      '/nonexistent/pkg.json',
    ])

    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.error).toBe('Custom validation error')
    // When errorCause is not redundant with errorMessage, it should be included
    const typedResult = result as { cause?: string | undefined }
    expect(typedResult.cause).toBe('Custom detailed cause')
  })

  it('should omit redundant errorCause from validation callback', async () => {
    const onFileValidation = vi.fn().mockResolvedValue({
      // This cause is very similar to the error message
      errorCause: 'Custom validation error message',
      errorMessage: 'Custom validation error',
      shouldContinue: false,
    })

    const client = new SocketSdk('test-token', {
      onFileValidation,
      retries: 0,
    })

    const result = await client.uploadManifestFiles('test-org', [
      '/nonexistent/pkg.json',
    ])

    expect(result.success).toBe(false)
    if (result.success) {
      return
    }
    expect(result.error).toBe('Custom validation error')
    // Redundant cause should be filtered out by filterRedundantCause
    const typedResult = result as { cause?: string | undefined }
    expect(typedResult.cause).toBeUndefined()
  })
})
