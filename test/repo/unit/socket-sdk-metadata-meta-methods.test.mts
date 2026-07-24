/**
 * @file Tests for the metadata, org-settings, license-policy, and meta
 *   (OpenAPI) Socket SDK methods added for SURF-195 API parity.
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../../utils/environment.mts'

describe('Socket SDK - Metadata, settings, license-policy & meta methods (SURF-195)', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  describe('alertTypes', () => {
    it('should return metadata for the requested alert types', async () => {
      nock('https://api.socket.dev')
        .post('/v0/alert-types', ['malware', 'gptSecurity'])
        .query({ language: 'en-US' })
        .reply(200, [
          { type: 'malware', title: 'Malware', description: 'x' },
          { type: 'gptSecurity', title: 'AI Security', description: 'y' },
        ])

      const result = await getClient().alertTypes(['malware', 'gptSecurity'], {
        language: 'en-US',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
      }
    })

    it('should handle error responses for alertTypes', async () => {
      nock('https://api.socket.dev')
        .post('/v0/alert-types')
        .reply(400, { error: { message: 'Invalid alert type' } })

      const result = await getClient().alertTypes(['nope'])

      expect(result.success).toBe(false)
    })
  })

  describe('licenseMetadata', () => {
    it('should return metadata for the requested licenses', async () => {
      nock('https://api.socket.dev')
        .post('/v0/license-metadata')
        .query({ includetext: 'true' })
        .reply(200, { MIT: { name: 'MIT License' } })

      const result = await getClient().licenseMetadata(
        { licenses: ['MIT'] },
        { includetext: true },
      )

      expect(result.success).toBe(true)
    })

    it('should handle error responses for licenseMetadata', async () => {
      nock('https://api.socket.dev')
        .post('/v0/license-metadata')
        .reply(400, { error: { message: 'Bad request' } })

      const result = await getClient().licenseMetadata({})

      expect(result.success).toBe(false)
    })
  })

  describe('getIntegrationEvents', () => {
    it('should list integration events', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/integrations/int-1/events')
        .reply(200, { events: [{ id: 'evt-1' }] })

      const result = await getClient().getIntegrationEvents('test-org', 'int-1')

      expect(result.success).toBe(true)
    })

    it('should handle error responses for getIntegrationEvents', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/integrations/int-1/events')
        .reply(404, { error: { message: 'Integration not found' } })

      const result = await getClient().getIntegrationEvents('test-org', 'int-1')

      expect(result.success).toBe(false)
    })
  })

  describe('getSocketBasicsConfig', () => {
    it('should return the Socket Basics config', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/socket-basics')
        .reply(200, { enabled: true })

      const result = await getClient().getSocketBasicsConfig('test-org')

      expect(result.success).toBe(true)
    })

    it('should handle error responses for getSocketBasicsConfig', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/socket-basics')
        .reply(403, { error: { message: 'Insufficient permissions' } })

      const result = await getClient().getSocketBasicsConfig('test-org')

      expect(result.success).toBe(false)
    })
  })

  describe('viewLicensePolicy', () => {
    it('should return the license policy view', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/license-policy/view')
        .reply(200, { allowed: ['MIT'] })

      const result = await getClient().viewLicensePolicy('test-org')

      expect(result.success).toBe(true)
    })

    it('should handle error responses for viewLicensePolicy', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/settings/license-policy/view')
        .reply(404, { error: { message: 'Not found' } })

      const result = await getClient().viewLicensePolicy('test-org')

      expect(result.success).toBe(false)
    })
  })

  describe('licensePolicy', () => {
    it('should parse the newline-delimited violations stream', async () => {
      const ndjson =
        JSON.stringify({
          filepathOrProvenance: ['package.json'],
          level: 'error',
          purl: 'pkg:npm/foo@1.0.0',
          spdxAtomOrExtraData: 'GPL-3.0',
          violationExplanation: 'Disallowed license',
        }) +
        '\n' +
        JSON.stringify({
          filepathOrProvenance: ['package.json'],
          level: 'warn',
          purl: 'pkg:npm/bar@2.0.0',
          spdxAtomOrExtraData: 'LGPL-3.0',
          violationExplanation: 'Monitored license',
        }) +
        '\n'

      nock('https://api.socket.dev')
        .post('/v0/license-policy')
        .reply(200, ndjson, { 'content-type': 'application/x-ndjson' })

      const result = await getClient().licensePolicy({
        components: [{ purl: 'pkg:npm/foo@1.0.0' }],
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
        expect(result.data[0]?.purl).toBe('pkg:npm/foo@1.0.0')
        expect(result.data[1]?.level).toBe('warn')
      }
    })

    it('should handle error responses for licensePolicy', async () => {
      nock('https://api.socket.dev')
        .post('/v0/license-policy')
        .reply(400, { error: { message: 'Invalid request' } })

      const result = await getClient().licensePolicy({})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('getOpenAPI', () => {
    it('should return the OpenAPI definition', async () => {
      nock('https://api.socket.dev')
        .get('/v0/openapi')
        .reply(200, { openapi: '3.0.0', info: { title: 'Socket' } })

      const result = await getClient().getOpenAPI()

      expect(result.success).toBe(true)
    })

    it('should handle error responses for getOpenAPI', async () => {
      nock('https://api.socket.dev')
        .get('/v0/openapi')
        .reply(429, { error: { message: 'Rate limited' } })

      const result = await getClient().getOpenAPI()

      expect(result.success).toBe(false)
    })
  })

  describe('getOpenAPIJSON', () => {
    it('should return the OpenAPI definition as JSON', async () => {
      nock('https://api.socket.dev')
        .get('/v0/openapi.json')
        .reply(200, { openapi: '3.0.0', info: { title: 'Socket' } })

      const result = await getClient().getOpenAPIJSON()

      expect(result.success).toBe(true)
    })

    it('should handle error responses for getOpenAPIJSON', async () => {
      nock('https://api.socket.dev')
        .get('/v0/openapi.json')
        .reply(429, { error: { message: 'Rate limited' } })

      const result = await getClient().getOpenAPIJSON()

      expect(result.success).toBe(false)
    })
  })
})
