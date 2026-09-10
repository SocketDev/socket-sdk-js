/**
 * @file Deterministic HTTP fixtures for SDK method coverage.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { respondToOrganizationsCoverage } from './sdk-api-coverage-organizations.mts'
import { respondToWebhooksCoverage } from './sdk-api-coverage-webhooks.mts'

export interface CoverageRequest {
  url: string
  req: IncomingMessage
  res: ServerResponse
}

export interface CoverageRoute {
  matches: (url: string) => boolean
  respond: (request: CoverageRequest) => void
}

export function respondToSdkCoverageRequest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const url = req.url || ''
  if (url.includes('/patches') && url.includes('invalid-scan')) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not Found' }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  const route = sdkCoverageRoutes.find(candidate => candidate.matches(url))
  if (route) {
    route.respond({ url, req, res })
  } else {
    res.end(JSON.stringify({ data: {} }))
  }
}

function respondToPurlCoverage({ res }: CoverageRequest): void {
  res.end(
    JSON.stringify({
      type: 'npm',
      name: 'lodash',
      version: '4.17.21',
      inputPurl: 'pkg:npm/lodash@4.17.21',
      alerts: [],
    }) + '\n',
  )
}

function respondToNpmCoverage({ url, res }: CoverageRequest): void {
  // Package analysis endpoints
  if (url.includes('/issues')) {
    res.end(JSON.stringify({ data: { issues: [] } }))
  } else if (url.includes('/score')) {
    res.end(JSON.stringify({ data: { score: 95 } }))
  } else {
    res.end(JSON.stringify({ data: {} }))
  }
}

function respondToExportCoverage({ res }: CoverageRequest): void {
  // SBOM/VEX export endpoints (orgs/{org}/export/{cdx,spdx,openvex}/{id})
  res.end(JSON.stringify({ data: { format: 'cyclonedx' } }))
}

function respondToScanCoverage({ req, res }: CoverageRequest): void {
  // Scanning endpoints
  if (req.method === 'POST') {
    res.end(JSON.stringify({ data: { id: 'scan-1', status: 'queued' } }))
  } else {
    res.end(JSON.stringify({ data: { id: 'scan-1', status: 'complete' } }))
  }
}

function respondToPatchesCoverage({ res }: CoverageRequest): void {
  // Patches endpoint
  res.end(JSON.stringify({ data: [] }))
}

function respondToQuotaCoverage({ res }: CoverageRequest): void {
  // Quota endpoint
  res.end(JSON.stringify({ data: { limit: 1000, used: 100 } }))
}

function respondToTelemetryConfigCoverage({ req, res }: CoverageRequest): void {
  // Telemetry config endpoint
  if (req.method === 'PUT') {
    res.end(JSON.stringify({ telemetry: { enabled: true } }))
  } else {
    res.end(JSON.stringify({ telemetry: { enabled: false } }))
  }
}

function respondToTelemetryCoverage({ req, res }: CoverageRequest): void {
  // Telemetry POST endpoint (must come before generic /settings)
  if (req.method === 'POST') {
    res.end(JSON.stringify({}))
  } else {
    res.end(JSON.stringify({}))
  }
}

function respondToThreatFeedCoverage({ res }: CoverageRequest): void {
  // Threat-feed endpoint (org-scoped + top-level share a shape).
  // Mirrors the depscan api-v0 threatFeedResults schema: id +
  // threatInstanceId are integers, and publishedAt / removedAt /
  // nextPageCursor are JSON null on the wire (SNullable in the source).
  // Emitted as a raw JSON string so the wire `null`s stay verbatim.
  res.end(
    `{
      "nextPageCursor": null,
      "results": [
        {
          "createdAt": "2024-01-01T00:00:00Z",
          "description": "Known malware in the postinstall script.",
          "id": 1,
          "locationHtmlUrl": "https://socket.dev/threat/1",
          "needsHumanReview": false,
          "packageHtmlUrl": "https://socket.dev/npm/package/evil",
          "publishedAt": null,
          "purl": "pkg:npm/evil@1.0.0",
          "removedAt": null,
          "threatInstanceId": 42,
          "threatType": "malware",
          "updatedAt": "2024-01-02T00:00:00Z"
        }
      ]
    }`,
  )
}

function respondToAlertsCoverage({ res }: CoverageRequest): void {
  // Alerts endpoint
  res.end(
    JSON.stringify({
      endCursor: undefined,
      items: [
        {
          category: 'vulnerability',
          clearedAt: undefined,
          createdAt: '2024-01-01T00:00:00Z',
          dashboardUrl: 'https://socket.dev/alerts/alert-1',
          fix: {
            description: 'Upgrade to version 2.0.0',
            type: 'upgrade',
          },
          id: 'alert-1',
          key: 'CVE-2024-1234',
          locations: [],
          severity: 'high',
          status: 'open',
          type: 'vulnerableCode',
          updatedAt: '2024-01-01T00:00:00Z',
          version: 1,
          vulnerability: {
            cveDescription: 'Test vulnerability',
            cveId: 'CVE-2024-1234',
            cveTitle: 'Test CVE',
            cvssScore: 7.5,
            cweIds: ['CWE-79'],
            cweNames: ['Cross-site Scripting'],
            epssPercentile: 0.9,
            epssScore: 0.8,
            ghsaIds: ['GHSA-xxxx-yyyy-zzzz'],
            isKev: false,
          },
        },
      ],
    }),
  )
}

function respondToFixesCoverage({ res }: CoverageRequest): void {
  // Fixes endpoint
  res.end(
    JSON.stringify({
      fixDetails: {
        'GHSA-xxxx-yyyy-zzzz': {
          type: 'fixFound',
          value: {
            cve: 'CVE-2024-1234',
            fixDetails: {
              fixes: [
                {
                  fixedVersion: '2.0.0',
                  manifestFiles: ['package.json'],
                  purl: 'pkg:npm/lodash',
                  updateType: 'major',
                },
              ],
            },
            ghsa: 'GHSA-xxxx-yyyy-zzzz',
            type: 'fixFound',
          },
        },
      },
    }),
  )
}

function respondToSettingsCoverage({ res }: CoverageRequest): void {
  // Settings endpoint
  res.end(JSON.stringify({ data: { success: true } }))
}

function respondToDependenciesCoverage({ url, res }: CoverageRequest): void {
  // Dependencies endpoints
  if (url.includes('/search')) {
    res.end(JSON.stringify({ data: [] }))
  } else if (url.includes('/snapshot')) {
    res.end(JSON.stringify({ data: { id: 'snapshot-1' } }))
  } else {
    res.end(JSON.stringify({ data: {} }))
  }
}

function respondToApiTokensCoverage({ url, req, res }: CoverageRequest): void {
  // API tokens
  if (req.method === 'DELETE' || url.includes('/revoke')) {
    res.end(JSON.stringify({ success: true }))
  } else if (req.method === 'POST' || url.includes('/rotate')) {
    res.end(JSON.stringify({ data: { token: 'new-token' } }))
  } else if (req.method === 'PUT') {
    res.end(JSON.stringify({ data: { token: 'updated-token' } }))
  } else {
    res.end(JSON.stringify({ data: [] }))
  }
}

function respondToEntitlementsCoverage({ url, res }: CoverageRequest): void {
  // Entitlements
  if (url.includes('/enabled')) {
    res.end(JSON.stringify({ data: [] }))
  } else {
    res.end(JSON.stringify({ data: [] }))
  }
}

function respondToAlertTriageCoverage({ req, res }: CoverageRequest): void {
  // Alert triage
  if (req.method === 'PUT') {
    res.end(JSON.stringify({ data: { status: 'resolved' } }))
  } else {
    res.end(JSON.stringify({ data: {} }))
  }
}

function respondToReportCoverage({ req, res }: CoverageRequest): void {
  // Reports
  if (req.method === 'DELETE') {
    res.end(JSON.stringify({ success: true }))
  } else {
    res.end(JSON.stringify({ data: {} }))
  }
}

function respondToAuditLogsCoverage({ res }: CoverageRequest): void {
  // Audit logs
  res.end(JSON.stringify({ data: [] }))
}

function respondToSupportedFilesCoverage({ res }: CoverageRequest): void {
  // Supported files
  res.end(JSON.stringify({ data: [] }))
}

function respondToUploadManifestFilesCoverage({ res }: CoverageRequest): void {
  // Upload manifest files
  res.end(
    JSON.stringify({
      data: { uploadId: 'upload-123', status: 'success' },
    }),
  )
}

const sdkCoverageRoutes: CoverageRoute[] = [
  { matches: url => url.includes('/purl'), respond: respondToPurlCoverage },
  { matches: url => url.includes('/npm/'), respond: respondToNpmCoverage },
  {
    matches: url => url.includes('/organizations'),
    respond: respondToOrganizationsCoverage,
  },
  {
    matches: url => url.includes('/export/'),
    respond: respondToExportCoverage,
  },
  { matches: url => url.includes('/scan'), respond: respondToScanCoverage },
  {
    matches: url => url.includes('/patches'),
    respond: respondToPatchesCoverage,
  },
  { matches: url => url.includes('/quota'), respond: respondToQuotaCoverage },
  {
    matches: url => url.includes('/telemetry/config'),
    respond: respondToTelemetryConfigCoverage,
  },
  {
    matches: url => url.includes('/telemetry'),
    respond: respondToTelemetryCoverage,
  },
  {
    matches: url => url.includes('/threat-feed'),
    respond: respondToThreatFeedCoverage,
  },
  { matches: url => url.includes('/alerts'), respond: respondToAlertsCoverage },
  { matches: url => url.includes('/fixes'), respond: respondToFixesCoverage },
  {
    matches: url => url.includes('/webhooks'),
    respond: respondToWebhooksCoverage,
  },
  {
    matches: url => url.includes('/settings'),
    respond: respondToSettingsCoverage,
  },
  {
    matches: url => url.includes('/dependencies'),
    respond: respondToDependenciesCoverage,
  },
  {
    matches: url => url.includes('/api-tokens'),
    respond: respondToApiTokensCoverage,
  },
  {
    matches: url => url.includes('/entitlements'),
    respond: respondToEntitlementsCoverage,
  },
  {
    matches: url => url.includes('/alert-triage'),
    respond: respondToAlertTriageCoverage,
  },
  { matches: url => url.includes('/report'), respond: respondToReportCoverage },
  {
    matches: url => url.includes('/audit-logs'),
    respond: respondToAuditLogsCoverage,
  },
  {
    matches: url => url.includes('/supported-files'),
    respond: respondToSupportedFilesCoverage,
  },
  {
    matches: url => url.includes('/upload-manifest-files'),
    respond: respondToUploadManifestFilesCoverage,
  },
]
