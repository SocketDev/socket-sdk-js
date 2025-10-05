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

## Configuration

```typescript
interface SocketSdkOptions {
  baseUrl?: string          // API base URL (default: 'https://api.socket.dev/v0/')
  timeout?: number          // Request timeout in milliseconds
  retries?: number          // Number of retry attempts (default: 0, disabled)
  retryDelay?: number       // Initial retry delay in ms (default: 100ms)
  userAgent?: string        // Custom user agent string
  agent?: Agent             // Custom HTTP agent for advanced networking
  cache?: boolean           // Enable response caching (default: false)
  cacheTtl?: number         // Cache TTL in ms (default: 300000 = 5 minutes)
}
```

**Retry Logic:**
- Disabled by default (opt-in pattern following Node.js conventions)
- Set `retries: 3` for production to automatically retry transient failures
- Uses exponential backoff: 100ms, 200ms, 400ms, 800ms...
- Does NOT retry 401/403 authentication errors

## API Methods

The SDK provides 60+ methods organized into functional categories:

<details>
<summary><strong>Package Analysis</strong> - Security scanning and scoring</summary>

- `batchPackageFetch()` - Analyze multiple packages in batch
- `batchPackageStream()` - Stream package analysis with concurrency control
- `getIssuesByNpmPackage()` - Get security issues for a package
- `getScoreByNpmPackage()` - Get security score for a package

[→ View full documentation](./docs/API.md#package-analysis)

</details>

<details>
<summary><strong>Scanning & Analysis</strong> - Project and dependency scanning</summary>

- `createDependenciesSnapshot()` - Create dependency snapshot
- `createOrgFullScan()` - Create full organization scan
- `createScanFromFilepaths()` - Create security scan from files
- `getScan()` - Get detailed scan results
- `getScanList()` - List all accessible scans
- `getSupportedScanFiles()` - Get supported file formats

[→ View full documentation](./docs/API.md#scanning--analysis)

</details>

<details>
<summary><strong>Organization Management</strong> - Organizations and repositories</summary>

- `getOrganizations()` - List accessible organizations
- `createOrgRepo()` - Create new repository
- `getOrgRepo()` - Get repository details
- `getOrgRepoList()` - List organization repositories
- `updateOrgRepo()` - Update repository configuration
- `deleteOrgRepo()` - Delete repository

[→ View full documentation](./docs/API.md#organization-management)

</details>

<details>
<summary><strong>Full Scan Management</strong> - Manage comprehensive scans</summary>

- `getOrgFullScanList()` - List organization full scans
- `getOrgFullScanMetadata()` - Get scan metadata
- `getOrgFullScanBuffered()` - Get complete scan results in memory
- `streamOrgFullScan()` - Stream scan results
- `deleteOrgFullScan()` - Delete full scan

[→ View full documentation](./docs/API.md#full-scan-management)

</details>

<details>
<summary><strong>Policy & Settings</strong> - Security and license policies</summary>

- `getOrgSecurityPolicy()` - Get security policy configuration
- `updateOrgSecurityPolicy()` - Update security policy
- `getOrgLicensePolicy()` - Get license policy configuration
- `updateOrgLicensePolicy()` - Update license policy
- `postSettings()` - Update settings

[→ View full documentation](./docs/API.md#policy--settings)

</details>

<details>
<summary><strong>Analytics & Monitoring</strong> - Usage metrics and audit logs</summary>

- `getQuota()` - Get current API quota usage
- `getOrgAnalytics()` - Get organization analytics
- `getRepoAnalytics()` - Get repository analytics
- `getAuditLogEvents()` - Get audit log events

[→ View full documentation](./docs/API.md#analytics--monitoring)

</details>

<details>
<summary><strong>Authentication & Access</strong> - API tokens and permissions</summary>

- `getAPITokens()` - List organization API tokens
- `postAPIToken()` - Create new API token
- `postAPITokensRotate()` - Rotate API token
- `postAPITokensRevoke()` - Revoke API token
- `postAPITokenUpdate()` - Update API token

[→ View full documentation](./docs/API.md#authentication--access)

</details>

<details>
<summary><strong>Export & Integration</strong> - SBOM and data export</summary>

- `exportCDX()` - Export CycloneDX SBOM
- `exportSPDX()` - Export SPDX SBOM
- `searchDependencies()` - Search monitored dependencies
- `uploadManifestFiles()` - Upload manifest files

[→ View full documentation](./docs/API.md#export--integration)

</details>

<details>
<summary><strong>Diff Scans</strong> - Compare scans for changes</summary>

- `createOrgDiffScanFromIds()` - Create diff scan from IDs
- `getDiffScanById()` - Get diff scan details
- `listOrgDiffScans()` - List organization diff scans
- `deleteOrgDiffScan()` - Delete diff scan

[→ View full documentation](./docs/API.md#diff-scans)

</details>

<details>
<summary><strong>Alert & Triage</strong> - Manage security alerts</summary>

- `getOrgTriage()` - Get organization triage settings
- `updateOrgAlertTriage()` - Update alert triage

[→ View full documentation](./docs/API.md#alert--triage)

</details>

<details>
<summary><strong>Repository Labels</strong> - Repository categorization</summary>

- `createOrgRepoLabel()` - Create repository label
- `getOrgRepoLabel()` - Get label details
- `getOrgRepoLabelList()` - List repository labels
- `updateOrgRepoLabel()` - Update repository label
- `deleteOrgRepoLabel()` - Delete repository label

[→ View full documentation](./docs/API.md#repository-labels)

</details>

<details>
<summary><strong>Patches & Vulnerabilities</strong> - Security patches</summary>

- `streamPatchesFromScan()` - Stream patches from scan
- `viewPatch()` - View patch details

[→ View full documentation](./docs/API.md#patches--vulnerabilities)

</details>

<details>
<summary><strong>Entitlements</strong> - Product access and features</summary>

- `getEnabledEntitlements()` - Get enabled entitlements
- `getEntitlements()` - Get all organization entitlements

[→ View full documentation](./docs/API.md#entitlements)

</details>

<details>
<summary><strong>Advanced Query Methods</strong> - Raw API access</summary>

- `getApi()` - Execute raw GET request
- `sendApi()` - Send POST/PUT with JSON body

[→ View full documentation](./docs/API.md#advanced-query-methods)

</details>

<details>
<summary><strong>Quota Utilities</strong> - Cost calculation and optimization</summary>

- `getQuotaCost()` - Get quota cost for any SDK method
- `getRequiredPermissions()` - Get required permissions for SDK method
- `calculateTotalQuotaCost()` - Calculate total cost for multiple methods
- `hasQuotaForMethods()` - Check if quota is sufficient
- `getMethodsByQuotaCost()` - Find methods by quota cost
- `getMethodsByPermissions()` - Find methods requiring specific permissions
- `getQuotaUsageSummary()` - Get summary grouped by quota cost
- `getAllMethodRequirements()` - Get complete mapping of methods to costs

[→ View full documentation](./docs/QUOTA.md)

</details>

**[→ Complete API Reference](./docs/API.md)**

## Usage Examples

### Analyze Package Security

```typescript
// Get detailed security issues
const issues = await client.getIssuesByNpmPackage('lodash', '4.17.20')
if (issues.success) {
  for (const issue of issues.data.issues) {
    console.log(`[${issue.severity}] ${issue.type}: ${issue.description}`)
  }
}
```

### Stream Large Batch Operations

```typescript
// Analyze 100+ packages efficiently
const stream = client.batchPackageStream(
  { components: packages },
  { concurrency: 10 }
)

for await (const result of stream) {
  if (result.success && result.data.score < 70) {
    console.log(`⚠️ Low score: ${result.data.name}`)
  }
}
```

### Create Full Project Scan

```typescript
const scan = await client.createOrgFullScan(
  'my-org',
  ['package.json', 'package-lock.json'],
  process.cwd()
)

if (scan.success) {
  console.log(`Scan created: ${scan.data.id}`)
}
```

### Check Quota Before Operations

```typescript
import { getQuotaCost, hasQuotaForMethods } from '@socketsecurity/sdk'

const operations = ['batchPackageFetch', 'uploadManifestFiles']
const cost = getQuotaCost('batchPackageFetch') // 100 units

const quota = await client.getQuota()
if (quota.success && hasQuotaForMethods(quota.data.quota, operations)) {
  // Proceed with operations
}
```

**[→ More Examples](./docs/EXAMPLES.md)**

## Quota Management

Different operations have different costs:
- **0 units**: Free tier (quota checks, organization lists, entitlements)
- **10 units**: Standard operations (scans, reports, policies)
- **100 units**: Resource-intensive (batch processing, file uploads)

```typescript
import {
  getQuotaCost,
  calculateTotalQuotaCost,
  hasQuotaForMethods
} from '@socketsecurity/sdk'

// Check cost before running operations
const batchCost = getQuotaCost('batchPackageFetch') // 100 units
const scanCost = getQuotaCost('createOrgFullScan')  // 10 units

// Calculate total for multiple operations
const operations = ['batchPackageFetch', 'getOrgAnalytics']
const total = calculateTotalQuotaCost(operations) // 110 units

// Verify sufficient quota
const quota = await client.getQuota()
if (quota.success) {
  if (hasQuotaForMethods(quota.data.quota, operations)) {
    console.log('Sufficient quota available')
  }
}
```

**[→ Quota Management Guide](./docs/QUOTA.md)**

## Testing Utilities

The SDK includes comprehensive testing utilities:

```typescript
import {
  mockSuccessResponse,
  mockErrorResponse,
  mockApiErrorBody,
  mockSdkError,
  fixtures,
  isSuccessResult,
  isErrorResult
} from '@socketsecurity/sdk/testing'

// Mock successful SDK calls
const mockSdk = {
  getOrgRepo: vi.fn().mockResolvedValue(
    mockSuccessResponse(fixtures.repositories.basic)
  )
}

// Mock API errors for integration tests
nock('https://api.socket.dev')
  .get('/v0/repo/org/repo')
  .reply(404, mockApiErrorBody('Repository not found'))

// Type-safe result checking
const result = await client.getOrgRepo('org', 'repo')
if (isSuccessResult(result)) {
  console.log(result.data.name) // Type-safe access
}
```

**[→ Testing Guide](./docs/TESTING.md)**

## ESM / TypeScript

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')
```

## CommonJS

```javascript
const { SocketSdk } = require('@socketsecurity/sdk')

const client = new SocketSdk('your-api-key')
```

## Documentation

- **[API Reference](./docs/API.md)** - Complete API documentation for all 60+ methods
- **[Examples](./docs/EXAMPLES.md)** - Practical usage patterns and code samples
- **[Quota Management](./docs/QUOTA.md)** - Cost optimization and quota utilities
- **[Testing Utilities](./docs/TESTING.md)** - Mock helpers and testing patterns

## Advanced Features

### Custom User Agent

```typescript
import { createUserAgentFromPkgJson } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key', {
  userAgent: createUserAgentFromPkgJson(pkgJson)
})

// Results in User-Agent header:
// your-app/1.0.0 (http://example.com/) socketsecurity-sdk/1.11.0
```

### HTTP/2 Support and Custom Agents

```typescript
import http2 from 'http2'

const client = new SocketSdk('your-api-key', {
  agent: http2.connect('https://api.socket.dev')
})
```

### Response Caching

```typescript
const client = new SocketSdk('your-api-key', {
  cache: true,         // Enable TTL caching
  cacheTtl: 300000     // 5 minute cache (default)
})
```

### Raw API Access

```typescript
// Custom GET request
const response = await client.getApi<MyType>('/custom/endpoint', {
  responseType: 'json'
})

// Custom POST/PUT request
const result = await client.sendApi('/custom/action', {
  method: 'POST',
  body: { action: 'process', data: 'value' }
})
```

## See Also

- [Socket API Reference](https://docs.socket.dev/reference) - Official API documentation
- [Socket.dev](https://socket.dev/) - Socket security platform
- [Socket CLI](https://github.com/SocketDev/socket-cli-js) - Command-line interface
- [Socket GitHub App](https://github.com/apps/socket-security) - GitHub integration

## License

MIT
