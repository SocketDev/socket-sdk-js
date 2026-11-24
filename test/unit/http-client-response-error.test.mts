/**
 * @file HTTP Client ResponseError edge-case tests. Covers the ResponseError
 *   constructor, isResponseOk status checks, and reshapeArtifactForPublicPolicy
 *   alert filtering.
 */
import { describe, expect, it } from 'vitest'

import {
  isResponseOk,
  reshapeArtifactForPublicPolicy,
  ResponseError,
} from '../../src/http-client.mts'

import type { HttpResponse } from '@socketsecurity/lib/http-request/response-types'

export function mockHttpResponse(
  overrides: Partial<Omit<HttpResponse, 'body'>> & {
    body?: Buffer | string | undefined
  },
): HttpResponse {
  const body =
    typeof overrides.body === 'string'
      ? Buffer.from(overrides.body)
      : (overrides.body ?? Buffer.alloc(0))
  const status = overrides.status ?? 200
  return {
    arrayBuffer: () =>
      body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength,
      ) as ArrayBuffer,
    body,
    headers: overrides.headers ?? {},
    json: () => JSON.parse(body.toString('utf8')),
    ok: overrides.ok ?? (status >= 200 && status < 300),
    status,
    statusText: overrides.statusText ?? '',
    text: () => body.toString('utf8'),
    ...(overrides.rawResponse ? { rawResponse: overrides.rawResponse } : {}),
  }
}

// =============================================================================
// ResponseError Edge Cases
// =============================================================================

describe('HTTP Client - ResponseError Edge Cases', () => {
  describe('ResponseError constructor', () => {
    it('should handle empty message parameter', () => {
      const response = mockHttpResponse({
        status: 500,
        statusText: 'Internal Server Error',
      })

      const error = new ResponseError(response)

      expect(error.message).toContain('Request failed')
      expect(error.message).toContain('500')
      expect(error.message).toContain('Internal Server Error')
      expect(error.name).toBe('ResponseError')
    })

    it('should handle custom message', () => {
      const response = mockHttpResponse({
        status: 404,
        statusText: 'Not Found',
      })

      const error = new ResponseError(response, 'Custom message')

      expect(error.message).toContain('Custom message')
      expect(error.message).toContain('404')
    })

    it('should handle missing status', () => {
      const response = mockHttpResponse({
        status: 0,
        statusText: 'Error',
      })

      const error = new ResponseError(response)

      // status 0 is truthy-ish but the message should show it
      expect(error.message).toContain('0')
    })

    it('should handle missing statusText', () => {
      const response = mockHttpResponse({
        status: 500,
        statusText: '',
      })

      const error = new ResponseError(response)

      expect(error.message).toContain('No status message')
    })

    it('should have response property', () => {
      const response = mockHttpResponse({
        status: 500,
        statusText: 'Error',
      })

      const error = new ResponseError(response)

      expect(error.response).toBe(response)
    })

    it('should handle both missing status and statusText', () => {
      const response = mockHttpResponse({
        status: 0,
        statusText: '',
      })

      const error = new ResponseError(response)

      expect(error.message).toContain('No status message')
    })

    it('should have proper error stack trace', () => {
      const response = mockHttpResponse({
        status: 500,
        statusText: 'Error',
      })

      const error = new ResponseError(response)

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ResponseError')
    })

    it('should use provided custom message', () => {
      const response = mockHttpResponse({
        status: 404,
        statusText: 'Not Found',
      })

      const error = new ResponseError(response, 'Custom operation failed')

      expect(error.message).toContain('Custom operation failed')
      expect(error.message).toContain('404')
      expect(error.message).toContain('Not Found')
    })
  })

  describe('isResponseOk', () => {
    it('should return true for 200 OK status', () => {
      const response = mockHttpResponse({ status: 200, ok: true })
      expect(isResponseOk(response)).toBe(true)
    })

    it('should return true for 201 Created status', () => {
      const response = mockHttpResponse({ status: 201, ok: true })
      expect(isResponseOk(response)).toBe(true)
    })

    it('should return true for 299 (edge of 2xx range)', () => {
      const response = mockHttpResponse({ status: 299, ok: true })
      expect(isResponseOk(response)).toBe(true)
    })

    it('should return false for 199 (below 2xx range)', () => {
      const response = mockHttpResponse({ status: 199, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 300 Redirect status', () => {
      const response = mockHttpResponse({ status: 300, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 400 Bad Request status', () => {
      const response = mockHttpResponse({ status: 400, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 404 Not Found status', () => {
      const response = mockHttpResponse({ status: 404, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false for 500 Server Error status', () => {
      const response = mockHttpResponse({ status: 500, ok: false })
      expect(isResponseOk(response)).toBe(false)
    })

    it('should return false when ok is false', () => {
      const response = mockHttpResponse({ ok: false })
      expect(isResponseOk(response)).toBe(false)
    })
  })

  describe('reshapeArtifactForPublicPolicy', () => {
    it('should return data unchanged when authenticated', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            alerts: [{ type: 'malware', severity: 'high', key: 'alert-1' }],
          },
        ],
      }
      const result = reshapeArtifactForPublicPolicy(data, {
        isAuthenticated: true,
      })
      expect(result).toEqual(data)
    })

    it('should filter low severity alerts when not authenticated', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            size: 1000,
            author: { name: 'test' },
            type: 'npm',
            supplyChainRisk: {},
            scorecards: {},
            topLevelAncestors: [],
            alerts: [
              { type: 'malware', severity: 'high', key: 'alert-1' },
              { type: 'issue', severity: 'low', key: 'alert-2' },
              { type: 'vulnerability', severity: 'medium', key: 'alert-3' },
            ],
          },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, {
        isAuthenticated: false,
      })

      expect(result.artifacts).toBeDefined()
      expect(result.artifacts?.[0]?.alerts).toHaveLength(2)
      expect(result.artifacts?.[0]?.alerts?.[0]?.severity).not.toBe('low')
      expect(result.artifacts?.[0]?.alerts?.[1]?.severity).not.toBe('low')
    })

    it('should filter alerts by action when actions parameter provided', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            size: 1000,
            author: { name: 'test' },
            type: 'npm',
            supplyChainRisk: {},
            scorecards: {},
            topLevelAncestors: [],
            alerts: [
              {
                type: 'malware',
                severity: 'high',
                key: 'alert-1',
              },
              {
                type: 'criticalCVE',
                severity: 'high',
                key: 'alert-2',
              },
              {
                type: 'deprecated',
                severity: 'high',
                key: 'alert-3',
              },
            ],
          },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, {
        actions: 'error',
        isAuthenticated: false,
      })

      expect(result.artifacts).toBeDefined()
      expect(result.artifacts?.[0]?.alerts).toHaveLength(1)
      expect(result.artifacts?.[0]?.alerts?.[0]?.key).toBe('alert-1')
    })

    it('should handle single artifact with alerts property', () => {
      const data = {
        name: 'test-package',
        version: '1.0.0',
        size: 1000,
        author: { name: 'test' },
        type: 'npm',
        supplyChainRisk: {},
        scorecards: {},
        topLevelAncestors: [],
        alerts: [
          { type: 'malware', severity: 'high', key: 'alert-1' },
          { type: 'issue', severity: 'low', key: 'alert-2' },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, {
        isAuthenticated: false,
      })

      expect(result.alerts).toBeDefined()
      expect(result.alerts).toHaveLength(1)
      expect(result.alerts?.[0]?.severity).toBe('high')
    })

    it('should compact alert objects to only essential fields', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            size: 1000,
            author: { name: 'test' },
            type: 'npm',
            supplyChainRisk: {},
            scorecards: {},
            topLevelAncestors: [],
            alerts: [
              {
                type: 'malware',
                severity: 'high',
                key: 'alert-1',
                description: 'This is a malware alert',
                extraData: { foo: 'bar' },
              },
            ],
          },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, {
        isAuthenticated: false,
      })

      expect(result.artifacts).toBeDefined()
      const alert = result.artifacts?.[0]?.alerts?.[0]
      expect(alert).toEqual({
        action: 'error',
        key: 'alert-1',
        severity: 'high',
        type: 'malware',
      })
      expect(alert).not.toHaveProperty('description')
      expect(alert).not.toHaveProperty('extraData')
    })

    it('should handle empty alerts array', () => {
      const data = {
        artifacts: [
          {
            name: 'test-package',
            version: '1.0.0',
            size: 1000,
            author: { name: 'test' },
            type: 'npm',
            supplyChainRisk: {},
            scorecards: {},
            topLevelAncestors: [],
            alerts: [],
          },
        ],
      }

      const result = reshapeArtifactForPublicPolicy(data, {
        isAuthenticated: false,
      })

      expect(result.artifacts).toBeDefined()
      expect(result.artifacts?.[0]?.alerts).toEqual([])
    })

    it('should handle data without artifacts or alerts property', () => {
      const data = {
        name: 'test',
        value: 123,
      }

      const result = reshapeArtifactForPublicPolicy(data, {
        isAuthenticated: false,
      })

      expect(result).toEqual(data)
    })
  })
})
