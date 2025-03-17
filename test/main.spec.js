'use strict'

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const nock = require('nock')
const { ErrorWithCause } = require('pony-cause')

const { SocketSdk } = require('../dist/cjs/index.js')

chai.use(chaiAsPromised)
chai.should()

process.on('unhandledRejection', cause => {
  throw new ErrorWithCause('Unhandled rejection', { cause })
})

chai.describe('SocketSdk', () => {
  chai.beforeEach(() => {
    nock.cleanAll()
    nock.disableNetConnect()
  })

  chai.afterEach(() => {
    if (!nock.isDone()) {
      throw new Error('pending nock mocks: ' + nock.pendingMocks())
    }
  })

  chai.describe('basics', () => {
    chai.it('should be able to instantiate itself', () => {
      const client = new SocketSdk('yetAnotherApiKey')
      client.should.be.ok
    })
  })

  chai.describe('getQuota', () => {
    chai.it('should return quota from getQuota', async () => {
      nock('https://api.socket.dev').get('/v0/quota').reply(200, { quota: 1e9 })

      const client = new SocketSdk('yetAnotherApiKey')

      const res = await client.getQuota()

      res.should.deep.equal({
        success: true,
        status: 200,
        data: { quota: 1e9 }
      })
    })
  })

  chai.describe('getIssuesByNPMPackage', () => {
    chai.it(
      'should return an empty issue list on an empty response',
      async () => {
        nock('https://api.socket.dev')
          .get('/v0/npm/speed-limiter/1.0.0/issues')
          .reply(200, [])

        const client = new SocketSdk('yetAnotherApiKey')

        const res = await client.getIssuesByNPMPackage('speed-limiter', '1.0.0')

        res.should.deep.equal({
          success: true,
          status: 200,
          data: []
        })
      }
    )
  })
})
