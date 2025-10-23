# When to Use What: Socket SDK v3 API Guide

This guide helps you choose the right SDK methods for your use case.

## Quick Decision Tree

```
Are you working with scans?
  └─ Yes
      ├─ Do you have an organization slug?
      │   └─ Yes → Use Modern Full Scans (listFullScans, createFullScan, etc.)
      │   └─ No → Use Legacy Scans (listScans, getScan, etc.)
      └─ Are you maintaining old code with "report" IDs?
          └─ Yes → Use Legacy Scans
          └─ No → Use Modern Full Scans
```

## Modern Full Scans (Recommended)

### When to Use

- ✅ Building new integrations
- ✅ You have an organization slug
- ✅ Need advanced filtering (branch, commit, PR)
- ✅ Want cursor-based pagination
- ✅ Working with CI/CD pipelines
- ✅ Need detailed scan metadata

### Key Features

- Organization-scoped
- Rich filtering options (branch, repo, commit, PR)
- Cursor and offset pagination
- Integration metadata (GitHub, GitLab, Bitbucket, Azure)
- Scan state tracking
- SBOM export support

### Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `listFullScans()` | List all scans for an org | Finding recent scans |
| `createFullScan()` | Create a new scan | CI/CD integration |
| `getFullScan()` | Get complete scan data | Viewing scan results |
| `streamFullScan()` | Stream large scan data | Processing huge SBOMs |
| `deleteFullScan()` | Remove a scan | Cleanup old scans |
| `getFullScanMetadata()` | Get scan metadata only | Quick status check |

### Example: CI/CD Integration

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const sdk = new SocketSdk(process.env.SOCKET_TOKEN)

// Create scan in CI/CD
const scan = await sdk.createFullScan('my-org',
  ['package.json', 'package-lock.json'],
  {
    repo: process.env.GITHUB_REPOSITORY,
    branch: process.env.GITHUB_REF_NAME,
    commit_hash: process.env.GITHUB_SHA,
    commit_message: process.env.COMMIT_MESSAGE,
    integration_type: 'github'
  }
)

if (scan.success) {
  console.log(`Scan created: ${scan.data.html_report_url}`)
  console.log(`Status: ${scan.data.scan_state}`)
}

// List recent scans for a branch
const scans = await sdk.listFullScans('my-org', {
  branch: 'main',
  per_page: 10,
  sort: 'created_at',
  direction: 'desc'
})

if (scans.success) {
  scans.data.results.forEach(scan => {
    console.log(`${scan.id}: ${scan.commit_message}`)
  })
}
```

---

## Legacy Scans (Deprecated API)

### When to Use

- ⚠️ Maintaining existing code with "report" IDs
- ⚠️ Working with old reports from deprecated API
- ⚠️ Backward compatibility requirements
- ⚠️ You don't have an organization slug

### Why They're Legacy

These methods map to deprecated API endpoints:
- `/report/list` (deprecated since 2023-01-15)
- `/report/view/{id}` (deprecated since 2023-01-15)
- `/report/upload` (deprecated since 2023-01-15)
- `/report/delete/{id}` (deprecated since 2023-01-15)

Socket recommends migrating to modern full scans (`/orgs/{org_slug}/full-scans`).

### Methods

| Method | Deprecated Endpoint | Migration Path |
|--------|---------------------|----------------|
| `listScans()` | `/report/list` | → `listFullScans()` |
| `getScan()` | `/report/view/{id}` | → `getFullScan()` |
| `createScan()` | `/report/upload` | → `createFullScan()` |
| `deleteScan()` | `/report/delete/{id}` | → `deleteFullScan()` |

### Example: Legacy Code Maintenance

```typescript
// Only use if you have existing "report" IDs
const legacyReport = await sdk.getScan('report_abc123')

if (legacyReport.success) {
  console.log('Legacy report data:', legacyReport.data)
}

// Listing legacy reports (no org required)
const legacyScans = await sdk.listScans()
```

---

## Organizations

### When to Use

- Listing organizations you have access to
- Getting organization details
- Building organization selectors

### Methods

| Method | Purpose |
|--------|---------|
| `listOrganizations()` | List all organizations accessible to current user |

### Example

```typescript
const orgs = await sdk.listOrganizations()

if (orgs.success) {
  orgs.data.organizations.forEach(org => {
    console.log(`${org.name} (${org.slug}) - ${org.plan}`)
  })
}
```

---

## Repositories

### When to Use

- Managing repositories in an organization
- Listing monitored repositories
- Creating/updating repository configurations
- Managing repository labels

### Methods

| Method | Purpose |
|--------|---------|
| `listRepositories()` | List all repositories in an org |
| `getRepository()` | Get single repository details |
| `createRepository()` | Register a new repository |
| `updateRepository()` | Update repository settings |
| `deleteRepository()` | Remove repository monitoring |
| `listRepositoryLabels()` | List labels for a repository |
| `createRepositoryLabel()` | Add a label to repository |
| `updateRepositoryLabel()` | Update a repository label |
| `deleteRepositoryLabel()` | Remove a repository label |

### Example

```typescript
// List repositories
const repos = await sdk.listRepositories('my-org', {
  per_page: 50
})

if (repos.success) {
  repos.data.results.forEach(repo => {
    console.log(`${repo.name} - ${repo.visibility}`)
  })
}

// Get specific repository
const repo = await sdk.getRepository('my-org', 'my-repo')

if (repo.success) {
  console.log('Default branch:', repo.data.default_branch)
  console.log('Homepage:', repo.data.homepage)
}
```

---

## Package Analysis

### When to Use

- Analyzing npm packages
- Checking package security scores
- Getting vulnerability information
- Batch package analysis

### Methods

| Method | Purpose |
|--------|---------|
| `batchPackageFetch()` | Analyze multiple packages at once |
| `batchPackageStream()` | Stream package analysis results |
| `getIssuesByNpmPackage()` | Get security issues for specific package/version |
| `getScoreByNpmPackage()` | Get security score for specific package/version |

### Example

```typescript
// Analyze multiple packages
const packages = await sdk.batchPackageFetch({
  components: [
    { purl: 'pkg:npm/lodash@4.17.21' },
    { purl: 'pkg:npm/axios@1.6.0' }
  ]
})

if (packages.success) {
  packages.data.forEach(pkg => {
    console.log(`${pkg.name}@${pkg.version}`)
    console.log(`Score: ${pkg.supplyChainRisk.score}`)
  })
}

// Stream large batch
for await (const result of sdk.batchPackageStream({
  components: largePurlList
})) {
  if (result.success) {
    console.log(result.data.name)
  }
}
```

---

## Dependencies & SBOM

### When to Use

- Creating dependency snapshots
- Uploading manifest files
- Exporting SBOMs (CycloneDX, SPDX)
- Searching dependencies

### Methods

| Method | Purpose |
|--------|---------|
| `createDependenciesSnapshot()` | Upload dependencies for analysis |
| `uploadManifestFiles()` | Upload manifest files to org |
| `exportCDX()` | Export scan as CycloneDX SBOM |
| `exportSPDX()` | Export scan as SPDX SBOM |
| `searchDependencies()` | Search across organization dependencies |

### Example

```typescript
// Create dependency snapshot
const snapshot = await sdk.createDependenciesSnapshot(
  ['package.json', 'package-lock.json'],
  { pathsRelativeTo: './my-project' }
)

// Export SBOM
const sbom = await sdk.exportCDX('my-org', 'scan_123')

if (sbom.success) {
  console.log(JSON.stringify(sbom.data, null, 2))
}
```

---

## Security Policies

### When to Use

- Managing organization security policies
- Configuring license policies
- Setting up alert rules
- Configuring issue severity thresholds

### Methods

| Method | Purpose |
|--------|---------|
| `getOrgSecurityPolicy()` | Get security policy configuration |
| `updateOrgSecurityPolicy()` | Update security policy rules |
| `getOrgLicensePolicy()` | Get license policy configuration |
| `updateOrgLicensePolicy()` | Update license policy rules |

### Example

```typescript
const policy = await sdk.getOrgSecurityPolicy('my-org')

if (policy.success) {
  console.log('Typosquat action:', policy.data.securityPolicyRules.typosquat)
}

// Update policy
await sdk.updateOrgSecurityPolicy('my-org', {
  securityPolicyRules: {
    typosquat: 'error',
    malware: 'error'
  }
})
```

---

## Diff Scans

### When to Use

- Comparing two full scans
- Finding changes between scans
- Reviewing scan differences

### Methods

| Method | Purpose |
|--------|---------|
| `listOrgDiffScans()` | List all diff scans |
| `createOrgDiffScanFromIds()` | Create diff between two scans |
| `getDiffScanById()` | Get diff scan details |
| `deleteOrgDiffScan()` | Delete a diff scan |

### Example

```typescript
// Create diff between two scans
const diff = await sdk.createOrgDiffScanFromIds('my-org', {
  base_scan_id: 'scan_old',
  head_scan_id: 'scan_new'
})

if (diff.success) {
  console.log('Diff created:', diff.data.id)
}
```

---

## Common Patterns

### Pattern 1: CI/CD Scan Creation

```typescript
// Best practice: Use modern full scans
const result = await sdk.createFullScan('my-org', files, {
  repo: REPO_NAME,
  branch: BRANCH_NAME,
  commit_hash: COMMIT_SHA,
  integration_type: 'github',
  set_as_pending_head: true
})
```

### Pattern 2: Finding Recent Scans

```typescript
// Use modern full scans with filtering
const scans = await sdk.listFullScans('my-org', {
  branch: 'main',
  per_page: 10,
  sort: 'created_at',
  direction: 'desc'
})
```

### Pattern 3: Package Analysis

```typescript
// Use batch methods for multiple packages
const results = await sdk.batchPackageFetch({
  components: purls.map(purl => ({ purl }))
})
```

## Decision Matrix

| Task | Use This | Not This |
|------|----------|----------|
| Scan in CI/CD | `createFullScan()` | `createScan()` |
| List org scans | `listFullScans()` | `listScans()` |
| Get scan by ID | `getFullScan()` + org slug | `getScan()` |
| Analyze packages | `batchPackageFetch()` | Individual API calls |
| Export SBOM | `exportCDX()` or `exportSPDX()` | Manual parsing |
| Manage repos | `listRepositories()` | Legacy methods |

## Summary

**For new code, always use:**
1. Modern full scans (`listFullScans`, `createFullScan`, etc.)
2. Organization-scoped methods
3. Batch methods for multiple packages
4. SBOM export methods

**Avoid in new code:**
1. Legacy scan methods (`listScans`, `getScan`, etc.)
2. Methods without organization scopes
3. Deprecated endpoints

The modern API provides better features, more filtering options, and is actively maintained by Socket.
