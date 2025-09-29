import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/index'

describe('Socket SDK - Policy Management', () => {
  let client: SocketSdk

  beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
    client = new SocketSdk('test-api-token')
  })

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(`pending nock mocks: ${nock.pendingMocks()}`)
    }
  })

  describe('updateOrgSecurityPolicy', () => {
    it('should update organization security policy', async () => {
      const policyData = {
        securityPolicyRules: {
          malware: 'error',
          'supply-chain-risk': 'warn',
        },
      }
      const mockResponse = { success: true, policy: policyData }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/settings/security-policy', policyData)
        .reply(200, mockResponse)

      const result = await client.updateOrgSecurityPolicy(
        'test-org',
        policyData,
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle invalid policy data', async () => {
      const policyData = { securityPolicyRules: { invalidRule: 'invalid' } }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/settings/security-policy', policyData)
        .reply(400, { error: { message: 'Invalid policy rule' } })

      const result = await client.updateOrgSecurityPolicy(
        'test-org',
        policyData,
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid policy rule')
      }
    })

    it('should handle URL encoding for organization slug', async () => {
      const policyData = { securityPolicyRules: { malware: 'warn' } }
      const mockResponse = { success: true }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test%40org/settings/security-policy', policyData)
        .reply(200, mockResponse)

      const result = await client.updateOrgSecurityPolicy(
        'test@org',
        policyData,
      )

      expect(result.success).toBe(true)
    })
  })

  describe('updateOrgLicensePolicy', () => {
    it('should update organization license policy', async () => {
      const policyData = {
        allowList: ['MIT', 'Apache-2.0'],
        denyList: ['GPL-3.0'],
      }
      const queryParams = { validate: true }
      const mockResponse = { success: true, policy: policyData }

      nock('https://api.socket.dev')
        .post(
          '/v0/orgs/test-org/settings/license-policy?validate=true',
          policyData,
        )
        .reply(200, mockResponse)

      const result = await client.updateOrgLicensePolicy(
        'test-org',
        policyData,
        queryParams,
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should work without query parameters', async () => {
      const policyData = { allowList: ['MIT'] }
      const mockResponse = { success: true, policy: policyData }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/settings/license-policy?', policyData)
        .reply(200, mockResponse)

      const result = await client.updateOrgLicensePolicy('test-org', policyData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle invalid license names', async () => {
      const policyData = { allowList: ['InvalidLicense'] }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/settings/license-policy?', policyData)
        .reply(400, { error: { message: 'Invalid license identifier' } })

      const result = await client.updateOrgLicensePolicy('test-org', policyData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid license identifier')
      }
    })
  })
})
