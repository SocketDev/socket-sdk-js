/**
 * @file Security SDK API methods through an owned local HTTP server.
 */

import { describe, expect, it } from 'vitest'
import { setupSdkCoverageClient } from '../../utils/sdk-api-coverage-client.mts'

describe('Security SDK API methods', () => {
  const fixture = setupSdkCoverageClient()

  describe('Analytics Methods', () => {
    it('covers getOrgAnalytics', async () => {
      const result = await fixture.client.getOrgAnalytics('test-org')
      expect(result.success).toBe(true)
    })

    it('covers getRepoAnalytics', async () => {
      const result = await fixture.client.getRepoAnalytics(
        'test-org',
        'test-repo',
      )
      expect(result.success).toBe(true)
    })
  })

  describe('Policy Methods', () => {
    it('covers getOrgSecurityPolicy', async () => {
      const result = await fixture.client.getOrgSecurityPolicy('test-org')
      expect(result.success).toBe(true)
    })

    it('covers updateOrgSecurityPolicy', async () => {
      const result = await fixture.client.updateOrgSecurityPolicy('test-org', {
        enabled: true,
      })
      expect(result.success).toBe(true)
    })

    it('covers getOrgLicensePolicy', async () => {
      const result = await fixture.client.getOrgLicensePolicy('test-org')
      expect(result.success).toBe(true)
    })

    it('covers updateOrgLicensePolicy', async () => {
      const result = await fixture.client.updateOrgLicensePolicy('test-org', {
        enabled: true,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Telemetry Methods', () => {
    it('covers getOrgTelemetryConfig', async () => {
      const result = await fixture.client.getOrgTelemetryConfig('test-org')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.telemetry).toBeDefined()
        expect(result.data.telemetry.enabled).toBe(false)
      }
    })

    it('covers updateOrgTelemetryConfig', async () => {
      const result = await fixture.client.updateOrgTelemetryConfig('test-org', {
        enabled: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.telemetry).toBeDefined()
        expect(result.data.telemetry.enabled).toBe(true)
      }
    })

    it('covers postOrgTelemetry', async () => {
      const result = await fixture.client.postOrgTelemetry('test-org', {
        event: 'test-event',
        timestamp: Date.now(),
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data).toEqual({})
      }
    })
  })

  describe('Alerts Methods', () => {
    it('covers getOrgAlertsList without filters', async () => {
      const result = await fixture.client.getOrgAlertsList('test-org')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.items).toBeInstanceOf(Array)
        expect(result.data.items.length).toBeGreaterThan(0)
        if (result.data.items[0]) {
          expect(result.data.items[0].id).toBe('alert-1')
          expect(result.data.items[0].status).toBe('open')
          expect(result.data.items[0].category).toBe('vulnerability')
          expect(result.data.items[0].severity).toBe('high')
        }
        expect(result.data.endCursor).toBeUndefined()
      }
    })

    it('covers getOrgAlertsList with filters and pagination', async () => {
      const result = await fixture.client.getOrgAlertsList('test-org', {
        'filters.alertCategory': 'vulnerability',
        'filters.alertPriority': 'high',
        'filters.alertStatus': 'open',
        per_page: 100,
        startAfterCursor: 'cursor-123',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.items).toBeInstanceOf(Array)
        if (result.data.items[0]) {
          expect(result.data.items[0].vulnerability).toBeDefined()
          if (result.data.items[0].vulnerability) {
            expect(result.data.items[0].vulnerability.cveId).toBe(
              'CVE-2024-1234',
            )
            expect(result.data.items[0].vulnerability.cvssScore).toBe(7.5)
          }
        }
      }
    })
  })

  describe('Threat Feed Methods', () => {
    it('covers getOrgThreatFeedItems without query params', async () => {
      const result = await fixture.client.getOrgThreatFeedItems('test-org')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.results).toBeInstanceOf(Array)
        expect(result.data.results[0]?.id).toBe(1)
        expect(result.data.results[0]?.threatType).toBe('malware')
        expect(result.data.results[0]?.needsHumanReview).toBe(false)
        expect(result.data.nextPageCursor).toBeNull()
      }
    })

    it('covers getOrgThreatFeedItems with query params', async () => {
      const result = await fixture.client.getOrgThreatFeedItems('test-org', {
        ecosystem: 'npm',
        per_page: 50,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.results).toBeInstanceOf(Array)
      }
    })

    it('covers getThreatFeedItems (top-level)', async () => {
      const result = await fixture.client.getThreatFeedItems({ per_page: 10 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.results).toBeInstanceOf(Array)
        expect(result.data.results[0]?.purl).toBe('pkg:npm/evil@1.0.0')
      }
    })
  })

  describe('Fixes Methods', () => {
    it('covers getOrgFixes with repo_slug', async () => {
      const result = await fixture.client.getOrgFixes('test-org', {
        allow_major_updates: true,
        repo_slug: 'test-repo',
        vulnerability_ids: 'GHSA-xxxx-yyyy-zzzz',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.fixDetails).toBeDefined()
        expect(result.data.fixDetails['GHSA-xxxx-yyyy-zzzz']).toBeDefined()
        const fixDetail = result.data.fixDetails[
          'GHSA-xxxx-yyyy-zzzz'
        ] as unknown
        if (
          typeof fixDetail === 'object' &&
          fixDetail !== null &&
          'type' in fixDetail &&
          fixDetail.type === 'fixFound' &&
          'value' in fixDetail
        ) {
          const value = fixDetail.value as {
            ghsa: string
            cve: string
            fixDetails: {
              fixes: Array<{
                purl: string
                fixedVersion: string
                updateType: string
              }>
            }
          }
          expect(value.ghsa).toBe('GHSA-xxxx-yyyy-zzzz')
          expect(value.cve).toBe('CVE-2024-1234')
          expect(value.fixDetails.fixes).toBeInstanceOf(Array)
          expect(value.fixDetails.fixes.length).toBeGreaterThan(0)
          if (value.fixDetails.fixes[0]) {
            expect(value.fixDetails.fixes[0].purl).toBe('pkg:npm/lodash')
            expect(value.fixDetails.fixes[0].fixedVersion).toBe('2.0.0')
            expect(value.fixDetails.fixes[0].updateType).toBe('major')
          }
        }
      }
    })

    it('covers getOrgFixes with full_scan_id and options', async () => {
      const result = await fixture.client.getOrgFixes('test-org', {
        allow_major_updates: false,
        full_scan_id: 'scan-123',
        include_details: true,
        include_responsible_direct_dependencies: true,
        minimum_release_age: '7d',
        vulnerability_ids: '*',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.fixDetails).toBeDefined()
      }
    })
  })

  describe('Webhook Management Methods', () => {
    it('covers createOrgWebhook', async () => {
      const result = await fixture.client.createOrgWebhook('test-org', {
        events: ['full_scan.completed'],
        name: 'test-webhook',
        secret: 'test-secret',
        url: 'https://example.com/webhook',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.id).toBe('webhook-1')
        expect(result.data.name).toBe('test-webhook')
        expect(result.data.url).toBe('https://example.com/webhook')
        expect(result.data.events).toEqual(['full_scan.completed'])
      }
    })

    it('covers getOrgWebhooksList', async () => {
      const result = await fixture.client.getOrgWebhooksList('test-org')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.results).toBeInstanceOf(Array)
        expect(result.data.results.length).toBeGreaterThan(0)
        if (result.data.results[0]) {
          expect(result.data.results[0].id).toBe('webhook-1')
        }
        expect(result.data.nextPage).toBeUndefined()
      }
    })

    it('covers getOrgWebhooksList with pagination', async () => {
      const result = await fixture.client.getOrgWebhooksList('test-org', {
        page: 1,
        per_page: 10,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.results).toBeInstanceOf(Array)
      }
    })

    it('covers getOrgWebhook', async () => {
      const result = await fixture.client.getOrgWebhook('test-org', 'webhook-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.id).toBe('webhook-1')
        expect(result.data.name).toBe('test-webhook')
        expect(result.data.url).toBe('https://example.com/webhook')
      }
    })

    it('covers updateOrgWebhook', async () => {
      const result = await fixture.client.updateOrgWebhook(
        'test-org',
        'webhook-1',
        {
          name: 'updated-webhook',
        },
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.id).toBe('webhook-1')
        expect(result.data.name).toBe('updated-webhook')
        expect(result.data.description).toBe('Updated webhook')
      }
    })

    it('covers deleteOrgWebhook', async () => {
      const result = await fixture.client.deleteOrgWebhook(
        'test-org',
        'webhook-1',
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.status).toBe('ok')
      }
    })
  })

  describe('API Token Methods', () => {
    it('covers getAPITokens', async () => {
      const result = await fixture.client.getAPITokens('test-org')
      expect(result.success).toBe(true)
    })

    it('covers postAPIToken', async () => {
      const result = await fixture.client.postAPIToken('test-org', {
        name: 'test-token',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Triage Methods', () => {
    it('covers getOrgTriage', async () => {
      const result = await fixture.client.getOrgTriage('test-org')
      expect(result.success).toBe(true)
    })
  })

  describe('Repository Labels Methods', () => {
    it('covers createRepositoryLabel', async () => {
      const result = await fixture.client.createRepositoryLabel('test-org', {
        name: 'test-label',
      })
      expect(result.success).toBe(true)
    })

    it('covers getRepositoryLabel', async () => {
      const result = await fixture.client.getRepositoryLabel(
        'test-org',
        'label-1',
      )
      expect(result.success).toBe(true)
    })

    it('covers listRepositoryLabels', async () => {
      const result = await fixture.client.listRepositoryLabels('test-org')
      expect(result.success).toBe(true)
    })

    it('covers updateRepositoryLabel', async () => {
      const result = await fixture.client.updateRepositoryLabel(
        'test-org',
        'label-1',
        {
          name: 'updated-label',
        },
      )
      expect(result.success).toBe(true)
    })

    it('covers deleteRepositoryLabel', async () => {
      const result = await fixture.client.deleteRepositoryLabel(
        'test-org',
        'label-1',
      )
      expect(result.success).toBe(true)
    })
  })

  describe('Audit Logs Methods', () => {
    it('covers getAuditLogEvents', async () => {
      const result = await fixture.client.getAuditLogEvents('test-org')
      expect(result.success).toBe(true)
    })
  })

  describe('Supported Files Methods', () => {
    it('covers getSupportedFiles', async () => {
      const result = await fixture.client.getSupportedFiles('test-org')
      expect(result.success).toBe(true)
    })
  })

  describe('Entitlements Methods', () => {
    it('covers getEntitlements', async () => {
      const result = await fixture.client.getEntitlements('test-org')
      expect(Array.isArray(result)).toBe(true)
    })

    it('covers getEnabledEntitlements', async () => {
      const result = await fixture.client.getEnabledEntitlements('test-org')
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Advanced API Token Methods', () => {
    it('covers postAPITokensRevoke', async () => {
      const result = await fixture.client.postAPITokensRevoke(
        'test-org',
        'token-id',
      )
      expect(result.success).toBe(true)
    })

    it('covers postAPITokensRotate', async () => {
      const result = await fixture.client.postAPITokensRotate(
        'test-org',
        'token-id',
      )
      expect(result.success).toBe(true)
    })

    it('covers postAPITokenUpdate', async () => {
      const result = await fixture.client.postAPITokenUpdate(
        'test-org',
        'token-id',
        {
          name: 'updated-token',
        },
      )
      expect(result.success).toBe(true)
    })
  })

  describe('Alert Triage Methods', () => {
    it('covers updateOrgAlertTriage', async () => {
      const result = await fixture.client.updateOrgAlertTriage(
        'test-org',
        'alert-id',
        {
          status: 'resolved',
        },
      )
      expect(result.success).toBe(true)
    })
  })
})
