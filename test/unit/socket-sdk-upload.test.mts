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
import { Readable } from 'node:stream'

import FormData from 'form-data'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createRequestBodyForFilepaths,
  createRequestBodyForJson,
  createUploadRequest,
} from '../../src/file-upload'
import { SocketSdk } from '../../src/index'
import { isCoverageMode, setupNockEnvironment } from '../utils/environment.mts'
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

  it('should create FormData for valid file', () => {
    const testFile = path.join(tempDir, 'test.txt')
    writeFileSync(testFile, 'test content')

    const result = createRequestBodyForFilepaths([testFile], tempDir)

    expect(result).toBeInstanceOf(FormData)
    expect(result.getHeaders()).toHaveProperty('content-type')
    expect(result.getHeaders()['content-type']).toMatch(
      /^multipart\/form-data; boundary=/,
    )
  })

  it('should create FormData for multiple files', () => {
    const file1 = path.join(tempDir, 'file1.txt')
    const file2 = path.join(tempDir, 'file2.txt')
    writeFileSync(file1, 'content 1')
    writeFileSync(file2, 'content 2')

    const result = createRequestBodyForFilepaths([file1, file2], tempDir)

    expect(result).toBeInstanceOf(FormData)
    expect(result.getHeaders()).toHaveProperty('content-type')
  })

  it('should handle nested file paths correctly', () => {
    const nestedDir = path.join(tempDir, 'nested', 'deep')
    mkdirSync(nestedDir, { recursive: true })
    const nestedFile = path.join(nestedDir, 'nested-file.txt')
    writeFileSync(nestedFile, 'nested content')

    const result = createRequestBodyForFilepaths([nestedFile], tempDir)

    expect(result).toBeInstanceOf(FormData)
    expect(result.getBoundary()).toBeTruthy()
  })

  it('should handle UTF-8 filenames correctly', () => {
    // Test various UTF-8 characters: Japanese, emoji, special chars
    const utf8Filename = 'テスト-файл-📦-special.txt'
    const testFile = path.join(tempDir, utf8Filename)
    writeFileSync(testFile, 'utf8 content')

    const result = createRequestBodyForFilepaths([testFile], tempDir)

    expect(result).toBeInstanceOf(FormData)
    expect(result.getBoundary()).toBeTruthy()
    // form-data should handle UTF-8 encoding per RFC 7578
    expect(result.getHeaders()['content-type']).toMatch(
      /^multipart\/form-data; boundary=/,
    )
  })

  it('should handle UTF-8 filenames in nested paths', () => {
    const utf8Dir = path.join(tempDir, 'папка', '文件夹')
    mkdirSync(utf8Dir, { recursive: true })
    const utf8File = path.join(utf8Dir, 'файл-テスト.json')
    writeFileSync(utf8File, '{"test": true}')

    const result = createRequestBodyForFilepaths([utf8File], tempDir)

    expect(result).toBeInstanceOf(FormData)
    expect(result.getBoundary()).toBeTruthy()
  })

  it('should handle multiple files with UTF-8 filenames', () => {
    const files = [
      path.join(tempDir, '日本語.txt'),
      path.join(tempDir, 'русский.txt'),
      path.join(tempDir, 'emoji-🚀-file.txt'),
    ]

    for (const file of files) {
      writeFileSync(file, 'content')
    }

    const result = createRequestBodyForFilepaths(files, tempDir)

    expect(result).toBeInstanceOf(FormData)
    expect(result.getBoundary()).toBeTruthy()
  })
})

// Note: createRequestBodyForJson tests are in test/unit/utils.test.mts
// to avoid duplication with more comprehensive test coverage there.

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

  it.skipIf(isCoverageMode)('should call hooks when provided', async () => {
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
      { hooks, timeout: 5000 },
    )

    expect(requestCalled).toBe(true)
    expect(responseCalled).toBe(true)
  })

  it.skipIf(isCoverageMode)('should handle upload errors', async () => {
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

  it.skipIf(isCoverageMode)('should handle JSON body in request', async () => {
    const jsonData = { name: 'test-package', version: '1.0.0' }
    const jsonPart = createRequestBodyForJson(jsonData, 'package.json')

    nock('https://api.socket.dev')
      .post('/v0/test-json-upload')
      .reply(200, { received: true })

    const response = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-json-upload',
      jsonPart,
      { timeout: 5000 },
    )

    expect(response.statusCode).toBe(200)
  })

  it.skipIf(isCoverageMode)(
    'should handle mixed file and JSON uploads',
    async () => {
      const testFile = path.join(tempDir, 'manifest.json')
      writeFileSync(testFile, '{"dependencies":{}}')

      // Create a single FormData with both file and JSON
      const form = createRequestBodyForFilepaths([testFile], tempDir)
      const jsonStream = Readable.from(JSON.stringify({ metadata: 'test' }), {
        highWaterMark: 1024 * 1024,
      })
      form.append('meta', jsonStream, {
        contentType: 'application/json',
        filename: 'meta.json',
      })

      nock('https://api.socket.dev')
        .post('/v0/test-mixed-upload')
        .reply(200, { success: true })

      const response = await createUploadRequest(
        'https://api.socket.dev',
        '/v0/test-mixed-upload',
        form,
        { timeout: 5000 },
      )

      expect(response.statusCode).toBe(200)
    },
  )

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
