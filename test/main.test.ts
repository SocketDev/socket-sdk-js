import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SocketSdk, createRequestBodyForFilepaths } from '../dist/index.js'

process.on('unhandledRejection', cause => {
  throw new Error('Unhandled rejection', { cause })
})

describe('SocketSdk', () => {
  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  describe('basics', () => {
    it('should be able to instantiate itself', () => {
      const client = new SocketSdk('yetAnotherApiKey')
      expect(client).toBeTruthy()
    })
  })

  describe('getQuota', () => {
    it('should return quota from getQuota', async () => {
      nock('https://api.socket.dev').get('/v0/quota').reply(200, { quota: 1e9 })

      const client = new SocketSdk('yetAnotherApiKey')
      const res = await client.getQuota()

      expect(res).toEqual({
        success: true,
        status: 200,
        data: { quota: 1e9 }
      })
    })
  })

  describe('getIssuesByNPMPackage', () => {
    it('should return an empty issue list on an empty response', async () => {
      nock('https://api.socket.dev')
        .get('/v0/npm/speed-limiter/1.0.0/issues')
        .reply(200, [])

      const client = new SocketSdk('yetAnotherApiKey')
      const res = await client.getIssuesByNPMPackage('speed-limiter', '1.0.0')

      expect(res).toEqual({
        success: true,
        status: 200,
        data: []
      })
    })
  })

  describe('Authentication', () => {
    it('should include authentication token in request headers', async () => {
      const apiToken = 'test-api-token-123'
      let capturedHeaders: any = {}

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(function () {
          capturedHeaders = this.req.headers
          return [200, { quota: 5000 }]
        })

      const client = new SocketSdk(apiToken)
      await client.getQuota()

      expect(capturedHeaders.authorization).toBeDefined()
      const authHeader = Array.isArray(capturedHeaders.authorization)
        ? capturedHeaders.authorization[0]
        : capturedHeaders.authorization
      expect(authHeader).toContain('Basic')
      const decodedAuth = Buffer.from(
        authHeader.split(' ')[1],
        'base64'
      ).toString()
      expect(decodedAuth).toBe(`${apiToken}:`)
    })

    it('should handle 401 unauthorized responses for invalid tokens', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(401, { error: { message: 'Invalid API token' } })

      const client = new SocketSdk('invalid-token')
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(401)
      expect(res.error).toContain('request failed')
    })

    it('should handle 403 forbidden responses for insufficient permissions', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/security-policy')
        .reply(403, { error: { message: 'Insufficient permissions' } })

      const client = new SocketSdk('limited-token')
      const res = await client.getOrgSecurityPolicy('test-org')

      expect(res.success).toBe(false)
      expect(res.status).toBe(403)
      expect(res.error).toContain('request failed')
    })

    it('should support different base URLs for authentication', async () => {
      const customBaseUrl = 'https://custom.socket.dev/api/'

      nock('https://custom.socket.dev')
        .get('/api/quota')
        .reply(200, { quota: 10000 })

      const client = new SocketSdk('api-token', {
        baseUrl: customBaseUrl
      })
      const res = await client.getQuota()

      expect(res.success).toBe(true)
      expect(res.data.quota).toBe(10000)
    })

    it('should handle token expiration scenarios', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(401, {
          error: {
            message: 'Token expired',
            code: 'TOKEN_EXPIRED'
          }
        })

      const client = new SocketSdk('expired-token')
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(401)
      expect(res.cause).toContain('Token expired')
    })
  })

  describe('Reachability', () => {
    it('should detect reachable packages in batch fetch', async () => {
      const mockResponse = {
        purl: 'pkg:npm/express@4.19.2',
        name: 'express',
        version: '4.19.2',
        type: 'npm',
        alertKeysToReachabilityTypes: {
          malware: ['direct'],
          criticalCVE: ['transitive']
        },
        alertKeysToReachabilitySummaries: {
          malware: {
            reachable: true,
            directlyReachable: true,
            transitivelyReachable: false
          },
          criticalCVE: {
            reachable: true,
            directlyReachable: false,
            transitivelyReachable: true
          }
        },
        alerts: [
          {
            type: 'malware',
            severity: 'critical',
            key: 'malware',
            props: {}
          },
          {
            type: 'criticalCVE',
            severity: 'high',
            key: 'criticalCVE',
            props: {}
          }
        ]
      }

      nock('https://api.socket.dev')
        .post('/v0/purl')
        .reply(200, JSON.stringify(mockResponse) + '\n')

      const client = new SocketSdk('test-token')
      const res = await client.batchPackageFetch({
        components: [{ purl: 'pkg:npm/express@4.19.2' }]
      })

      expect(res.success).toBe(true)
      expect(res.data).toHaveLength(1)
      const artifact = res.data[0]
      expect(artifact.alertKeysToReachabilitySummaries).toBeDefined()
      expect(artifact.alertKeysToReachabilitySummaries.malware.reachable).toBe(
        true
      )
      expect(
        artifact.alertKeysToReachabilitySummaries.malware.directlyReachable
      ).toBe(true)
      expect(
        artifact.alertKeysToReachabilitySummaries.criticalCVE
          .transitivelyReachable
      ).toBe(true)
    })

    it('should handle unreachable packages', async () => {
      const mockResponse = {
        purl: 'pkg:npm/lodash@4.17.21',
        name: 'lodash',
        version: '4.17.21',
        type: 'npm',
        alertKeysToReachabilityTypes: {},
        alertKeysToReachabilitySummaries: {},
        alerts: [
          {
            type: 'unpopularPackage',
            severity: 'low',
            key: 'unpopularPackage',
            props: {}
          }
        ]
      }

      nock('https://api.socket.dev')
        .post('/v0/purl')
        .reply(200, JSON.stringify(mockResponse) + '\n')

      const client = new SocketSdk('test-token')
      const res = await client.batchPackageFetch({
        components: [{ purl: 'pkg:npm/lodash@4.17.21' }]
      })

      expect(res.success).toBe(true)
      const artifact = res.data[0]
      expect(artifact.alertKeysToReachabilitySummaries).toEqual({})
      expect(artifact.alertKeysToReachabilityTypes).toEqual({})
    })

    it('should handle mixed reachability in batch requests', async () => {
      const responses = [
        {
          purl: 'pkg:npm/react@18.0.0',
          name: 'react',
          version: '18.0.0',
          type: 'npm',
          alertKeysToReachabilitySummaries: {
            cve: {
              reachable: true,
              directlyReachable: true,
              transitivelyReachable: false
            }
          },
          alerts: [{ type: 'cve', severity: 'medium', key: 'cve' }]
        },
        {
          purl: 'pkg:npm/vue@3.0.0',
          name: 'vue',
          version: '3.0.0',
          type: 'npm',
          alertKeysToReachabilitySummaries: {},
          alerts: []
        }
      ]

      nock('https://api.socket.dev')
        .post('/v0/purl')
        .reply(200, responses.map(r => JSON.stringify(r)).join('\n'))

      const client = new SocketSdk('test-token')
      const res = await client.batchPackageFetch({
        components: [
          { purl: 'pkg:npm/react@18.0.0' },
          { purl: 'pkg:npm/vue@3.0.0' }
        ]
      })

      expect(res.success).toBe(true)
      expect(res.data).toHaveLength(2)
      expect(res.data[0].alertKeysToReachabilitySummaries.cve.reachable).toBe(
        true
      )
      expect(res.data[1].alertKeysToReachabilitySummaries).toEqual({})
    })

    it('should handle network timeouts for reachability checks', async () => {
      nock('https://api.socket.dev')
        .post('/v0/purl')
        .delayConnection(200)
        .reply(200, {})

      const client = new SocketSdk('test-token', {
        timeout: 100
      })

      await expect(
        client.batchPackageFetch({
          components: [{ purl: 'pkg:npm/test@1.0.0' }]
        })
      ).rejects.toThrow()
    })
  })

  describe('Network and Connection', () => {
    it('should handle 503 service unavailable', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(503, 'Service temporarily unavailable')

      const client = new SocketSdk('test-token')

      await expect(client.getQuota()).rejects.toThrow('server error')
    })

    it('should handle connection refused errors', async () => {
      const client = new SocketSdk('test-token')

      // Mock a connection error by intercepting the request
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .replyWithError(new Error('Connection refused'))

      await expect(client.getQuota()).rejects.toThrow()
    }, 10000)

    it('should handle DNS resolution failures', async () => {
      const client = new SocketSdk('test-token')

      // Mock a DNS error by intercepting the request
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .replyWithError(new Error('DNS lookup failed'))

      await expect(client.getQuota()).rejects.toThrow()
    }, 10000)

    it('should handle malformed JSON responses', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, 'This is not JSON')

      const client = new SocketSdk('test-token')

      await expect(client.getQuota()).rejects.toThrow()
    })

    it('should handle partial response data', async () => {
      nock('https://api.socket.dev')
        .post('/v0/purl')
        .reply(200, '{"purl":"pkg:npm/test@1.0.0","na')

      const client = new SocketSdk('test-token')
      const res = await client.batchPackageFetch({
        components: [{ purl: 'pkg:npm/test@1.0.0' }]
      })

      expect(res.success).toBe(true)
      expect(res.data).toEqual([])
    })
  })

  describe('Session Management', () => {
    it('should maintain session across multiple requests', async () => {
      const apiToken = 'persistent-token'

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(200, { quota: 1000 })
        .get('/v0/organizations')
        .reply(200, { organizations: ['org1', 'org2'] })

      const client = new SocketSdk(apiToken)

      const quotaRes = await client.getQuota()
      expect(quotaRes.success).toBe(true)

      const orgsRes = await client.getOrganizations()
      expect(orgsRes.success).toBe(true)
    })

    it('should handle session invalidation', async () => {
      let requestCount = 0

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .times(2)
        .reply(() => {
          requestCount++
          if (requestCount === 1) {
            return [200, { quota: 5000 }]
          }
          return [401, { error: { message: 'Session expired' } }]
        })

      const client = new SocketSdk('session-token')

      const firstRes = await client.getQuota()
      expect(firstRes.success).toBe(true)

      const secondRes = await client.getQuota()
      expect(secondRes.success).toBe(false)
      expect(secondRes.status).toBe(401)
    })

    it('should support custom user agents for session tracking', async () => {
      let capturedUserAgent: string = ''

      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(function () {
          const headers = this.req.headers['user-agent']
          capturedUserAgent = Array.isArray(headers) ? headers[0] : headers
          return [200, { quota: 3000 }]
        })

      const client = new SocketSdk('test-token', {
        userAgent: 'CustomApp/1.0.0'
      })

      await client.getQuota()
      expect(capturedUserAgent).toBe('CustomApp/1.0.0')
    })
  })

  describe('Multi-part Upload', () => {
    let tempDir: string
    let packageJsonPath: string
    let packageLockPath: string

    beforeEach(() => {
      // Create a temporary directory for test files
      tempDir = mkdtempSync(join(tmpdir(), 'socket-sdk-test-'))

      // Create test manifest files
      packageJsonPath = join(tempDir, 'package.json')
      packageLockPath = join(tempDir, 'package-lock.json')

      writeFileSync(
        packageJsonPath,
        JSON.stringify(
          {
            name: 'test-project',
            version: '1.0.0',
            dependencies: {
              express: '^4.18.0',
              lodash: '^4.17.21'
            }
          },
          null,
          2
        )
      )

      writeFileSync(
        packageLockPath,
        JSON.stringify(
          {
            name: 'test-project',
            version: '1.0.0',
            lockfileVersion: 2,
            requires: true,
            packages: {
              '': {
                name: 'test-project',
                version: '1.0.0',
                dependencies: {
                  express: '^4.18.0',
                  lodash: '^4.17.21'
                }
              }
            }
          },
          null,
          2
        )
      )
    })

    afterEach(() => {
      // Clean up temporary files
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should upload files with createDependenciesSnapshot', async () => {
      let capturedBody = ''
      let capturedHeaders: any = {}

      nock('https://api.socket.dev')
        .post('/v0/dependencies/upload')
        .reply(function (uri, requestBody) {
          capturedHeaders = this.req.headers
          capturedBody = requestBody as string
          return [
            200,
            {
              id: 'snapshot-123',
              status: 'complete',
              files: ['package.json', 'package-lock.json']
            }
          ]
        })

      const client = new SocketSdk('test-token')
      const res = await client.createDependenciesSnapshot(
        [packageJsonPath, packageLockPath],
        tempDir
      )

      expect(res.success).toBe(true)
      expect(res.data.id).toBe('snapshot-123')
      expect(res.data.files).toContain('package.json')
      expect(res.data.files).toContain('package-lock.json')

      // Verify multipart headers
      expect(capturedHeaders['content-type']).toBeDefined()
      const contentType = Array.isArray(capturedHeaders['content-type'])
        ? capturedHeaders['content-type'][0]
        : capturedHeaders['content-type']
      expect(contentType).toContain('multipart/form-data')
      expect(contentType).toContain('boundary=')
    })

    it('should upload files with createOrgFullScan', async () => {
      let capturedBody = ''
      let capturedHeaders: any = {}

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans')
        .reply(function (uri, requestBody) {
          capturedHeaders = this.req.headers
          capturedBody = requestBody as string
          return [
            200,
            {
              id: 'scan-456',
              org: 'test-org',
              status: 'processing',
              files: ['package.json', 'package-lock.json']
            }
          ]
        })

      const client = new SocketSdk('test-token')
      const res = await client.createOrgFullScan(
        'test-org',
        [packageJsonPath, packageLockPath],
        tempDir
      )

      expect(res.success).toBe(true)
      expect(res.data.id).toBe('scan-456')
      expect(res.data.org).toBe('test-org')
      expect(res.data.status).toBe('processing')

      // Verify multipart headers
      const contentType = Array.isArray(capturedHeaders['content-type'])
        ? capturedHeaders['content-type'][0]
        : capturedHeaders['content-type']
      expect(contentType).toContain('multipart/form-data')
    })

    it('should upload manifest files with uploadManifestFiles', async () => {
      let capturedHeaders: any = {}

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/upload-manifest-files')
        .reply(function (uri, requestBody) {
          capturedHeaders = this.req.headers
          return [
            200,
            {
              tarHash: 'abc123def456',
              unmatchedFiles: []
            }
          ]
        })

      const client = new SocketSdk('test-token')
      const res = await client.uploadManifestFiles(
        'test-org',
        [packageJsonPath, packageLockPath],
        tempDir
      )

      expect(res.success).toBe(true)
      expect(res.data.tarHash).toBe('abc123def456')
      expect(res.data.unmatchedFiles).toEqual([])

      // Verify multipart headers
      const contentType = Array.isArray(capturedHeaders['content-type'])
        ? capturedHeaders['content-type'][0]
        : capturedHeaders['content-type']
      expect(contentType).toContain('multipart/form-data')
    })

    it('should handle file upload with issueRules in createScanFromFilepaths', async () => {
      let capturedBody = ''
      let capturedHeaders: any = {}

      nock('https://api.socket.dev')
        .put('/v0/report/upload')
        .reply(function (uri, requestBody) {
          capturedHeaders = this.req.headers
          capturedBody = requestBody as string
          return [
            200,
            {
              id: 'report-789',
              status: 'complete'
            }
          ]
        })

      const client = new SocketSdk('test-token')
      const res = await client.createScanFromFilepaths(
        [packageJsonPath, packageLockPath],
        tempDir,
        {
          malware: true,
          typosquat: true,
          cve: false
        }
      )

      expect(res.success).toBe(true)
      expect(res.data).toBeDefined()

      // Verify multipart headers
      const contentType = Array.isArray(capturedHeaders['content-type'])
        ? capturedHeaders['content-type'][0]
        : capturedHeaders['content-type']
      expect(contentType).toContain('multipart/form-data')
      expect(contentType).toContain('boundary=')
    })

    it('should handle large file uploads with streaming', async () => {
      // Create a larger test file
      const largePath = join(tempDir, 'large-package-lock.json')
      const largeContent = {
        name: 'large-project',
        dependencies: {}
      }

      // Add many dependencies to simulate a large file
      for (let i = 0; i < 1000; i++) {
        largeContent.dependencies[`package-${i}`] = `^${i}.0.0`
      }

      writeFileSync(largePath, JSON.stringify(largeContent, null, 2))

      nock('https://api.socket.dev')
        .post('/v0/dependencies/upload')
        .reply(200, {
          id: 'large-snapshot',
          status: 'complete',
          files: ['large-package-lock.json']
        })

      const client = new SocketSdk('test-token')
      const res = await client.createDependenciesSnapshot([largePath], tempDir)

      expect(res.success).toBe(true)
      expect(res.data.id).toBe('large-snapshot')
    })

    it('should handle upload errors gracefully', async () => {
      nock('https://api.socket.dev')
        .post('/v0/dependencies/upload')
        .reply(413, {
          error: {
            message: 'Request entity too large'
          }
        })

      const client = new SocketSdk('test-token')
      const res = await client.createDependenciesSnapshot(
        [packageJsonPath],
        tempDir
      )

      expect(res.success).toBe(false)
      expect(res.status).toBe(413)
      expect(res.cause).toContain('Request entity too large')
    })

    it('should handle multiple files with different content types', async () => {
      // Create additional test files
      const readmePath = join(tempDir, 'README.md')
      const yarnLockPath = join(tempDir, 'yarn.lock')

      writeFileSync(readmePath, '# Test Project\n\nThis is a test project.')
      writeFileSync(
        yarnLockPath,
        '# THIS IS AN AUTOGENERATED FILE\n\nexpress@^4.18.0:\n  version "4.18.2"'
      )

      let capturedHeaders: any = {}

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans')
        .reply(function (uri, requestBody) {
          capturedHeaders = this.req.headers
          return [
            200,
            {
              id: 'multi-file-scan',
              org: 'test-org',
              status: 'complete',
              files: ['package.json', 'README.md', 'yarn.lock']
            }
          ]
        })

      const client = new SocketSdk('test-token')
      const res = await client.createOrgFullScan(
        'test-org',
        [packageJsonPath, readmePath, yarnLockPath],
        tempDir
      )

      expect(res.success).toBe(true)
      expect(res.data.files).toHaveLength(3)
      expect(res.data.files).toContain('package.json')
      expect(res.data.files).toContain('README.md')
      expect(res.data.files).toContain('yarn.lock')
    })

    it('should handle query parameters with file uploads', async () => {
      nock('https://api.socket.dev')
        .post('/v0/dependencies/upload?branch=main&commit=abc123')
        .reply(200, {
          id: 'params-snapshot',
          branch: 'main',
          commit: 'abc123'
        })

      const client = new SocketSdk('test-token')
      const res = await client.createDependenciesSnapshot(
        [packageJsonPath],
        tempDir,
        { branch: 'main', commit: 'abc123' }
      )

      expect(res.success).toBe(true)
      expect(res.data.branch).toBe('main')
      expect(res.data.commit).toBe('abc123')
    })

    it('should handle connection interruption during upload', async () => {
      nock('https://api.socket.dev')
        .post('/v0/dependencies/upload')
        .replyWithError(new Error('socket hang up'))

      const client = new SocketSdk('test-token')

      await expect(
        client.createDependenciesSnapshot([packageJsonPath], tempDir)
      ).rejects.toThrow()
    })

    it('should handle non-existent file paths', async () => {
      const nonExistentPath = join(tempDir, 'non-existent.json')

      // The SDK will attempt to read the file and fail with ENOENT
      const client = new SocketSdk('test-token')

      await expect(
        client.createDependenciesSnapshot([nonExistentPath], tempDir)
      ).rejects.toThrow()
    })
  })

  describe('Organization Management', () => {
    it('should create an organization repository', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos')
        .reply(200, {
          id: 'repo-123',
          name: 'test-repo',
          org: 'test-org',
          created_at: '2024-01-01T00:00:00Z'
        })

      const client = new SocketSdk('test-token')
      const res = await client.createOrgRepo('test-org', {
        name: 'test-repo',
        url: 'https://github.com/test/repo'
      })

      expect(res.success).toBe(true)
      expect(res.data.id).toBe('repo-123')
      expect(res.data.name).toBe('test-repo')
    })

    it('should get organization repository details', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/test-repo')
        .reply(200, {
          id: 'repo-123',
          name: 'test-repo',
          org: 'test-org',
          url: 'https://github.com/test/repo'
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgRepo('test-org', 'test-repo')

      expect(res.success).toBe(true)
      expect(res.data.id).toBe('repo-123')
      expect(res.data.name).toBe('test-repo')
    })

    it('should list organization repositories', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos')
        .reply(200, {
          repos: [
            { id: 'repo-1', name: 'repo-1' },
            { id: 'repo-2', name: 'repo-2' }
          ],
          total: 2
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgRepoList('test-org')

      expect(res.success).toBe(true)
      expect(res.data.repos).toHaveLength(2)
      expect(res.data.total).toBe(2)
    })

    it('should update organization repository', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/test-repo')
        .reply(200, {
          id: 'repo-123',
          name: 'test-repo',
          description: 'Updated description'
        })

      const client = new SocketSdk('test-token')
      const res = await client.updateOrgRepo('test-org', 'test-repo', {
        description: 'Updated description'
      })

      expect(res.success).toBe(true)
      expect(res.data.description).toBe('Updated description')
    })

    it('should delete organization repository', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/test-repo')
        .reply(200, { success: true })

      const client = new SocketSdk('test-token')
      const res = await client.deleteOrgRepo('test-org', 'test-repo')

      expect(res.success).toBe(true)
    })

    it('should get organization license policy', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/license-policy')
        .reply(200, {
          allowed: ['MIT', 'Apache-2.0'],
          denied: ['GPL-3.0'],
          policy: 'strict'
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgLicensePolicy('test-org')

      expect(res.success).toBe(true)
      expect(res.data.allowed).toContain('MIT')
      expect(res.data.denied).toContain('GPL-3.0')
    })

    it('should get audit log events', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/audit-log')
        .reply(200, {
          events: [
            {
              id: 'event-1',
              action: 'repo.create',
              actor: 'user@example.com',
              timestamp: '2024-01-01T00:00:00Z'
            }
          ],
          total: 1
        })

      const client = new SocketSdk('test-token')
      const res = await client.getAuditLogEvents('test-org')

      expect(res.success).toBe(true)
      expect(res.data.events).toHaveLength(1)
      expect(res.data.events[0].action).toBe('repo.create')
    })
  })

  describe('Full Scan Operations', () => {
    it('should get full scan list', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans')
        .reply(200, {
          scans: [
            { id: 'scan-1', status: 'complete' },
            { id: 'scan-2', status: 'processing' }
          ],
          total: 2
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgFullScanList('test-org')

      expect(res.success).toBe(true)
      expect(res.data.scans).toHaveLength(2)
    })

    it('should get full scan metadata', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123/metadata')
        .reply(200, {
          id: 'scan-123',
          created_at: '2024-01-01T00:00:00Z',
          files_count: 10,
          issues_count: 5
        })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgFullScanMetadata('test-org', 'scan-123')

      expect(res.success).toBe(true)
      expect(res.data.id).toBe('scan-123')
      expect(res.data.files_count).toBe(10)
    })

    it('should delete full scan', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/full-scans/scan-123')
        .reply(200, { success: true })

      const client = new SocketSdk('test-token')
      const res = await client.deleteOrgFullScan('test-org', 'scan-123')

      expect(res.success).toBe(true)
    })

    it('should stream full scan to stdout', async () => {
      const scanData = 'Full scan data content'
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/full-scans/scan-123')
        .reply(200, scanData)

      const client = new SocketSdk('test-token')
      const originalWrite = process.stdout.write
      let capturedOutput = ''
      process.stdout.write = (chunk: any) => {
        capturedOutput += chunk
        return true
      }

      const res = await client.getOrgFullScan('test-org', 'scan-123')

      process.stdout.write = originalWrite
      expect(res.success).toBe(true)
    })
  })

  describe('Analytics', () => {
    it('should get organization analytics', async () => {
      nock('https://api.socket.dev').get('/v0/analytics/org/30d').reply(200, {
        period: '30d',
        total_scans: 150,
        total_issues: 45,
        critical_issues: 5
      })

      const client = new SocketSdk('test-token')
      const res = await client.getOrgAnalytics('30d')

      expect(res.success).toBe(true)
      expect(res.data.period).toBe('30d')
      expect(res.data.total_scans).toBe(150)
    })

    it('should get repository analytics', async () => {
      nock('https://api.socket.dev')
        .get('/v0/analytics/repo/test-repo/7d')
        .reply(200, {
          repo: 'test-repo',
          period: '7d',
          commits: 25,
          issues_fixed: 10
        })

      const client = new SocketSdk('test-token')
      const res = await client.getRepoAnalytics('test-repo', '7d')

      expect(res.success).toBe(true)
      expect(res.data.repo).toBe('test-repo')
      expect(res.data.commits).toBe(25)
    })
  })

  describe('Scan and Report Operations', () => {
    it('should get scan by ID', async () => {
      nock('https://api.socket.dev')
        .get('/v0/report/view/scan-123')
        .reply(200, {
          id: 'scan-123',
          status: 'complete',
          issues: [],
          created_at: '2024-01-01T00:00:00Z'
        })

      const client = new SocketSdk('test-token')
      const res = await client.getScan('scan-123')

      expect(res.success).toBe(true)
      expect(res.data.id).toBe('scan-123')
      expect(res.data.status).toBe('complete')
    })

    it('should get scan list', async () => {
      nock('https://api.socket.dev')
        .get('/v0/report/list')
        .reply(200, {
          reports: [
            { id: 'scan-1', status: 'complete' },
            { id: 'scan-2', status: 'pending' }
          ],
          total: 2
        })

      const client = new SocketSdk('test-token')
      const res = await client.getScanList()

      expect(res.success).toBe(true)
      expect(res.data.reports).toHaveLength(2)
    })

    it('should get supported scan files', async () => {
      nock('https://api.socket.dev')
        .get('/v0/report/supported')
        .reply(200, {
          supported: [
            'package.json',
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml'
          ]
        })

      const client = new SocketSdk('test-token')
      const res = await client.getSupportedScanFiles()

      expect(res.success).toBe(true)
      expect(res.data.supported).toContain('package.json')
      expect(res.data.supported).toContain('yarn.lock')
    })
  })

  describe('Package Scoring', () => {
    it('should get score by NPM package', async () => {
      nock('https://api.socket.dev')
        .get('/v0/npm/express/4.18.0/score')
        .reply(200, {
          package: 'express',
          version: '4.18.0',
          score: {
            overall: 85,
            quality: 90,
            maintenance: 88,
            vulnerability: 75
          }
        })

      const client = new SocketSdk('test-token')
      const res = await client.getScoreByNpmPackage('express', '4.18.0')

      expect(res.success).toBe(true)
      expect(res.data.package).toBe('express')
      expect(res.data.score.overall).toBe(85)
    })
  })

  describe('Settings and Search', () => {
    it('should post settings', async () => {
      nock('https://api.socket.dev')
        .post('/v0/settings')
        .reply(200, {
          updated: true,
          settings: [{ organization: 'test-org' }]
        })

      const client = new SocketSdk('test-token')
      const res = await client.postSettings([{ organization: 'test-org' }])

      expect(res.success).toBe(true)
      expect(res.data.updated).toBe(true)
    })

    it('should search dependencies', async () => {
      nock('https://api.socket.dev')
        .post('/v0/dependencies/search')
        .reply(200, {
          results: [
            {
              name: 'express',
              version: '4.18.0',
              type: 'npm'
            },
            {
              name: 'lodash',
              version: '4.17.21',
              type: 'npm'
            }
          ],
          total: 2
        })

      const client = new SocketSdk('test-token')
      const res = await client.searchDependencies({
        query: 'express',
        type: 'npm'
      })

      expect(res.success).toBe(true)
      expect(res.data.results).toHaveLength(2)
      expect(res.data.results[0].name).toBe('express')
    })
  })

  describe('Batch Package Stream', () => {
    it('should handle batch package stream with chunks', async () => {
      const packages = [
        { purl: 'pkg:npm/package1@1.0.0' },
        { purl: 'pkg:npm/package2@1.0.0' },
        { purl: 'pkg:npm/package3@1.0.0' }
      ]

      // Mock two separate batch requests
      nock('https://api.socket.dev')
        .post('/v0/purl')
        .times(2)
        .reply(200, (uri, requestBody) => {
          const body = JSON.parse(requestBody as string)
          const response = body.components.map((c: any) => ({
            purl: c.purl,
            name: c.purl.split('/')[1].split('@')[0],
            version: c.purl.split('@')[1],
            alerts: []
          }))
          return response.map((r: any) => JSON.stringify(r)).join('\n')
        })

      const client = new SocketSdk('test-token')
      const results = []

      for await (const result of client.batchPackageStream(
        { components: packages },
        { chunkSize: 2, concurrencyLimit: 1 }
      )) {
        results.push(result)
      }

      // With 3 packages and chunkSize 2, we expect 2 batches (2+1)
      // But the stream yields one result per batch response
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].success).toBe(true)
    })
  })

  describe('Request Body Formation', () => {
    it('should create properly structured request body for file uploads', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'socket-sdk-test-'))
      const testFile1 = join(tempDir, 'test1.json')
      const testFile2 = join(tempDir, 'test2.json')
      const testContent1 = '{"test": 1}'
      const testContent2 = '{"test": 2}'

      try {
        writeFileSync(testFile1, testContent1)
        writeFileSync(testFile2, testContent2)

        const result = createRequestBodyForFilepaths(
          [testFile1, testFile2],
          tempDir
        )

        // Should have 2 entries, each being an array with 3 elements
        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(2)

        // Check first file entry
        expect(Array.isArray(result[0])).toBe(true)
        expect(result[0]).toHaveLength(3)

        const [contentDisposition1, contentType1, readStream1] = result[0]
        expect(typeof contentDisposition1).toBe('string')
        expect(contentDisposition1).toContain('Content-Disposition: form-data')
        expect(contentDisposition1).toContain('name="test1.json"')
        expect(contentDisposition1).toContain('filename="test1.json"')
        expect(typeof contentType1).toBe('string')
        expect(contentType1).toContain('Content-Type: application/octet-stream')
        expect(readStream1).toBeDefined()

        // Check second file entry
        expect(Array.isArray(result[1])).toBe(true)
        expect(result[1]).toHaveLength(3)

        const [contentDisposition2, contentType2, readStream2] = result[1]
        expect(typeof contentDisposition2).toBe('string')
        expect(contentDisposition2).toContain('Content-Disposition: form-data')
        expect(contentDisposition2).toContain('name="test2.json"')
        expect(contentDisposition2).toContain('filename="test2.json"')
        expect(typeof contentType2).toBe('string')
        expect(contentType2).toContain('Content-Type: application/octet-stream')
        expect(readStream2).toBeDefined()

        // Test that the read streams contain the correct content
        let streamContent1 = ''
        readStream1.on('data', (chunk: Buffer) => {
          streamContent1 += chunk.toString()
        })

        let streamContent2 = ''
        readStream2.on('data', (chunk: Buffer) => {
          streamContent2 += chunk.toString()
        })

        await Promise.all([
          new Promise<void>(resolve => {
            readStream1.on('end', () => {
              expect(streamContent1).toBe(testContent1)
              resolve()
            })
          }),
          new Promise<void>(resolve => {
            readStream2.on('end', () => {
              expect(streamContent2).toBe(testContent2)
              resolve()
            })
          })
        ])
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('Error Handling Edge Cases', () => {
    it('should handle 429 rate limit errors', async () => {
      nock('https://api.socket.dev')
        .get('/v0/quota')
        .reply(429, {
          error: {
            message: 'Rate limit exceeded',
            retry_after: 60
          }
        })

      const client = new SocketSdk('test-token')
      const res = await client.getQuota()

      expect(res.success).toBe(false)
      expect(res.status).toBe(429)
      expect(res.cause).toContain('Rate limit exceeded')
    })

    it('should handle 404 not found errors', async () => {
      nock('https://api.socket.dev')
        .get('/v0/report/view/non-existent')
        .reply(404, {
          error: {
            message: 'Report not found'
          }
        })

      const client = new SocketSdk('test-token')
      const res = await client.getScan('non-existent')

      expect(res.success).toBe(false)
      expect(res.status).toBe(404)
      expect(res.cause).toContain('Report not found')
    })

    it('should handle 400 bad request with validation errors', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos')
        .reply(400, {
          error: {
            message: 'Validation failed',
            details: {
              name: 'Repository name is required'
            }
          }
        })

      const client = new SocketSdk('test-token')
      const res = await client.createOrgRepo('test-org', {})

      expect(res.success).toBe(false)
      expect(res.status).toBe(400)
      expect(res.cause).toContain('Validation failed')
    })

    it('should handle empty response bodies for delete operations', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/test-repo')
        .reply(200, {})

      const client = new SocketSdk('test-token')
      const res = await client.deleteOrgRepo('test-org', 'test-repo')

      expect(res.success).toBe(true)
      expect(res.status).toBe(200)
    })
  })
})
