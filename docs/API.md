# API Reference

Complete API reference for `@socketsecurity/sdk`. All methods return a result object with the following structure:

```typescript
// Success result
{
  success: true,
  status: number,
  data: T
}

// Error result
{
  success: false,
  status: number,
  error: string,
  cause?: string
}
```

## Package Analysis

### `batchPackageFetch(componentsObj, queryParams?)`

Analyze multiple packages in a single batch request. Returns all results at once after processing is complete.

**Parameters:**
- `componentsObj` - Object containing array of package components with PURLs
- `queryParams?` - Optional query parameters for filtering/configuration

**Returns:** Promise resolving to array of package analysis results

**Example:**
```typescript
const result = await client.batchPackageFetch({
  components: [
    { purl: 'pkg:npm/express@4.18.0' },
    { purl: 'pkg:npm/lodash@4.17.21' }
  ]
})

if (result.success) {
  for (const pkg of result.data) {
    console.log(`${pkg.name}: Score ${pkg.score}`)
  }
}
```

### `batchPackageStream(componentsObj, options?)`

Stream package analysis results with concurrency control. Returns results as they become available via async generator.

**Parameters:**
- `componentsObj` - Object containing array of package components
- `options?` - Streaming options with concurrency control

**Returns:** AsyncGenerator yielding package results

**Example:**
```typescript
const stream = client.batchPackageStream({
  components: [
    { purl: 'pkg:npm/express@4.18.0' },
    { purl: 'pkg:npm/react@18.0.0' }
  ]
}, { concurrency: 5 })

for await (const result of stream) {
  if (result.success) {
    console.log(`Analyzed: ${result.data.name}`)
  }
}
```

### `getIssuesByNpmPackage(packageName, version)`

Get detailed security issues for a specific npm package version.

**Parameters:**
- `packageName` - Package name (e.g., 'express')
- `version` - Specific version (e.g., '4.18.0')

**Returns:** Promise with vulnerability and security alert information

**Example:**
```typescript
const result = await client.getIssuesByNpmPackage('express', '4.18.0')

if (result.success) {
  console.log(`Found ${result.data.issues.length} issues`)
  for (const issue of result.data.issues) {
    console.log(`${issue.type}: ${issue.severity}`)
  }
}
```

### `getScoreByNpmPackage(packageName, version)`

Get security score and rating breakdown for a package.

**Parameters:**
- `packageName` - Package name
- `version` - Package version

**Returns:** Promise with numerical security rating

**Example:**
```typescript
const result = await client.getScoreByNpmPackage('lodash', '4.17.21')

if (result.success) {
  console.log(`Security Score: ${result.data.score}/100`)
  console.log(`Supply Chain: ${result.data.supplyChainRisk}`)
}
```

## Scanning & Analysis

### `createDependenciesSnapshot(filepaths, pathsRelativeTo?, queryParams?)`

Create a dependency snapshot from project files for security analysis.

**Parameters:**
- `filepaths` - Array of file paths to analyze
- `pathsRelativeTo?` - Base directory for relative paths (default: '.')
- `queryParams?` - Additional query parameters

**Returns:** Promise with snapshot creation result

**Example:**
```typescript
const result = await client.createDependenciesSnapshot(
  ['package.json', 'package-lock.json'],
  '/path/to/project'
)

if (result.success) {
  console.log(`Snapshot ID: ${result.data.id}`)
}
```

### `createOrgFullScan(orgSlug, filepaths, pathsRelativeTo?, queryParams?)`

Create a comprehensive security scan for an organization.

**Parameters:**
- `orgSlug` - Organization identifier
- `filepaths` - Array of project files to scan
- `pathsRelativeTo?` - Base directory (default: '.')
- `queryParams?` - Scan configuration options

**Returns:** Promise with scan creation result

**Example:**
```typescript
const result = await client.createOrgFullScan(
  'my-org',
  ['package.json', 'src/**/*.js'],
  '/path/to/project',
  { branch: 'main' }
)

if (result.success) {
  console.log(`Scan started: ${result.data.id}`)
}
```

### `getScan(id)`

Retrieve complete scan results by scan ID.

**Parameters:**
- `id` - Scan identifier

**Returns:** Promise with complete scan analysis

**Example:**
```typescript
const result = await client.getScan('scan_abc123')

if (result.success) {
  console.log(`Status: ${result.data.status}`)
  console.log(`Issues: ${result.data.issues.length}`)
}
```

### `getScanList()`

List all accessible scans with pagination support.

**Returns:** Promise with paginated list of scan metadata

**Example:**
```typescript
const result = await client.getScanList()

if (result.success) {
  for (const scan of result.data.scans) {
    console.log(`${scan.id}: ${scan.status}`)
  }
}
```

### `getSupportedScanFiles()`

Get list of supported manifest files and formats.

**Returns:** Promise with supported file types

**Example:**
```typescript
const result = await client.getSupportedScanFiles()

if (result.success) {
  console.log('Supported files:', result.data.files)
}
```

## Organization Management

### `getOrganizations()`

List all accessible organizations with permissions.

**Returns:** Promise with organization list

**Example:**
```typescript
const result = await client.getOrganizations()

if (result.success) {
  for (const org of result.data.organizations) {
    console.log(`${org.name} (${org.plan})`)
  }
}
```

### `createOrgRepo(orgSlug, queryParams?)`

Create a new repository for monitoring.

**Parameters:**
- `orgSlug` - Organization identifier
- `queryParams?` - Repository configuration

**Returns:** Promise with created repository details

**Example:**
```typescript
const result = await client.createOrgRepo('my-org', {
  name: 'my-repo',
  homepage: 'https://github.com/org/repo',
  default_branch: 'main'
})

if (result.success) {
  console.log(`Repository created: ${result.data.id}`)
}
```

### `getOrgRepo(orgSlug, repoSlug)`

Get repository details and configuration.

**Parameters:**
- `orgSlug` - Organization identifier
- `repoSlug` - Repository identifier

**Returns:** Promise with repository details

**Example:**
```typescript
const result = await client.getOrgRepo('my-org', 'my-repo')

if (result.success) {
  console.log(`Repo: ${result.data.name}`)
  console.log(`Branch: ${result.data.default_branch}`)
}
```

### `getOrgRepoList(orgSlug, queryParams?)`

List all repositories in an organization.

**Parameters:**
- `orgSlug` - Organization identifier
- `queryParams?` - Filtering and pagination options

**Returns:** Promise with repository list

**Example:**
```typescript
const result = await client.getOrgRepoList('my-org', {
  archived: false,
  limit: 50
})

if (result.success) {
  console.log(`Found ${result.data.repositories.length} repos`)
}
```

### `updateOrgRepo(orgSlug, repoSlug, queryParams?)`

Update repository configuration and settings.

**Parameters:**
- `orgSlug` - Organization identifier
- `repoSlug` - Repository identifier
- `queryParams?` - Updated configuration

**Returns:** Promise with updated repository details

**Example:**
```typescript
const result = await client.updateOrgRepo('my-org', 'my-repo', {
  archived: true,
  homepage: 'https://new-url.com'
})

if (result.success) {
  console.log('Repository updated successfully')
}
```

### `deleteOrgRepo(orgSlug, repoSlug)`

Delete a repository and its associated data.

**Parameters:**
- `orgSlug` - Organization identifier
- `repoSlug` - Repository identifier

**Returns:** Promise with deletion confirmation

**Example:**
```typescript
const result = await client.deleteOrgRepo('my-org', 'old-repo')

if (result.success) {
  console.log('Repository deleted')
}
```

## Full Scan Management

### `getOrgFullScanList(orgSlug, queryParams?)`

List all full scans for an organization.

**Parameters:**
- `orgSlug` - Organization identifier
- `queryParams?` - Filtering options

**Returns:** Promise with scan list

**Example:**
```typescript
const result = await client.getOrgFullScanList('my-org', {
  limit: 20,
  status: 'completed'
})

if (result.success) {
  for (const scan of result.data.scans) {
    console.log(`${scan.id}: ${scan.created_at}`)
  }
}
```

### `getOrgFullScanMetadata(orgSlug, fullScanId)`

Get metadata for a specific full scan.

**Parameters:**
- `orgSlug` - Organization identifier
- `fullScanId` - Full scan identifier

**Returns:** Promise with scan metadata

**Example:**
```typescript
const result = await client.getOrgFullScanMetadata('my-org', 'scan_123')

if (result.success) {
  console.log(`Status: ${result.data.status}`)
  console.log(`Files: ${result.data.file_count}`)
}
```

### `getOrgFullScanBuffered(orgSlug, fullScanId)`

Get complete scan results loaded into memory.

**Parameters:**
- `orgSlug` - Organization identifier
- `fullScanId` - Full scan identifier

**Returns:** Promise with complete scan data

**Example:**
```typescript
const result = await client.getOrgFullScanBuffered('my-org', 'scan_123')

if (result.success) {
  // Process entire scan data
  console.log(`Total packages: ${result.data.packages.length}`)
}
```

### `streamOrgFullScan(orgSlug, fullScanId, output?)`

Stream large scan results efficiently.

**Parameters:**
- `orgSlug` - Organization identifier
- `fullScanId` - Full scan identifier
- `output?` - Output destination (file path or writable stream)

**Returns:** Promise with streaming result

**Example:**
```typescript
// Stream to file
await client.streamOrgFullScan('my-org', 'scan_123', '/tmp/scan-data.json')

// Stream to stdout
await client.streamOrgFullScan('my-org', 'scan_123', process.stdout)

// Get as ReadableStream
const result = await client.streamOrgFullScan('my-org', 'scan_123')
if (result.success) {
  for await (const chunk of result.data) {
    console.log(chunk)
  }
}
```

### `deleteOrgFullScan(orgSlug, fullScanId)`

Delete a full scan and its data.

**Parameters:**
- `orgSlug` - Organization identifier
- `fullScanId` - Full scan identifier

**Returns:** Promise with deletion confirmation

**Example:**
```typescript
const result = await client.deleteOrgFullScan('my-org', 'scan_old')

if (result.success) {
  console.log('Scan deleted')
}
```

## Policy & Settings

### `getOrgSecurityPolicy(orgSlug)`

Get organization security policy configuration.

**Parameters:**
- `orgSlug` - Organization identifier

**Returns:** Promise with security policy

**Example:**
```typescript
const result = await client.getOrgSecurityPolicy('my-org')

if (result.success) {
  console.log('Alert rules:', result.data.securityPolicyRules)
}
```

### `updateOrgSecurityPolicy(orgSlug, policyData)`

Update security policy rules and settings.

**Parameters:**
- `orgSlug` - Organization identifier
- `policyData` - Updated policy configuration

**Returns:** Promise with update confirmation

**Example:**
```typescript
const result = await client.updateOrgSecurityPolicy('my-org', {
  securityPolicyRules: {
    malware: { action: 'error' },
    vulnerability: { action: 'warn' }
  }
})

if (result.success) {
  console.log('Policy updated')
}
```

### `getOrgLicensePolicy(orgSlug)`

Get license policy configuration.

**Parameters:**
- `orgSlug` - Organization identifier

**Returns:** Promise with license policy

**Example:**
```typescript
const result = await client.getOrgLicensePolicy('my-org')

if (result.success) {
  console.log('Allowed licenses:', result.data.allowed)
  console.log('Restricted licenses:', result.data.restricted)
}
```

### `updateOrgLicensePolicy(orgSlug, policyData, queryParams?)`

Update license policy settings.

**Parameters:**
- `orgSlug` - Organization identifier
- `policyData` - Updated license policy
- `queryParams?` - Additional options

**Returns:** Promise with update confirmation

**Example:**
```typescript
const result = await client.updateOrgLicensePolicy('my-org', {
  allowed: ['MIT', 'Apache-2.0'],
  restricted: ['GPL-3.0']
})

if (result.success) {
  console.log('License policy updated')
}
```

## Analytics & Monitoring

### `getQuota()`

Get current API quota usage and limits.

**Returns:** Promise with quota information

**Example:**
```typescript
const result = await client.getQuota()

if (result.success) {
  console.log(`Remaining: ${result.data.quota}`)
  console.log(`Reset: ${result.data.reset}`)
}
```

### `getOrgAnalytics(time)`

Get organization analytics for a time period.

**Parameters:**
- `time` - Time period ('7d', '30d', '90d')

**Returns:** Promise with analytics data

**Example:**
```typescript
const result = await client.getOrgAnalytics('30d')

if (result.success) {
  for (const day of result.data) {
    console.log(`${day.date}: ${day.scans} scans`)
  }
}
```

### `getRepoAnalytics(repo, time)`

Get repository-specific analytics.

**Parameters:**
- `repo` - Repository identifier
- `time` - Time period

**Returns:** Promise with repository analytics

**Example:**
```typescript
const result = await client.getRepoAnalytics('my-repo', '7d')

if (result.success) {
  console.log(`Commits: ${result.data.total_commits}`)
  console.log(`Issues fixed: ${result.data.issues_fixed}`)
}
```

### `getAuditLogEvents(orgSlug, queryParams?)`

Get audit log events for an organization.

**Parameters:**
- `orgSlug` - Organization identifier
- `queryParams?` - Filtering options

**Returns:** Promise with audit log entries

**Example:**
```typescript
const result = await client.getAuditLogEvents('my-org', {
  limit: 100,
  from: '2024-01-01'
})

if (result.success) {
  for (const event of result.data.events) {
    console.log(`${event.timestamp}: ${event.action}`)
  }
}
```

## Authentication & Access

### `getAPITokens(orgSlug)`

List organization API tokens.

**Parameters:**
- `orgSlug` - Organization identifier

**Returns:** Promise with token list

**Example:**
```typescript
const result = await client.getAPITokens('my-org')

if (result.success) {
  for (const token of result.data.tokens) {
    console.log(`${token.name}: ${token.created_at}`)
  }
}
```

### `postAPIToken(orgSlug, tokenData)`

Create a new API token.

**Parameters:**
- `orgSlug` - Organization identifier
- `tokenData` - Token configuration

**Returns:** Promise with created token details

**Example:**
```typescript
const result = await client.postAPIToken('my-org', {
  name: 'CI Token',
  scopes: ['read:scans', 'write:scans']
})

if (result.success) {
  console.log(`Token: ${result.data.token}`)
  console.log('Save this token securely - it will not be shown again')
}
```

### `postAPITokensRotate(orgSlug, tokenId)`

Rotate an existing API token.

**Parameters:**
- `orgSlug` - Organization identifier
- `tokenId` - Token identifier

**Returns:** Promise with new token value

**Example:**
```typescript
const result = await client.postAPITokensRotate('my-org', 'token_123')

if (result.success) {
  console.log(`New token: ${result.data.token}`)
}
```

### `postAPITokensRevoke(orgSlug, tokenId)`

Revoke an API token.

**Parameters:**
- `orgSlug` - Organization identifier
- `tokenId` - Token identifier

**Returns:** Promise with revocation confirmation

**Example:**
```typescript
const result = await client.postAPITokensRevoke('my-org', 'token_old')

if (result.success) {
  console.log('Token revoked')
}
```

## Export & Integration

### `exportCDX(orgSlug, fullScanId)`

Export CycloneDX SBOM for a scan.

**Parameters:**
- `orgSlug` - Organization identifier
- `fullScanId` - Full scan identifier

**Returns:** Promise with CycloneDX SBOM

**Example:**
```typescript
const result = await client.exportCDX('my-org', 'scan_123')

if (result.success) {
  fs.writeFileSync('sbom.json', JSON.stringify(result.data, null, 2))
}
```

### `exportSPDX(orgSlug, fullScanId)`

Export SPDX SBOM for a scan.

**Parameters:**
- `orgSlug` - Organization identifier
- `fullScanId` - Full scan identifier

**Returns:** Promise with SPDX SBOM

**Example:**
```typescript
const result = await client.exportSPDX('my-org', 'scan_123')

if (result.success) {
  fs.writeFileSync('sbom-spdx.json', JSON.stringify(result.data, null, 2))
}
```

### `uploadManifestFiles(orgSlug, filepaths, pathsRelativeTo?)`

Upload manifest files for dependency analysis.

**Parameters:**
- `orgSlug` - Organization identifier
- `filepaths` - Array of file paths
- `pathsRelativeTo?` - Base directory

**Returns:** Promise with upload result

**Example:**
```typescript
const result = await client.uploadManifestFiles(
  'my-org',
  ['package.json', 'package-lock.json'],
  '/path/to/project'
)

if (result.success) {
  console.log(`Tar hash: ${result.data.tarHash}`)
}
```

## Diff Scans

### `createOrgDiffScanFromIds(orgSlug, queryParams?)`

Create a diff scan comparing two full scans.

**Parameters:**
- `orgSlug` - Organization identifier
- `queryParams?` - Scan IDs to compare

**Returns:** Promise with diff scan creation result

**Example:**
```typescript
const result = await client.createOrgDiffScanFromIds('my-org', {
  from: 'scan_old',
  to: 'scan_new'
})

if (result.success) {
  console.log(`Diff scan created: ${result.data.id}`)
}
```

### `getDiffScanById(orgSlug, diffScanId)`

Get diff scan results.

**Parameters:**
- `orgSlug` - Organization identifier
- `diffScanId` - Diff scan identifier

**Returns:** Promise with diff scan results

**Example:**
```typescript
const result = await client.getDiffScanById('my-org', 'diff_123')

if (result.success) {
  console.log(`Added packages: ${result.data.added.length}`)
  console.log(`Removed packages: ${result.data.removed.length}`)
  console.log(`Changed packages: ${result.data.changed.length}`)
}
```

### `listOrgDiffScans(orgSlug)`

List all diff scans for an organization.

**Parameters:**
- `orgSlug` - Organization identifier

**Returns:** Promise with diff scan list

**Example:**
```typescript
const result = await client.listOrgDiffScans('my-org')

if (result.success) {
  for (const diff of result.data.diffs) {
    console.log(`${diff.id}: ${diff.from} → ${diff.to}`)
  }
}
```

### `deleteOrgDiffScan(orgSlug, diffScanId)`

Delete a diff scan.

**Parameters:**
- `orgSlug` - Organization identifier
- `diffScanId` - Diff scan identifier

**Returns:** Promise with deletion confirmation

**Example:**
```typescript
const result = await client.deleteOrgDiffScan('my-org', 'diff_old')

if (result.success) {
  console.log('Diff scan deleted')
}
```

## Advanced Query Methods

### `getApi<T>(urlPath, options?)`

Execute a raw GET request with full control.

**Parameters:**
- `urlPath` - API endpoint path
- `options?` - Request options (responseType, throws)

**Returns:** Promise with configurable response type

**Example:**
```typescript
// Get JSON response
const result = await client.getApi<MyType>('/custom/endpoint', {
  responseType: 'json'
})

// Get raw Response object
const response = await client.getApi('/data', {
  responseType: 'response'
})

// Get text response
const text = await client.getApi('/text', {
  responseType: 'text'
})
```

### `sendApi<T>(urlPath, options?)`

Send POST/PUT with JSON body.

**Parameters:**
- `urlPath` - API endpoint path
- `options?` - Request options (method, body, throws)

**Returns:** Promise with JSON response

**Example:**
```typescript
const result = await client.sendApi('/custom/action', {
  method: 'POST',
  body: { action: 'process', data: 'value' }
})

if (result.success) {
  console.log('Action completed:', result.data)
}
```

## See Also

- [Examples](./EXAMPLES.md) - Usage examples and patterns
- [Quota Management](./QUOTA.md) - Quota utilities and cost management
- [Testing Utilities](./TESTING.md) - Testing helpers and mocks
- [Socket API Reference](https://docs.socket.dev/reference) - Official API documentation
