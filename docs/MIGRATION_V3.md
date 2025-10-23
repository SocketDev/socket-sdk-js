# Migration Guide: v2.x to v3.0

This guide helps you upgrade from Socket SDK v2.x to v3.0.

## Breaking Changes Overview

v3.0 introduces **better TypeScript developer experience** with:
- ✅ Renamed methods following REST conventions
- ✅ Strict types with required fields (not everything optional)
- ✅ Improved IntelliSense autocomplete
- ✅ Clear distinction between modern and legacy APIs
- ✅ Comprehensive JSDoc with examples

## Method Renames

### Full Scans (Modern API)

| v2.x Method | v3.0 Method | Notes |
|-------------|-------------|-------|
| `getOrgFullScanList()` | `listFullScans()` | Uses `ListFullScansOptions` |
| `createOrgFullScan()` | `createFullScan()` | Uses `CreateFullScanOptions` |
| `getOrgFullScanBuffered()` | `getFullScan()` | Clearer naming |
| `deleteOrgFullScan()` | `deleteFullScan()` | Clearer naming |
| `streamOrgFullScan()` | `streamFullScan()` | Uses `StreamFullScanOptions` |
| `getOrgFullScanMetadata()` | `getFullScanMetadata()` | Clearer naming |

### Organizations

| v2.x Method | v3.0 Method | Notes |
|-------------|-------------|-------|
| `getOrganizations()` | `listOrganizations()` | Consistent naming |

### Repositories

| v2.x Method | v3.0 Method | Notes |
|-------------|-------------|-------|
| `getOrgRepoList()` | `listRepositories()` | Uses `ListRepositoriesOptions` |
| `getOrgRepo()` | `getRepository()` | Clearer naming |
| `createOrgRepo()` | `createRepository()` | Clearer naming |
| `updateOrgRepo()` | `updateRepository()` | Clearer naming |
| `deleteOrgRepo()` | `deleteRepository()` | Clearer naming |

### Legacy Scans (Deprecated API Endpoints)

| v2.x Method | v3.0 Method | Notes |
|-------------|-------------|-------|
| `getScanList()` | `listScans()` | Maps to deprecated `/report/list` |
| `getScan()` | `getScan()` | Maps to deprecated `/report/view/{id}` |
| `createScanFromFilepaths()` | `createScan()` | Maps to deprecated `/report/upload` |
| `deleteReport()` | `deleteScan()` | Maps to deprecated `/report/delete/{id}` |

## Type Changes

### Strict Result Types

v3.0 introduces strict result types with guaranteed required fields:

**v2.x (all fields optional):**
```typescript
const result = await sdk.getOrgFullScanList('my-org')
if (result.success) {
  // TypeScript shows all fields as optional
  result.data.results[0].id  // Type: string | undefined
  result.data.results[0].created_at  // Type: string | undefined
}
```

**v3.0 (required fields guaranteed):**
```typescript
const result = await sdk.listFullScans('my-org')
if (result.success) {
  // TypeScript knows required fields are always present
  result.data.results[0].id  // Type: string  ✓
  result.data.results[0].created_at  // Type: string  ✓
  result.data.results[0].branch  // Type: string | null (truly optional)
}
```

### New Strict Types

- `FullScanListResult` - Replaces `SocketSdkResult<'getOrgFullScanList'>`
- `FullScanResult` - Replaces `SocketSdkResult<'CreateOrgFullScan'>`
- `OrganizationsResult` - Replaces `SocketSdkResult<'getOrganizations'>`
- `RepositoriesListResult` - Replaces `SocketSdkResult<'getOrgRepoList'>`
- `DeleteResult` - Standard delete operation result
- `StrictErrorResult` - Strict error type for all operations

### Options Type Changes

**v2.x:**
```typescript
await sdk.createOrgFullScan('my-org', ['package.json'], {
  pathsRelativeTo: './src',
  queryParams: {
    repo: 'my-repo',
    branch: 'main'
  }
})
```

**v3.0 (flattened structure):**
```typescript
await sdk.createFullScan('my-org', ['package.json'], {
  pathsRelativeTo: './src',
  repo: 'my-repo',  // Flattened - no more nested queryParams
  branch: 'main'
})
```

## Migration Examples

### Example 1: List Full Scans

**v2.x:**
```typescript
const result = await sdk.getOrgFullScanList('my-org', {
  per_page: 50,
  branch: 'main'
})

if (result.success) {
  result.data.results.forEach(scan => {
    // All fields show as optional in IntelliSense
    console.log(scan.id, scan.created_at)
  })
}
```

**v3.0:**
```typescript
const result = await sdk.listFullScans('my-org', {
  per_page: 50,
  branch: 'main'
})

if (result.success) {
  result.data.results.forEach(scan => {
    // Required fields autocomplete perfectly!
    console.log(scan.id, scan.created_at)  // TypeScript knows these exist
  })
}
```

### Example 2: Create Full Scan

**v2.x:**
```typescript
const result = await sdk.createOrgFullScan(
  'my-org',
  ['package.json', 'package-lock.json'],
  {
    pathsRelativeTo: './src',
    queryParams: {
      repo: 'my-repo',
      branch: 'main',
      commit_message: 'Update dependencies'
    }
  }
)
```

**v3.0:**
```typescript
const result = await sdk.createFullScan(
  'my-org',
  ['package.json', 'package-lock.json'],
  {
    pathsRelativeTo: './src',
    repo: 'my-repo',
    branch: 'main',
    commit_message: 'Update dependencies'
  }
)
```

### Example 3: Get Organization Scan

**v2.x:**
```typescript
const result = await sdk.getOrgFullScanBuffered('my-org', 'scan_123')
```

**v3.0:**
```typescript
const result = await sdk.getFullScan('my-org', 'scan_123')
```

## When to Use What?

### Modern Full Scans (Recommended)

Use these for all new code:

```typescript
// ✓ List all scans for an organization
await sdk.listFullScans('my-org', { branch: 'main' })

// ✓ Create a new scan
await sdk.createFullScan('my-org', files, {
  repo: 'my-repo',
  branch: 'main'
})

// ✓ Get scan details
await sdk.getFullScan('my-org', 'scan_123')

// ✓ Delete a scan
await sdk.deleteFullScan('my-org', 'scan_123')
```

### Legacy Scans (Avoid in New Code)

These map to deprecated API endpoints and should only be used for:
- Working with old reports from deprecated API
- Maintaining existing code that uses report IDs
- Backward compatibility

```typescript
// ⚠️ Maps to deprecated /report/list endpoint
await sdk.listScans()

// ⚠️ Maps to deprecated /report/view/{id} endpoint
await sdk.getScan('report_123')

// ⚠️ Maps to deprecated /report/upload endpoint
await sdk.createScan(['package.json'])
```

**Migration path:** If your code uses legacy scan methods, migrate to modern full scan methods which use the current API endpoints.

## Benefits of v3.0

### Better IntelliSense

v2.x shows everything as optional:
```typescript
result.data.results[0].  // Shows: id?, created_at?, updated_at?, ...
```

v3.0 shows required fields clearly:
```typescript
result.data.results[0].  // Shows: id, created_at, updated_at, branch?, ...
                         // Required fields show without ?, optional with ?
```

### Clearer Method Names

v3.0 method names follow REST conventions:
- `list*()` - Get a list of resources
- `get*()` - Get a single resource
- `create*()` - Create a new resource
- `update*()` - Update an existing resource
- `delete*()` - Delete a resource

### Better Documentation

All methods now have:
- Comprehensive examples
- Parameter descriptions
- API endpoint URLs
- Quota costs
- Required scopes

## Automated Migration

### Search and Replace

You can use these patterns for quick migration:

```bash
# Full scans
getOrgFullScanList → listFullScans
createOrgFullScan → createFullScan
getOrgFullScanBuffered → getFullScan
deleteOrgFullScan → deleteFullScan
streamOrgFullScan → streamFullScan
getOrgFullScanMetadata → getFullScanMetadata

# Organizations
getOrganizations → listOrganizations

# Repositories
getOrgRepoList → listRepositories
getOrgRepo → getRepository
createOrgRepo → createRepository
updateOrgRepo → updateRepository
deleteOrgRepo → deleteRepository

# Legacy scans
getScanList → listScans
deleteReport → deleteScan
createScanFromFilepaths → createScan
```

### Type Import Updates

```typescript
// v2.x
import type { SocketSdkResult } from '@socketsecurity/sdk'

// v3.0 - Also import strict types
import type {
  FullScanListResult,
  FullScanResult,
  OrganizationsResult,
  StrictErrorResult
} from '@socketsecurity/sdk'
```

## Rollback Plan

If you need to rollback to v2.x:

```bash
npm install @socketsecurity/sdk@^2.0.0
```

Then revert the method name changes using the reverse mappings above.

## Support

- **Documentation:** https://docs.socket.dev/reference/introduction-to-socket-api
- **Issues:** https://github.com/SocketDev/socket-sdk-js/issues
- **Discord:** https://socket.dev/discord

## Summary

v3.0 is a **quality of life upgrade** focused on:
1. Better TypeScript developer experience
2. Clearer, more consistent method names
3. Improved documentation with examples
4. Distinction between modern and legacy APIs

The migration is straightforward - mostly method renames and flattened options structures. The improved type safety and IntelliSense make the upgrade worthwhile.
