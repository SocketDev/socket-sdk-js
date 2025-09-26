/** @fileoverview Simple test for Socket SDK upload manifest files method to improve coverage. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

describe('SocketSdk - Upload Manifest Coverage', () => {
  let tempDir: string
  let packageJsonPath: string
  let sdk: SocketSdk

  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()

    tempDir = mkdtempSync(path.join(tmpdir(), 'socket-sdk-upload-coverage-'))
    packageJsonPath = path.join(tempDir, 'package.json')

    writeFileSync(
      packageJsonPath,
      JSON.stringify({ name: 'test-pkg', version: '1.0.0' }),
    )

    sdk = new SocketSdk('test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('uploadManifestFiles', () => {
    it('should successfully execute upload manifest files method', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/upload-manifest-files')
        .reply(200, {
          success: true,
          uploadId: 'test-upload-123',
        })

      const result = await sdk.uploadManifestFiles('test-org', [
        packageJsonPath,
      ])

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
    })
  })
})
