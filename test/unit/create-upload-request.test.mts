/** @fileoverview Tests for createUploadRequest multipart upload functionality. */
import { Readable } from 'node:stream'

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { createUploadRequest } from '../../src/file-upload'
import { setupTestEnvironment } from '../utils/environment.mts'

describe('createUploadRequest', () => {
  setupTestEnvironment()

  it('should create multipart upload with string parts', async () => {
    nock('https://api.socket.dev')
      .post('/v0/test-upload')
      .reply(200, { success: true })

    const result = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-upload',
      [
        'Content-Disposition: form-data; name="field1"\r\n\r\n',
        'value1',
        '\r\n',
      ],
      { headers: { Authorization: 'Bearer test-token' } },
    )

    expect(result.statusCode).toBe(200)
  })

  it('should create multipart upload with stream parts', async () => {
    nock('https://api.socket.dev')
      .post('/v0/test-stream')
      .reply(200, { success: true })

    const stream = Readable.from('test file content')

    const result = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-stream',
      [
        [
          'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n',
          'Content-Type: text/plain\r\n\r\n',
          stream,
        ],
      ],
      { headers: { Authorization: 'Bearer test-token' } },
    )

    expect(result.statusCode).toBe(200)
  })

  it('should create multipart upload with mixed string and stream parts', async () => {
    nock('https://api.socket.dev')
      .post('/v0/test-mixed')
      .reply(200, { success: true })

    const stream = Readable.from('file data')

    const result = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-mixed',
      [
        'Content-Disposition: form-data; name="metadata"\r\n\r\n{"test": true}\r\n',
        [
          'Content-Disposition: form-data; name="file"; filename="data.txt"\r\n',
          'Content-Type: text/plain\r\n\r\n',
          stream,
        ],
      ],
      { headers: { Authorization: 'Bearer test-token' } },
    )

    expect(result.statusCode).toBe(200)
  })

  it('should handle server error response during upload', async () => {
    nock('https://api.socket.dev')
      .post('/v0/test-error')
      .reply(400, { error: 'Bad request' })

    const result = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-error',
      ['Content-Disposition: form-data; name="field"\r\n\r\nvalue\r\n'],
      { headers: { Authorization: 'Bearer test-token' } },
    )

    expect(result.statusCode).toBe(400)
  })

  it('should handle multiple stream parts', async () => {
    nock('https://api.socket.dev')
      .post('/v0/test-multi-stream')
      .reply(200, { success: true })

    const stream1 = Readable.from('content 1')
    const stream2 = Readable.from('content 2')

    const result = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-multi-stream',
      [
        [
          'Content-Disposition: form-data; name="file1"; filename="file1.txt"\r\n',
          'Content-Type: text/plain\r\n\r\n',
          stream1,
        ],
        [
          'Content-Disposition: form-data; name="file2"; filename="file2.txt"\r\n',
          'Content-Type: text/plain\r\n\r\n',
          stream2,
        ],
      ],
      { headers: { Authorization: 'Bearer test-token' } },
    )

    expect(result.statusCode).toBe(200)
  })

  it('should handle empty stream', async () => {
    nock('https://api.socket.dev')
      .post('/v0/test-empty-stream')
      .reply(200, { success: true })

    const emptyStream = Readable.from('')

    const result = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-empty-stream',
      [
        [
          'Content-Disposition: form-data; name="empty"; filename="empty.txt"\r\n',
          'Content-Type: text/plain\r\n\r\n',
          emptyStream,
        ],
      ],
      { headers: { Authorization: 'Bearer test-token' } },
    )

    expect(result.statusCode).toBe(200)
  })

  it('should handle large stream data', async () => {
    nock('https://api.socket.dev')
      .post('/v0/test-large')
      .reply(200, { success: true })

    // Create a stream with multiple chunks
    const largeData = 'x'.repeat(10_000)
    const largeStream = Readable.from(largeData)

    const result = await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-large',
      [
        [
          'Content-Disposition: form-data; name="large"; filename="large.txt"\r\n',
          'Content-Type: text/plain\r\n\r\n',
          largeStream,
        ],
      ],
      { headers: { Authorization: 'Bearer test-token' } },
    )

    expect(result.statusCode).toBe(200)
  })

  it('should properly format multipart boundary', async () => {
    let capturedBody = ''

    nock('https://api.socket.dev')
      .post('/v0/test-boundary')
      .reply(function () {
        capturedBody = this.req.headers['content-type'] || ''
        return [200, { success: true }]
      })

    await createUploadRequest(
      'https://api.socket.dev',
      '/v0/test-boundary',
      ['Content-Disposition: form-data; name="test"\r\n\r\nvalue\r\n'],
      { headers: { Authorization: 'Bearer test-token' } },
    )

    expect(capturedBody).toContain('multipart/form-data')
    expect(capturedBody).toContain('boundary=NodeMultipartBoundary')
  })
})
