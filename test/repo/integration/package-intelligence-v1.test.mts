/**
 * @file Authenticated package intelligence requests against a local API server.
 */
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

import { describe, expect, it } from 'vitest'
import { rolldown } from 'rolldown'
import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'

import { SocketSdk } from '../../../src/socket-sdk-class.mts'
import { browserBuildConfig } from '../../../.config/repo/rolldown.browser.config.mts'

import type { IncomingMessage, Server, ServerResponse } from 'node:http'

interface CapturedRequest {
  authorization: string | undefined
  body: string
  method: string | undefined
  url: string | undefined
}

interface LocalApiServer {
  baseUrl: string
  close(): Promise<void>
  server: Server
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  request.setEncoding('utf8')
  const chunks: string[] = []
  return await new Promise<string>((resolve, reject) => {
    request.on('data', (chunk: string) => chunks.push(chunk))
    request.once('end', () => resolve(chunks.join('')))
    request.once('error', reject)
  })
}

async function startLocalApiServer(
  handleRequest: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => void | Promise<void>,
): Promise<LocalApiServer> {
  const server = createServer((request, response) => {
    void handleRequest(request, response)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Missing local API server port')
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}/`,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
    },
    server,
  }
}

function respondJson(
  response: ServerResponse,
  status: number,
  data: unknown,
): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(data))
}

describe('package intelligence SDK transport', () => {
  it('preserves ordered duplicate checks and summary artifacts', async () => {
    const captured: CapturedRequest[] = []
    const checksData = {
      context: {
        mode: 'organization',
        organizationSlug: 'team/blue',
        policyScope: 'organization-default',
        policyRevision: 17,
      },
      results: [
        {
          index: 0,
          inputPurl: 'pkg:npm/example@1.0.0',
          resolvedPurls: ['pkg:npm/example@1.0.0'],
          status: 'pending',
          action: 'indeterminate',
          reasons: [{ code: 'analysis_pending' }],
          coverage: {
            scope: 'published-artifacts',
            complete: false,
            artifactCount: 1,
            evaluatedArtifactCount: 0,
            reason: 'analysis_incomplete',
          },
          freshness: {
            evaluatedAt: '2026-10-10T00:00:00Z',
            analysisAt: null,
            source: 'artifact-state',
            state: 'unknown',
          },
        },
        {
          index: 1,
          inputPurl: 'pkg:npm/example@1.0.0',
          resolvedPurls: [],
          status: 'unsupported',
          action: 'indeterminate',
          reasons: [{ code: 'unsupported_identity' }],
          coverage: {
            scope: 'published-artifacts',
            complete: false,
            artifactCount: 0,
            evaluatedArtifactCount: 0,
            reason: 'metadata_unavailable',
          },
          freshness: {
            evaluatedAt: '2026-10-10T00:00:00Z',
            analysisAt: null,
            source: 'artifact-state',
            state: 'unknown',
          },
        },
        {
          index: 2,
          inputPurl: 'pkg:npm/missing@1.0.0',
          resolvedPurls: [],
          status: 'unknown',
          action: 'indeterminate',
          reasons: [{ code: 'metadata_unavailable' }],
          coverage: {
            scope: 'published-artifacts',
            complete: false,
            artifactCount: 0,
            evaluatedArtifactCount: 0,
            reason: 'metadata_unavailable',
          },
          freshness: {
            evaluatedAt: '2026-10-10T00:00:00Z',
            analysisAt: null,
            source: 'artifact-state',
            state: 'unknown',
          },
        },
        {
          index: 3,
          inputPurl: 'pkg:npm/temporarily-unavailable@1.0.0',
          resolvedPurls: [],
          status: 'error',
          action: 'indeterminate',
          reasons: [{ code: 'lookup_failed' }],
          coverage: {
            scope: 'published-artifacts',
            complete: false,
            artifactCount: 0,
            evaluatedArtifactCount: 0,
            reason: 'lookup_failed',
          },
          freshness: {
            evaluatedAt: '2026-10-10T00:00:00Z',
            analysisAt: null,
            source: 'artifact-state',
            state: 'unknown',
          },
        },
      ],
    }
    const summariesData = {
      context: checksData.context,
      results: [
        {
          index: 0,
          inputPurl: 'pkg:npm/example@1.0.0',
          resolvedPurls: ['pkg:npm/example@1.0.0'],
          status: 'complete',
          action: 'warn',
          reasons: [{ code: 'policy_warn' }],
          coverage: {
            scope: 'published-artifacts',
            complete: true,
            artifactCount: 1,
            evaluatedArtifactCount: 1,
            reason: null,
          },
          freshness: {
            evaluatedAt: '2026-10-10T00:00:00Z',
            analysisAt: null,
            source: 'artifact-state',
            state: 'current',
          },
          artifacts: [
            {
              reference: 'npm:example@1.0.0',
              purl: 'pkg:npm/example@1.0.0',
              state: 'complete',
              scores: {
                supplyChain: 91,
                quality: 82,
                maintenance: 73,
                vulnerability: 64,
                license: 55,
                overall: 77,
              },
              alerts: [
                {
                  key: 'SOCKET-EXAMPLE',
                  type: 'HighRiskPackage',
                  action: 'warn',
                },
              ],
              detailUrl:
                'https://socket.dev/npm/package/example/overview/1.0.0',
            },
          ],
          alerts: [
            {
              key: 'SOCKET-EXAMPLE',
              type: 'HighRiskPackage',
              action: 'warn',
              artifactPurls: ['pkg:npm/example@1.0.0'],
            },
          ],
        },
        {
          index: 1,
          inputPurl: 'pkg:npm/stale@1.0.0',
          resolvedPurls: ['pkg:npm/stale@1.0.0'],
          status: 'unknown',
          action: 'indeterminate',
          reasons: [{ code: 'analysis_stale' }],
          coverage: {
            scope: 'published-artifacts',
            complete: false,
            artifactCount: 1,
            evaluatedArtifactCount: 0,
            reason: 'analysis_incomplete',
          },
          freshness: {
            evaluatedAt: '2026-10-10T00:00:00Z',
            analysisAt: null,
            source: 'artifact-state',
            state: 'stale',
          },
          artifacts: [
            {
              reference: 'npm:stale@1.0.0',
              purl: 'pkg:npm/stale@1.0.0',
              state: 'pending',
              scores: null,
              alerts: [],
              detailUrl: 'https://socket.dev/npm/package/stale/overview/1.0.0',
            },
          ],
          alerts: [],
        },
      ],
    }
    const local = await startLocalApiServer(async (request, response) => {
      const body = await readRequestBody(request)
      captured.push({
        authorization: request.headers.authorization,
        body,
        method: request.method,
        url: request.url,
      })
      if (request.url?.endsWith('/packages/checks')) {
        respondJson(response, 200, checksData)
      } else {
        respondJson(response, 200, summariesData)
      }
    })
    const body = {
      packages: [
        { purl: 'pkg:npm/example@1.0.0' },
        { purl: 'pkg:npm/example@1.0.0' },
      ],
    }
    const sdk = new SocketSdk('basic-token', {
      apiV1BaseUrl: `${local.baseUrl}custom/v1/`,
      authScheme: 'basic',
      baseUrl: `${local.baseUrl}v0/`,
      retries: 0,
    })
    const bearerSdk = new SocketSdk('constructor-token', {
      apiV1BaseUrl: `${local.baseUrl}custom/v1/`,
      baseUrl: `${local.baseUrl}v0/`,
      authProvider: async () => ({
        token: 'rotated-token',
        authScheme: 'bearer',
      }),
      retries: 0,
    })
    try {
      const checks = await sdk.postOrgPackageChecks('team/blue', body)
      const summaries = await bearerSdk.postOrgPackageSummaries(
        'team/blue',
        body,
      )
      expect(checks).toEqual({
        data: checksData,
        status: 200,
        success: true,
      })
      expect(summaries).toEqual({
        data: summariesData,
        status: 200,
        success: true,
      })
      expect(
        captured.map(({ authorization, method, url }) => ({
          authorization,
          method,
          url,
        })),
      ).toEqual([
        {
          authorization: `Basic ${Buffer.from('basic-token:').toString('base64')}`,
          method: 'POST',
          url: '/custom/v1/orgs/team%2Fblue/packages/checks',
        },
        {
          authorization: 'Bearer rotated-token',
          method: 'POST',
          url: '/custom/v1/orgs/team%2Fblue/packages/summaries',
        },
      ])
      expect(
        captured.map(({ body: requestBody }) => JSON.parse(requestBody)),
      ).toEqual([body, body])
    } finally {
      await local.close()
    }
  })

  it.each([401, 403, 404])(
    'returns HTTP %s without v0 fallback or retries',
    async status => {
      const paths: Array<string | undefined> = []
      const local = await startLocalApiServer(async (request, response) => {
        paths.push(request.url)
        await readRequestBody(request)
        respondJson(response, status, {
          error: 'request_failed',
          message: 'Package intelligence request failed',
        })
      })
      const sdk = new SocketSdk('test-token', {
        apiV1BaseUrl: `${local.baseUrl}api/v1/`,
        baseUrl: `${local.baseUrl}v0/`,
        retries: 2,
        retryDelay: 1,
      })
      try {
        const result = await sdk.postOrgPackageChecks('example-org', {
          packages: [{ purl: 'pkg:npm/example@1.0.0' }],
        })
        expect(result.success).toBe(false)
        expect(result.status).toBe(status)
        expect(paths).toEqual(['/api/v1/orgs/example-org/packages/checks'])
      } finally {
        await local.close()
      }
    },
  )

  it('returns quota errors without changing their status', async () => {
    const paths: Array<string | undefined> = []
    const local = await startLocalApiServer(async (request, response) => {
      paths.push(request.url)
      await readRequestBody(request)
      respondJson(response, 429, {
        error: 'quota_exceeded',
        message: 'Package checks require 100 quota units',
      })
    })
    const sdk = new SocketSdk('test-token', {
      apiV1BaseUrl: `${local.baseUrl}api/v1/`,
      baseUrl: `${local.baseUrl}v0/`,
      retries: 0,
    })
    try {
      const result = await sdk.postOrgPackageChecks('example-org', {
        packages: [{ purl: 'pkg:npm/example@1.0.0' }],
      })
      expect(result.success).toBe(false)
      expect(result.status).toBe(429)
      expect(paths).toEqual(['/api/v1/orgs/example-org/packages/checks'])
    } finally {
      await local.close()
    }
  })

  it('rejects invalid runtime request shapes before dispatch', async () => {
    let requestCount = 0
    const local = await startLocalApiServer(async request => {
      requestCount += 1
      await readRequestBody(request)
    })
    const sdk = new SocketSdk('test-token', {
      apiV1BaseUrl: `${local.baseUrl}v1/`,
      baseUrl: `${local.baseUrl}v0/`,
      retries: 0,
    })
    const packageEntry = {
      purl: 'pkg:npm/example@1.0.0',
      metadata: true,
    }
    const body = { packages: [packageEntry] }
    try {
      await expect(
        sdk.postOrgPackageChecks('example-org', body),
      ).rejects.toThrow(TypeError)
      expect(requestCount).toBe(0)
    } finally {
      await local.close()
    }
  })

  it('honors cancellation after the request reaches the API', async () => {
    let requestReceived: () => void = () => undefined
    const received = new Promise<void>(resolve => {
      requestReceived = resolve
    })
    const local = await startLocalApiServer(async request => {
      await readRequestBody(request)
      requestReceived()
    })
    const controller = new AbortController()
    const sdk = new SocketSdk('test-token', {
      apiV1BaseUrl: `${local.baseUrl}v1/`,
      baseUrl: `${local.baseUrl}v0/`,
      retries: 0,
      signal: controller.signal,
    })
    try {
      const resultPromise = sdk.postOrgPackageSummaries('example-org', {
        packages: [{ purl: 'pkg:npm/example@1.0.0' }],
      })
      await received
      controller.abort(new Error('cancelled by caller'))
      await expect(resultPromise).rejects.toMatchObject({
        cause: { cause: { code: 'ABORT_ERR' } },
        message: 'Unexpected Socket API error',
      })
    } finally {
      await local.close()
    }
  })

  it('uses the browser bundle transport for package checks', async () => {
    const local = await startLocalApiServer(async (request, response) => {
      await readRequestBody(request)
      respondJson(response, 200, {
        context: {
          mode: 'organization',
          organizationSlug: 'example-org',
          policyScope: 'organization-default',
          policyRevision: 1,
        },
        results: [],
      })
    })
    const outputDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'sdk-package-intelligence-browser-'),
    )
    const { output, ...buildOptions } = browserBuildConfig
    const bundle = await rolldown(buildOptions)
    try {
      await bundle.write({
        ...output,
        dir: outputDirectory,
        entryFileNames: '[name].mjs',
      })
    } catch (error) {
      await bundle.close()
      await local.close()
      await safeDelete(outputDirectory)
      throw error
    }
    await bundle.close()
    try {
      const browserSdkModule: typeof import('../../../src/index.mts') =
        await import(
          pathToFileURL(path.join(outputDirectory, 'index.browser.mjs')).href
        )
      const sdk = new browserSdkModule.SocketSdk('browser-token', {
        apiV1BaseUrl: `${local.baseUrl}v1/`,
        baseUrl: `${local.baseUrl}v0/`,
        retries: 0,
      })
      const result = await sdk.postOrgPackageChecks('example-org', {
        packages: [{ purl: 'pkg:npm/example@1.0.0' }],
      })
      expect(result).toMatchObject({
        status: 200,
        success: true,
        data: {
          context: { policyScope: 'organization-default' },
          results: [],
        },
      })
    } finally {
      await local.close()
      await safeDelete(outputDirectory)
    }
  })
})
