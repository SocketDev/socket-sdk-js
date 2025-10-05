# @socketsecurity/sdk

[![Socket Badge](https://socket.dev/api/badge/npm/package/@socketsecurity/sdk)](https://socket.dev/npm/package/@socketsecurity/sdk)
[![CI](https://github.com/SocketDev/socket-sdk-js/actions/workflows/ci.yml/badge.svg)](https://github.com/SocketDev/socket-sdk-js/actions/workflows/ci.yml)

[![Follow @SocketSecurity](https://img.shields.io/twitter/follow/SocketSecurity?style=social)](https://twitter.com/SocketSecurity)
[![Follow @socket.dev on Bluesky](https://img.shields.io/badge/Follow-@socket.dev-1DA1F2?style=social&logo=bluesky)](https://bsky.app/profile/socket.dev)

Official SDK for Socket.dev - Programmatic access to security analysis, vulnerability scanning, and compliance monitoring for your software supply chain.

## Installation

```bash
pnpm add @socketsecurity/sdk
```

## Quick Start

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key', {
  retries: 3,        // Retry failed requests up to 3 times
  retryDelay: 1000,  // Start with 1s delay, exponential backoff
  timeout: 30000,    // 30 second timeout
})

// Check your quota
const quota = await client.getQuota()
if (quota.success) {
  console.log(`Available quota: ${quota.data.quota} units`)
}

// Analyze a package
const result = await client.getScoreByNpmPackage('express', '4.18.0')
if (result.success) {
  console.log(`Security Score: ${result.data.score}/100`)
}

// Batch analyze multiple packages
const batchResult = await client.batchPackageFetch({
  components: [
    { purl: 'pkg:npm/express@4.18.0' },
    { purl: 'pkg:npm/react@18.0.0' }
  ]
})
```

**[→ Configuration Options](./docs/API.md#configuration)**

## API Methods

<details>
<summary><strong>Package Analysis</strong> - Quick security checks</summary>

`batchPackageFetch()` • `batchPackageStream()` • `getIssuesByNpmPackage()` • `getScoreByNpmPackage()`

[→ Documentation](./docs/API.md#package-analysis)
</details>

<details>
<summary><strong>Scanning & Analysis</strong> - Project scanning</summary>

`createDependenciesSnapshot()` • `createOrgFullScan()` • `createScanFromFilepaths()` • `getScan()` • `getScanList()` • `getSupportedScanFiles()`

[→ Documentation](./docs/API.md#scanning--analysis)
</details>

<details>
<summary><strong>Organization Management</strong> - Orgs and repos</summary>

`getOrganizations()` • `createOrgRepo()` • `getOrgRepo()` • `getOrgRepoList()` • `updateOrgRepo()` • `deleteOrgRepo()`

[→ Documentation](./docs/API.md#organization-management)
</details>

<details>
<summary><strong>Policy & Settings</strong> - Security configuration</summary>

`getOrgSecurityPolicy()` • `updateOrgSecurityPolicy()` • `getOrgLicensePolicy()` • `updateOrgLicensePolicy()` • `postSettings()`

[→ Documentation](./docs/API.md#policy--settings)
</details>

<details>
<summary><strong>Full Scan Management</strong> - Deep analysis</summary>

`getOrgFullScanList()` • `getOrgFullScanMetadata()` • `getOrgFullScanBuffered()` • `streamOrgFullScan()` • `deleteOrgFullScan()`

[→ Documentation](./docs/API.md#full-scan-management)
</details>

<details>
<summary><strong>Diff Scans</strong> - Compare scans</summary>

`createOrgDiffScanFromIds()` • `getDiffScanById()` • `listOrgDiffScans()` • `deleteOrgDiffScan()`

[→ Documentation](./docs/API.md#diff-scans)
</details>

<details>
<summary><strong>Patches & Vulnerabilities</strong> - Security fixes</summary>

`streamPatchesFromScan()` • `viewPatch()`

[→ Documentation](./docs/API.md#patches--vulnerabilities)
</details>

<details>
<summary><strong>Alert & Triage</strong> - Alert management</summary>

`getOrgTriage()` • `updateOrgAlertTriage()`

[→ Documentation](./docs/API.md#alert--triage)
</details>

<details>
<summary><strong>Export & Integration</strong> - SBOM export</summary>

`exportCDX()` • `exportSPDX()` • `searchDependencies()` • `uploadManifestFiles()`

[→ Documentation](./docs/API.md#export--integration)
</details>

<details>
<summary><strong>Repository Labels</strong> - Categorization</summary>

`createOrgRepoLabel()` • `getOrgRepoLabel()` • `getOrgRepoLabelList()` • `updateOrgRepoLabel()` • `deleteOrgRepoLabel()`

[→ Documentation](./docs/API.md#repository-labels)
</details>

<details>
<summary><strong>Analytics & Monitoring</strong> - Usage metrics</summary>

`getQuota()` • `getOrgAnalytics()` • `getRepoAnalytics()` • `getAuditLogEvents()`

[→ Documentation](./docs/API.md#analytics--monitoring)
</details>

<details>
<summary><strong>Authentication & Access</strong> - API tokens</summary>

`getAPITokens()` • `postAPIToken()` • `postAPITokensRotate()` • `postAPITokensRevoke()` • `postAPITokenUpdate()`

[→ Documentation](./docs/API.md#authentication--access)
</details>

<details>
<summary><strong>Entitlements</strong> - Feature access</summary>

`getEnabledEntitlements()` • `getEntitlements()`

[→ Documentation](./docs/API.md#entitlements)
</details>

<details>
<summary><strong>Quota Utilities</strong> - Cost helpers</summary>

`getQuotaCost()` • `getRequiredPermissions()` • `calculateTotalQuotaCost()` • `hasQuotaForMethods()` • `getMethodsByQuotaCost()` • `getMethodsByPermissions()` • `getQuotaUsageSummary()` • `getAllMethodRequirements()`

[→ Documentation](./docs/QUOTA.md)
</details>

<details>
<summary><strong>Advanced Query Methods</strong> - Raw API</summary>

`getApi()` • `sendApi()`

[→ Documentation](./docs/API.md#advanced-query-methods)
</details>

**[→ Complete API Reference](./docs/API.md)**

**[→ Usage Examples](./docs/EXAMPLES.md)**

**[→ Quota Management](./docs/QUOTA.md)** - Cost tiers: 0 units (free), 10 units (standard), 100 units (batch/uploads)

**[→ Testing Utilities](./docs/TESTING.md)** - Mock factories, fixtures, and type guards for SDK testing

## See Also

- [Socket API Reference](https://docs.socket.dev/reference) - Official API documentation
- [Socket.dev](https://socket.dev/) - Socket security platform
- [Socket CLI](https://github.com/SocketDev/socket-cli-js) - Command-line interface
- [Socket GitHub App](https://github.com/apps/socket-security) - GitHub integration

## License

MIT
