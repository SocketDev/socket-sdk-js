/**
 * @fileoverview Consolidated tests for file upload functionality.
 * Tests file-upload utilities and SDK upload methods.
 *
 * Consolidates:
 * - file-upload-errors.test.mts
 * - socket-sdk-upload-simple.test.mts
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createRequestBodyForFilepaths } from '../../src/file-upload'
import { SocketSdk } from '../../src/index'
import { setupNockEnvironment } from '../utils/environment.mts'
import { FAST_TEST_CONFIG } from '../utils/fast-test-config.mts'

// =============================================================================
// File Upload Utilities
// =============================================================================

describe('File Upload - createRequestBodyForFilepaths', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'socket-sdk-file-upload-test-'))
  })

  afterEach(async () => {
    // Allow time for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 10))
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it('should create request body for valid file', () => {
    const testFile = path.join(tempDir, 'test.txt')
    writeFileSync(testFile, 'test content')

    const result = createRequestBodyForFilepaths([testFile], tempDir)

    expect(result).toHaveLength(1)
    const part = result[0]!
    expect(part).toHaveLength(3)
    const header1 = part[0] as string
    const header2 = part[1] as string
    expect(header1).toContain('Content-Disposition: form-data')
    expect(header1).toContain('name="test.txt"')
    expect(header1).toContain('filename="test.txt"')
    expect(header2).toBe('Content-Type: application/octet-stream\r\n\r\n')

    // Clean up stream
    const stream = part[2] as any
    if (stream && typeof stream.destroy === 'function') {
      stream.destroy()
    }
  })

  it('should create request body for multiple files', () => {
    const file1 = path.join(tempDir, 'file1.txt')
    const file2 = path.join(tempDir, 'file2.txt')
    writeFileSync(file1, 'content 1')
    writeFileSync(file2, 'content 2')

    const result = createRequestBodyForFilepaths([file1, file2], tempDir)

    expect(result).toHaveLength(2)
    const header1 = result[0]![0] as string
    const header2 = result[1]![0] as string
    expect(header1).toContain('name="file1.txt"')
    expect(header2).toContain('name="file2.txt"')

    // Clean up streams
    for (const part of result) {
      const stream = part[2] as any
      if (stream && typeof stream.destroy === 'function') {
        stream.destroy()
      }
    }
  })

  it('should handle nested file paths correctly', () => {
    const nestedDir = path.join(tempDir, 'nested', 'deep')
    mkdirSync(nestedDir, { recursive: true })
    const nestedFile = path.join(nestedDir, 'nested-file.txt')
    writeFileSync(nestedFile, 'nested content')

    const result = createRequestBodyForFilepaths([nestedFile], tempDir)

    expect(result).toHaveLength(1)
    const header = result[0]![0] as string
    expect(header).toContain('name="nested/deep/nested-file.txt"')
    expect(header).toContain('filename="nested-file.txt"')

    // Clean up stream
    const stream = result[0]![2] as any
    if (stream && typeof stream.destroy === 'function') {
      stream.destroy()
    }
  })
})

// =============================================================================
// SDK Upload Methods
// =============================================================================

describe('SocketSdk - Upload Manifest', () => {
  setupNockEnvironment()

  let sdk: SocketSdk
  let tempDir: string
  let packageJsonPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'socket-sdk-upload-coverage-'))
    packageJsonPath = path.join(tempDir, 'package.json')

    writeFileSync(
      packageJsonPath,
      JSON.stringify({ name: 'test-pkg', version: '1.0.0' }),
    )

    sdk = new SocketSdk('test-token', FAST_TEST_CONFIG)
  })

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  describe('uploadManifestFiles', () => {
    it(
      'should successfully execute upload manifest files method',
      { retry: 2 },
      async () => {
        nock('https://api.socket.dev')
          .post('/v0/orgs/test-org/upload-manifest-files')
          .reply(200, {
            tarHash: 'abc123def456',
            unmatchedFiles: [],
          })

        const result = await sdk.uploadManifestFiles('test-org', [
          packageJsonPath,
        ])

        expect(result.success).toBe(true)
        expect(result.status).toBe(200)
        if (result.success) {
          expect(result.data.tarHash).toBe('abc123def456')
          expect(result.data.unmatchedFiles).toEqual([])
        }
      },
    )

    it(
      'should handle errors in uploadManifestFiles',
      { retry: 2 },
      async () => {
        nock('https://api.socket.dev')
          .post('/v0/orgs/test-org/upload-manifest-files')
          .reply(400, {
            error: {
              message: 'Invalid manifest files',
            },
          })

        const result = await sdk.uploadManifestFiles('test-org', [
          packageJsonPath,
        ])

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.status).toBe(400)
          expect(result.error).toContain('Invalid manifest files')
        }
      },
    )
  })
})
