/**
 * @file Tests for the repository-label-setting and alert-triage Socket SDK
 *   methods added for SURF-195 API parity.
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../../utils/environment.mts'

describe('Socket SDK - Repo label settings & triage methods (SURF-195)', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  describe('associateOrgRepoLabel', () => {
    it('should associate a repository with a label', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/labels/label-1/associate', {
          repository_id: 'repo-9',
        })
        .reply(200, { success: true })

      const result = await getClient().associateOrgRepoLabel(
        'test-org',
        'label-1',
        'repo-9',
      )

      expect(result.success).toBe(true)
    })

    it('should handle error responses for associateOrgRepoLabel', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/labels/label-1/associate')
        .reply(404, { error: { message: 'Label not found' } })

      const result = await getClient().associateOrgRepoLabel(
        'test-org',
        'label-1',
        'repo-9',
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('disassociateOrgRepoLabel', () => {
    it('should disassociate a repository from a label', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/labels/label-1/disassociate', {
          repository_id: 'repo-9',
        })
        .reply(200, { success: true })

      const result = await getClient().disassociateOrgRepoLabel(
        'test-org',
        'label-1',
        'repo-9',
      )

      expect(result.success).toBe(true)
    })

    it('should handle error responses for disassociateOrgRepoLabel', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/labels/label-1/disassociate')
        .reply(403, { error: { message: 'Insufficient permissions' } })

      const result = await getClient().disassociateOrgRepoLabel(
        'test-org',
        'label-1',
        'repo-9',
      )

      expect(result.success).toBe(false)
    })
  })

  describe('getOrgRepoLabelSetting', () => {
    it('should fetch a label setting by key', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/labels/label-1/label-setting')
        .query({ setting_key: 'issueRules' })
        .reply(200, { key: 'issueRules', value: { gptSecurity: 'error' } })

      const result = await getClient().getOrgRepoLabelSetting(
        'test-org',
        'label-1',
        'issueRules',
      )

      expect(result.success).toBe(true)
      if (result.success) {
        const data = result.data as unknown as { key: string }
        expect(data.key).toBe('issueRules')
      }
    })

    it('should handle error responses for getOrgRepoLabelSetting', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/labels/label-1/label-setting')
        .query(true)
        .reply(404, { error: { message: 'Setting not found' } })

      const result = await getClient().getOrgRepoLabelSetting(
        'test-org',
        'label-1',
        'missing',
      )

      expect(result.success).toBe(false)
    })
  })

  describe('updateOrgRepoLabelSetting', () => {
    it('should update a label setting body', async () => {
      const body = {
        issueRules: { gptSecurity: { action: 'error' as const } },
      }

      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/repos/labels/label-1/label-setting', body)
        .reply(200, { success: true })

      const result = await getClient().updateOrgRepoLabelSetting(
        'test-org',
        'label-1',
        body,
      )

      expect(result.success).toBe(true)
    })

    it('should handle error responses for updateOrgRepoLabelSetting', async () => {
      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/repos/labels/label-1/label-setting')
        .reply(400, { error: { message: 'Invalid settings' } })

      const result = await getClient().updateOrgRepoLabelSetting(
        'test-org',
        'label-1',
        {},
      )

      expect(result.success).toBe(false)
    })
  })

  describe('deleteOrgRepoLabelSetting', () => {
    it('should delete a label setting by key', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/labels/label-1/label-setting')
        .query({ setting_key: 'issueRules' })
        .reply(200, { success: true })

      const result = await getClient().deleteOrgRepoLabelSetting(
        'test-org',
        'label-1',
        'issueRules',
      )

      expect(result.success).toBe(true)
    })

    it('should handle error responses for deleteOrgRepoLabelSetting', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/labels/label-1/label-setting')
        .query(true)
        .reply(404, { error: { message: 'Setting not found' } })

      const result = await getClient().deleteOrgRepoLabelSetting(
        'test-org',
        'label-1',
        'missing',
      )

      expect(result.success).toBe(false)
    })
  })

  describe('deleteOrgAlertTriage', () => {
    it('should delete a triage entry by uuid', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/triage/alerts/uuid-123')
        .reply(200, { success: true })

      const result = await getClient().deleteOrgAlertTriage(
        'test-org',
        'uuid-123',
      )

      expect(result.success).toBe(true)
    })

    it('should handle error responses for deleteOrgAlertTriage', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/triage/alerts/uuid-123')
        .reply(404, { error: { message: 'Triage not found' } })

      const result = await getClient().deleteOrgAlertTriage(
        'test-org',
        'uuid-123',
      )

      expect(result.success).toBe(false)
    })
  })
})
