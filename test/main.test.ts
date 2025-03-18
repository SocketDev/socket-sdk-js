import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../dist/esm/index.js'

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
})
