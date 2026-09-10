/**
 * @file Alert policy endpoint transport contracts.
 */
import nock from 'nock'
import { beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/index.mts'
import { setupNockEnvironment } from '../../utils/environment.mts'

const baseUrl = 'https://api.socket.dev/v0/'
let client: SocketSdk

beforeEach(() => {
  client = new SocketSdk('test-token', { baseUrl, retries: 0 })
})
const orgSlug = 'example/org'
const prefix = '/v0/orgs/example%2Forg/alert-policies'
const rule = {
  action: 'error',
  name: 'Block vulnerable packages',
  vigil_selector: { 'finding.alertType': 'criticalCVE' },
}

describe('alert policy API', () => {
  setupNockEnvironment()

  it.each([
    { path: prefix, request: () => client.getOrgAlertPolicies(orgSlug) },
    {
      path: `${prefix}/default`,
      request: () => client.getOrgAlertPolicy(orgSlug, 'default'),
    },
    {
      path: `${prefix}/default/rules`,
      request: () => client.getOrgAlertPolicyRules(orgSlug, 'default'),
    },
    {
      path: `${prefix}/default/rules/example%2Frule`,
      request: () =>
        client.getOrgAlertPolicyRule(orgSlug, 'default', 'example/rule'),
    },
    {
      path: `${prefix}/migration/status`,
      request: () => client.getOrgAlertPolicyMigrationStatus(orgSlug),
    },
  ])(
    'encodes organization and resource segments for $path',
    async ({ path, request }) => {
      nock('https://api.socket.dev').get(path).reply(200, { items: [] })
      expect(await request()).toMatchObject({
        success: true,
        status: 200,
        data: { items: [] },
      })
    },
  )

  it.each([
    {
      method: 'POST',
      path: prefix,
      body: { name: 'Release policy' },
      request: () =>
        client.createOrgAlertPolicy(
          orgSlug,
          { name: 'Release policy' },
          { dry_run: true },
        ),
    },
    {
      method: 'PUT',
      path: `${prefix}/default`,
      body: { description: 'Default checks' },
      request: () =>
        client.updateOrgAlertPolicy(
          orgSlug,
          'default',
          { description: 'Default checks' },
          { dry_run: true },
        ),
    },
    {
      method: 'POST',
      path: `${prefix}/default/rules`,
      body: rule,
      request: () =>
        client.createOrgAlertPolicyRule(orgSlug, 'default', rule, {
          dry_run: true,
        }),
    },
    {
      method: 'PUT',
      path: `${prefix}/default/rules/example-rule`,
      body: { action: 'warn' },
      request: () =>
        client.updateOrgAlertPolicyRule(
          orgSlug,
          'default',
          'example-rule',
          { action: 'warn' },
          { dry_run: true },
        ),
    },
  ])(
    'forwards dry-run $method $path without changing the response',
    async ({ method, path, body, request }) => {
      const response = { ...body, dry_run: true }
      nock('https://api.socket.dev')
        .intercept(path, method, body)
        .query({ dry_run: 'true' })
        .reply(200, response)
      expect(await request()).toMatchObject({
        success: true,
        status: 200,
        data: response,
      })
    },
  )

  it('preserves actual create status and selector response fields', async () => {
    const response = { ...rule, id: 'example-rule', dry_run: false }
    nock('https://api.socket.dev')
      .post(`${prefix}/default/rules`, rule)
      .reply(201, response)
    expect(
      await client.createOrgAlertPolicyRule(orgSlug, 'default', rule),
    ).toMatchObject({ success: true, status: 201, data: response })
  })

  it.each([
    {
      path: `${prefix}/example-policy`,
      request: () =>
        client.deleteOrgAlertPolicy(orgSlug, 'example-policy', {
          dry_run: true,
        }),
    },
    {
      path: `${prefix}/default/rules/example-rule`,
      request: () =>
        client.deleteOrgAlertPolicyRule(orgSlug, 'default', 'example-rule', {
          dry_run: true,
        }),
    },
  ])('sends DELETE dry-run query for $path', async ({ path, request }) => {
    nock('https://api.socket.dev')
      .delete(path)
      .query({ dry_run: 'true' })
      .reply(200, { dry_run: true })
    expect(await request()).toMatchObject({
      success: true,
      data: { dry_run: true },
    })
  })

  it('creates an alert resolution with its selector and dry-run option', async () => {
    const body = {
      reason: 'false_positive' as const,
      vigil_selector: rule.vigil_selector,
      comment: 'Reviewed package behavior',
    }
    nock('https://api.socket.dev')
      .post('/v0/orgs/example%2Forg/alerts/resolutions', body)
      .query({ dry_run: 'true' })
      .reply(200, { ...body, dry_run: true })
    expect(
      await client.createOrgAlertResolution(orgSlug, body, { dry_run: true }),
    ).toMatchObject({ status: 200, data: { ...body, dry_run: true } })
  })

  it('translates triage without dropping untranslatable entries', async () => {
    const body = {
      alertTriage: [
        { state: 'block' as const, packageName: 'example-package' },
      ],
    }
    const response = {
      translations: [],
      untranslatable: [{ reason: 'selector unsupported' }],
    }
    nock('https://api.socket.dev')
      .post(`${prefix}/migration/translate`, body)
      .reply(200, response)
    expect(
      await client.translateOrgAlertPolicyMigrationTriage(orgSlug, body),
    ).toMatchObject({ success: true, data: response })
  })

  it('reports migration conflicts', async () => {
    nock('https://api.socket.dev')
      .post(prefix, { name: 'Release policy' })
      .reply(409, {
        error: {
          message: 'Migration is pending',
          code: 'alert_policy_migration_pending',
        },
      })
    expect(
      await client.createOrgAlertPolicy(orgSlug, { name: 'Release policy' }),
    ).toMatchObject({ success: false, status: 409 })
  })
})
