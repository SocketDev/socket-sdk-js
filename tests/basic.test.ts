import t from 'tap'
import api from '../'

const apiKey = process.env.SOCKET_API_KEY
const client = api.auth(apiKey)

const goodPackageJsonTestFile = '{ "dependencies": { "react": "18.0.0" } }'

t.test('Endpoints', async t => {
  t.test('getQuota', async t => {
    const res = await client.getQuota()
    t.same(res, { quota: 1e9 })
  })
  t.test('getIssuesByNPMPackage', async t => {
    t.test('must return empty issue list', async t => {
      const res = await client.getIssuesByNPMPackage({
        package: 'speed-limiter',
        version: '1.0.0'
      })
      t.same(res, [])
    })
  })
  t.test('getScoreByNPMPackage', async t => {
    t.test('must return scores', async t => {
      const resPromise = client.getScoreByNPMPackage({
        package: 'speed-limiter',
        version: '1.0.0'
      })
      t.resolves(resPromise)
    })
    t.test('must throw 404', async t => {
      const resPromise = client.getScoreByNPMPackage({
        package: 'speed-limiter',
        version: '1.0.0-fake-version'
      })
      t.rejects(resPromise)
    })
  })
  t.test('createReport', async t => {
    t.test('must return report id and url', async t => {
      const res = await client.createReport({
        'package.json': goodPackageJsonTestFile,
      })
      t.ok('id' in res)
      t.ok('url' in res)
    })
  })
  t.test('getReport', async t => {
    t.test('must return project report', async t => {
      const createReportRes = await client.createReport({
        'package.json': goodPackageJsonTestFile,
      })
      t.ok('id' in createReportRes)
      const res = await client.getReport({
        id: (createReportRes as any).id
      })
      t.ok('issues' in res)
      t.ok('score' in res)
    })
  })
})
