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

import {
  createRequestBodyForFilepaths,
  createRequestBodyForJson,
  createUploadRequest,
} from '../../src/file-upload'
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

describe('File Upload - createRequestBodyForJson', () => {
  it('should create request body for JSON data with default basename', () => {
    const jsonData = { name: 'test', version: '1.0.0' }

    const result = createRequestBodyForJson(jsonData)

    expect(result).toHaveLength(3)
    expect(result[0]).toContain('Content-Disposition: form-data')
    expect(result[0]).toContain('name="data"')
    expect(result[0]).toContain('filename="data.json"')
    expect(result[0]).toContain('Content-Type: application/json')
    expect(result[2]).toBe('\r\n')

    // Verify stream contains JSON
    const stream = result[1] as any
    expect(stream).toBeDefined()
  })

  it('should create request body for JSON with custom basename', () => {
    const jsonData = { foo: 'bar' }
    const basename = 'custom.json'

    const result = createRequestBodyForJson(jsonData, basename)

    expect(result).toHaveLength(3)
    expect(result[0]).toContain('name="custom"')
    expect(result[0]).toContain('filename="custom.json"')
  })

  it('should handle basename with different extension', () => {
    const jsonData = { test: true }
    const basename = 'metadata.txt'

    const result = createRequestBodyForJson(jsonData, basename)

    expect(result[0]).toContain('name="metadata"')
    expect(result[0]).toContain('filename="metadata.txt"')
  })

  it('should handle complex JSON objects', () => {
    const jsonData = {
      nested: { deeply: { value: 123 } },
      array: [1, 2, 3],
      boolean: true,
      null: null,
    }

    const result = createRequestBodyForJson(jsonData)

    expect(result).toHaveLength(3)
    const stream = result[1] as any
    expect(stream).toBeDefined()
  })
})

describe('File Upload - createUploadRequest', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'socket-sdk-upload-request-'))
  })

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it('should create and execute upload request successfully', async () => {
    const testFile = path.join(tempDir, 'test.txt')
    writeFileSync(testFile, 'test content')

    const requestBody = createRequestBodyForFilepaths([testFile], tempDir)

    nock('https://api.socket.dev')
      .post('/v0/test-upload')
      .reply(200, { success: true })

    const response = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-upload',
      requestBody,
      { timeout: 5000 },
    )

    expect(response.statusCode).toBe(200)
  })

  it('should call hooks when provided', async () => {
    let requestCalled = false
    let responseCalled = false

    const testFile = path.join(tempDir, 'test.txt')
    writeFileSync(testFile, 'test content')

    const requestBody = createRequestBodyForFilepaths([testFile], tempDir)

    const hooks = {
      onRequest: () => {
        requestCalled = true
      },
      onResponse: () => {
        responseCalled = true
      },
    }

    nock('https://api.socket.dev')
      .post('/v0/test-upload')
      .reply(200, { success: true })

    await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-upload',
      requestBody,
      { timeout: 5000 },
      hooks,
    )

    expect(requestCalled).toBe(true)
    expect(responseCalled).toBe(true)
  })

  it('should handle upload errors', async () => {
    const testFile = path.join(tempDir, 'test.txt')
    writeFileSync(testFile, 'test content')

    const requestBody = createRequestBodyForFilepaths([testFile], tempDir)

    nock('https://api.socket.dev')
      .post('/v0/test-upload-error')
      .reply(400, { error: 'Bad Request' })

    const response = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-upload-error',
      requestBody,
      { timeout: 5000 },
    )

    expect(response.statusCode).toBe(400)
  })

  it('should handle JSON body in request', async () => {
    const jsonData = { name: 'test-package', version: '1.0.0' }
    const jsonPart = createRequestBodyForJson(jsonData, 'package.json')

    nock('https://api.socket.dev')
      .post('/v0/test-json-upload')
      .reply(200, { received: true })

    const response = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-json-upload',
      [jsonPart],
      { timeout: 5000 },
    )

    expect(response.statusCode).toBe(200)
  })

  it('should handle mixed file and JSON uploads', async () => {
    const testFile = path.join(tempDir, 'manifest.json')
    writeFileSync(testFile, '{"dependencies":{}}')

    const fileParts = createRequestBodyForFilepaths([testFile], tempDir)
    const jsonPart = createRequestBodyForJson({ metadata: 'test' }, 'meta.json')

    nock('https://api.socket.dev')
      .post('/v0/test-mixed-upload')
      .reply(200, { success: true })

    const response = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-mixed-upload',
      [...fileParts, jsonPart],
      { timeout: 5000 },
    )

    expect(response.statusCode).toBe(200)
  })

  it('should handle network connection failures gracefully', async () => {
    const testFile = path.join(tempDir, 'test.txt')
    writeFileSync(testFile, 'test content')

    const requestBody = createRequestBodyForFilepaths([testFile], tempDir)

    // Don't mock the endpoint - let it fail with connection error
    await expect(
      createUploadRequest(
        'http://127.0.0.1:1',
        '/v0/test-upload',
        requestBody,
        { timeout: 100 },
      ),
    ).rejects.toThrow()
  })

  it('should handle server rejection before upload completes', async () => {
    const testFile = path.join(tempDir, 'test.txt')
    writeFileSync(testFile, 'test content')

    const requestBody = createRequestBodyForFilepaths([testFile], tempDir)

    nock('https://api.socket.dev')
      .post('/v0/test-auth-reject')
      .reply(401, { error: 'Unauthorized' })

    const response = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-auth-reject',
      requestBody,
      { timeout: 5000 },
    )

    expect(response.statusCode).toBe(401)
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
