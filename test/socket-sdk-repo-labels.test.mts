import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/index'

describe('Socket SDK - Repository Labels', () => {
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

  describe('createOrgRepoLabel', () => {
    it('should create a new repository label', async () => {
      const labelData = { name: 'New Label', color: '#00ff00' }
      const mockResponse = {
        label: { slug: 'new-label', ...labelData },
      }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/test-repo/labels', labelData)
        .reply(200, mockResponse)

      const result = await client.createOrgRepoLabel(
        'test-org',
        'test-repo',
        labelData,
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle URL encoding for parameters', async () => {
      const labelData = { name: 'Special Label' }
      const mockResponse = { label: { slug: 'special-label', ...labelData } }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test%40org/repos/test%2Brepo/labels', labelData)
        .reply(200, mockResponse)

      const result = await client.createOrgRepoLabel(
        'test@org',
        'test+repo',
        labelData,
      )

      expect(result.success).toBe(true)
    })

    it('should handle duplicate label names', async () => {
      const labelData = { name: 'Existing Label' }

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/repos/test-repo/labels', labelData)
        .reply(409, { error: { message: 'Label already exists' } })

      const result = await client.createOrgRepoLabel(
        'test-org',
        'test-repo',
        labelData,
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Label already exists')
      }
    })
  })

  describe('deleteOrgRepoLabel', () => {
    it('should delete a repository label', async () => {
      const mockResponse = { success: true }

      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/test-repo/labels/critical')
        .reply(200, mockResponse)

      const result = await client.deleteOrgRepoLabel(
        'test-org',
        'test-repo',
        'critical',
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle 404 for non-existent label', async () => {
      nock('https://api.socket.dev')
        .delete('/v0/orgs/test-org/repos/test-repo/labels/nonexistent')
        .reply(404, { error: { message: 'Label not found' } })

      const result = await client.deleteOrgRepoLabel(
        'test-org',
        'test-repo',
        'nonexistent',
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Label not found')
      }
    })
  })

  describe('getOrgRepoLabel', () => {
    it('should return specific repository label', async () => {
      const mockLabel = {
        label: { slug: 'critical', name: 'Critical', color: '#ff0000' },
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/test-repo/labels/critical')
        .reply(200, mockLabel)

      const result = await client.getOrgRepoLabel(
        'test-org',
        'test-repo',
        'critical',
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockLabel)
      }
    })

    it('should handle URL encoding for all parameters', async () => {
      const mockLabel = { label: { slug: 'special-label', name: 'Special' } }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test%40org/repos/test%2Brepo/labels/special%2Blabel')
        .reply(200, mockLabel)

      const result = await client.getOrgRepoLabel(
        'test@org',
        'test+repo',
        'special+label',
      )

      expect(result.success).toBe(true)
    })

    it('should handle server errors gracefully', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/test-repo/labels/critical')
        .reply(500, { error: { message: 'Internal server error' } })

      await expect(async () => {
        await client.getOrgRepoLabel('test-org', 'test-repo', 'critical')
      }).rejects.toThrow('Socket API server error (500)')
    })
  })

  describe('getOrgRepoLabelList', () => {
    it('should return list of repository labels', async () => {
      const mockLabels = {
        labels: [
          { slug: 'critical', name: 'Critical', color: '#ff0000' },
          { slug: 'internal', name: 'Internal', color: '#0000ff' },
        ],
      }

      nock('https://api.socket.dev')
        .get('/v0/orgs/test-org/repos/test-repo/labels')
        .reply(200, mockLabels)

      const result = await client.getOrgRepoLabelList('test-org', 'test-repo')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockLabels)
      }
    })

    it('should handle empty label list', async () => {
      const mockLabels = { labels: [] }

      nock('https://api.socket.dev')
        .get('/v0/orgs/empty-org/repos/empty-repo/labels')
        .reply(200, mockLabels)

      const result = await client.getOrgRepoLabelList('empty-org', 'empty-repo')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockLabels)
      }
    })

    it('should handle 403 unauthorized access', async () => {
      nock('https://api.socket.dev')
        .get('/v0/orgs/forbidden-org/repos/test-repo/labels')
        .reply(403, { error: { message: 'Access denied' } })

      const result = await client.getOrgRepoLabelList(
        'forbidden-org',
        'test-repo',
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Access denied')
      }
    })
  })

  describe('updateOrgRepoLabel', () => {
    it('should update a repository label', async () => {
      const labelData = { name: 'Updated Label', color: '#ffff00' }
      const mockResponse = {
        label: { slug: 'critical', ...labelData },
      }

      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/repos/test-repo/labels/critical', labelData)
        .reply(200, mockResponse)

      const result = await client.updateOrgRepoLabel(
        'test-org',
        'test-repo',
        'critical',
        labelData,
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })

    it('should handle invalid color format', async () => {
      const labelData = { color: 'invalid-color' }

      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/repos/test-repo/labels/critical', labelData)
        .reply(400, { error: { message: 'Invalid color format' } })

      const result = await client.updateOrgRepoLabel(
        'test-org',
        'test-repo',
        'critical',
        labelData,
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid color format')
      }
    })

    it('should handle partial updates', async () => {
      const labelData = { name: 'Only Name Update' }
      const mockResponse = {
        label: { slug: 'critical', name: 'Only Name Update', color: '#ff0000' },
      }

      nock('https://api.socket.dev')
        .put('/v0/orgs/test-org/repos/test-repo/labels/critical', labelData)
        .reply(200, mockResponse)

      const result = await client.updateOrgRepoLabel(
        'test-org',
        'test-repo',
        'critical',
        labelData,
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockResponse)
      }
    })
  })
})
