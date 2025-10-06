/** @fileoverview Tests for organization security and license policy management. */
import nock from 'nock'
import { beforeEach, describe, it } from 'vitest'

import type { SocketSdk } from '../dist/index'

import { assertError, assertSuccess } from './utils/assertions.mts'
import { createTestClient, setupTestEnvironment } from './utils/environment.mts'

describe('Socket SDK - Policy Management', () => {
  setupTestEnvironment()

  let client: SocketSdk

  beforeEach(() => {
    client = createTestClient()
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
      assertSuccess(result)
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
      assertError(result, 400, 'Invalid policy rule')
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
      assertSuccess(result)
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
      assertSuccess(result)
    })

    it('should work without query parameters', async () => {
      const policyData = { allowList: ['MIT'] }
      const mockResponse = { success: true, policy: policyData }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/settings/license-policy?', policyData)
        .reply(200, mockResponse)

      const result = await client.updateOrgLicensePolicy('test-org', policyData)
      assertSuccess(result)
    })

    it('should handle invalid license names', async () => {
      const policyData = { allowList: ['InvalidLicense'] }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/settings/license-policy?', policyData)
        .reply(400, { error: { message: 'Invalid license identifier' } })

      const result = await client.updateOrgLicensePolicy('test-org', policyData)
      assertError(result, 400, 'Invalid license identifier')
    })
  })
})
