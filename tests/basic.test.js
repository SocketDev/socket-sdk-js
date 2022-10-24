const nock = require('nock')
const t = require('tap')

const { default: api } = require('../dist')

const client = api.auth('yetAnotherApiKey')

t.test('Endpoints', async t => {
  t.beforeEach(() => {
    console.log('hi')
    nock.cleanAll()
    nock.disableNetConnect()
  })

  t.afterEach(() => {
    console.log('hi2')
    if (!nock.isDone()) {
      throw new Error('pending nock mocks: ' + nock.pendingMocks())
    }
  })

  t.test('getQuota', async t => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(200, { quota: 1e9 })
    const res = await client.getQuota()
    t.same(res, { quota: 1e9 })
  })
  t.test('getIssuesByNPMPackage', async t => {
    t.test('must return empty issue list', async t => {
      nock('https://api.socket.dev')
        .get('/v0/npm/speed-limiter/1.0.0/issues')
        .reply(200, [])
      const res = await client.getIssuesByNPMPackage({
        package: 'speed-limiter',
        version: '1.0.0'
      })
      t.same(res, [])
    })
  })
})
