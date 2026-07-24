/**
 * @file Domain group definitions and quota labels for the API docs generator
 *   (`scripts/repo/gen-api-docs.mts`). Extracted from `gen-api-docs-lib.mts`
 *   so that file stays under the file-size cap. Each GROUPS entry's `methods`
 *   list controls inclusion + ordering inside the rendered domain section; any
 *   method not listed falls through to the catch-all "Other" group.
 */

// Group definitions, in render order. Each entry's `methods` list controls
// inclusion + ordering inside the group. Any method not listed below falls
// through to the catch-all "Other" group so additions surface immediately.
export const GROUPS: Array<{
  title: string
  description: string
  methods: string[]
}> = [
  {
    title: 'Full scans',
    description:
      'Create, fetch, list, and delete organization-level full security scans.',
    methods: [
      'createFullScan',
      'createFullScanFromManifest',
      'createOrgFullScanFromArchive',
      'uploadBlobs',
      'getFullScan',
      'getFullScanMetadata',
      'listFullScans',
      'streamFullScan',
      'downloadOrgFullScanFilesAsTar',
      'rescanFullScan',
      'deleteFullScan',
    ],
  },
  {
    title: 'Diff scans',
    description: 'Compare two scans and inspect the diff.',
    methods: [
      'createOrgDiffScanFromIds',
      'getDiffScanById',
      'getDiffScanGfm',
      'listOrgDiffScans',
      'deleteOrgDiffScan',
    ],
  },
  {
    title: 'Repositories',
    description: 'Manage repositories tracked by the organization.',
    methods: [
      'createRepository',
      'getRepository',
      'listRepositories',
      'updateRepository',
      'deleteRepository',
    ],
  },
  {
    title: 'Repository labels',
    description: 'Per-repo labels for filtering and grouping.',
    methods: [
      'createRepositoryLabel',
      'getRepositoryLabel',
      'listRepositoryLabels',
      'updateRepositoryLabel',
      'deleteRepositoryLabel',
    ],
  },
  {
    title: 'Organizations',
    description: 'Org listing, analytics, and entitlements.',
    methods: [
      'listOrganizations',
      'getOrgAnalytics',
      'getRepoAnalytics',
      'getEnabledEntitlements',
      'getEntitlements',
    ],
  },
  {
    title: 'Alerts & triage',
    description: 'Surface and triage alerts across an organization.',
    methods: [
      'getOrgAlertsList',
      'getOrgAlertFullScans',
      'getOrgAlertResolutions',
      'getOrgAlertResolution',
      'deleteOrgAlertResolution',
      'getOrgTriage',
      'updateOrgAlertTriage',
      'getOrgFixes',
    ],
  },
  {
    title: 'Historical & analytics',
    description:
      'Point-in-time alert and dependency history, trends, and snapshots.',
    methods: [
      'historicalAlertsList',
      'historicalAlertsTrend',
      'historicalDependenciesTrend',
      'historicalSnapshotsList',
      'historicalSnapshotsStart',
    ],
  },
  {
    title: 'Webhooks',
    description: 'Manage outbound webhooks for organization events.',
    methods: [
      'createOrgWebhook',
      'getOrgWebhook',
      'getOrgWebhooksList',
      'updateOrgWebhook',
      'deleteOrgWebhook',
    ],
  },
  {
    title: 'Patches',
    description: 'Browse and download Socket security patches.',
    methods: ['viewPatch', 'downloadPatch', 'streamPatchesFromScan'],
  },
  {
    title: 'API tokens',
    description:
      'Provision, rotate, and revoke API tokens for the organization.',
    methods: [
      'getAPITokens',
      'postAPIToken',
      'postAPITokenUpdate',
      'postAPITokensRotate',
      'postAPITokensRevoke',
    ],
  },
  {
    title: 'Policies',
    description: 'Read and update license + security policy settings.',
    methods: [
      'getOrgLicensePolicy',
      'updateOrgLicensePolicy',
      'getOrgSecurityPolicy',
      'updateOrgSecurityPolicy',
      'postSettings',
    ],
  },
  {
    title: 'Telemetry',
    description: 'Inspect and configure organization telemetry.',
    methods: [
      'getOrgTelemetryConfig',
      'updateOrgTelemetryConfig',
      'postOrgTelemetry',
    ],
  },
  {
    title: 'Audit log',
    description: 'Fetch organization audit log events.',
    methods: ['getAuditLogEvents'],
  },
  {
    title: 'Threat campaigns',
    description:
      'Browse supply chain attack campaigns and the packages they affect.',
    methods: [
      'listThreatCampaigns',
      'getThreatCampaign',
      'listThreatCampaignPackages',
    ],
  },
  {
    title: 'Events',
    description: 'Ingest organization telemetry events.',
    methods: ['postEvents'],
  },
  {
    title: 'Packages',
    description: 'Per-package and batch package analysis.',
    methods: [
      'getScoreByNpmPackage',
      'getIssuesByNpmPackage',
      'batchPackageFetch',
      'batchOrgPackageFetch',
      'batchPackageStream',
      'checkMalware',
      'searchDependencies',
    ],
  },
  {
    title: 'Dependencies & manifests',
    description: 'Upload manifests and snapshot dependency graphs.',
    methods: [
      'uploadManifestFiles',
      'createDependenciesSnapshot',
      'getSupportedFiles',
    ],
  },
  {
    title: 'Exports',
    description: 'Export full scans in industry-standard formats.',
    methods: ['exportCDX', 'exportSPDX', 'exportOpenVEX'],
  },
  {
    title: 'Quota',
    description: 'Inspect current API quota.',
    methods: ['getQuota'],
  },
  {
    title: 'Escape hatches',
    description: 'Raw HTTP access for endpoints the SDK does not wrap.',
    methods: ['getApi', 'sendApi'],
  },
]

export const QUOTA_LABELS: Record<number, string> = {
  0: 'Free',
  10: 'Standard',
  100: 'Expensive',
}
