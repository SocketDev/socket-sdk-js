# Quota Management

API methods have different costs:
- **0 units** - Free (quota checks, organization lists, entitlements)
- **10 units** - Standard (scans, reports, policies)
- **100 units** - Resource-intensive (batch processing, file uploads)

## Check Quota

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')
const quota = await client.getQuota()

if (quota.success) {
  console.log(`Available: ${quota.data.quota} units`)
}
```

## Utilities

### `getQuotaCost(methodName)`

```typescript
import { getQuotaCost } from '@socketsecurity/sdk'

getQuotaCost('batchPackageFetch')  // 100
getQuotaCost('createOrgFullScan')  // 10
getQuotaCost('getQuota')           // 0
```

### `calculateTotalQuotaCost(methodNames)`

```typescript
import { calculateTotalQuotaCost } from '@socketsecurity/sdk'

const cost = calculateTotalQuotaCost([
  'batchPackageFetch',    // 100
  'getOrgAnalytics',      // 10
  'getQuota'              // 0
])
// Returns: 110
```

### `hasQuotaForMethods(availableQuota, methodNames)`

```typescript
import { SocketSdk, hasQuotaForMethods } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')
const quota = await client.getQuota()

if (quota.success) {
  const canProceed = hasQuotaForMethods(quota.data.quota, [
    'batchPackageFetch',
    'createOrgFullScan'
  ])

  if (canProceed) {
    // Proceed with operations
  }
}
```

### `getMethodsByQuotaCost(cost)`

```typescript
import { getMethodsByQuotaCost } from '@socketsecurity/sdk'

getMethodsByQuotaCost(0)    // ['getQuota', 'getOrganizations', ...]
getMethodsByQuotaCost(10)   // ['createOrgFullScan', 'getScan', ...]
getMethodsByQuotaCost(100)  // ['batchPackageFetch', ...]
```

### `getMethodsByPermissions(permissions)`

```typescript
import { getMethodsByPermissions } from '@socketsecurity/sdk'

getMethodsByPermissions(['read:scans'])  // Methods requiring read:scans
getMethodsByPermissions(['admin'])       // Admin-only methods
```

### `getRequiredPermissions(methodName)`

```typescript
import { getRequiredPermissions } from '@socketsecurity/sdk'

getRequiredPermissions('createOrgFullScan')        // ['write:scans', 'read:repos']
getRequiredPermissions('updateOrgSecurityPolicy')  // ['write:policy', 'admin']
```

### `getQuotaUsageSummary()`

```typescript
import { getQuotaUsageSummary } from '@socketsecurity/sdk'

const summary = getQuotaUsageSummary()

console.log(`Free: ${summary.free.length}`)
console.log(`Standard: ${summary.standard.length}`)
console.log(`Expensive: ${summary.expensive.length}`)
```

### `getAllMethodRequirements()`

```typescript
import { getAllMethodRequirements } from '@socketsecurity/sdk'

const requirements = getAllMethodRequirements()
// { methodName: { cost: number, permissions: string[] }, ... }
```

## Examples

### Pre-flight Check

```typescript
import { SocketSdk, calculateTotalQuotaCost, hasQuotaForMethods } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')

const operations = ['batchPackageFetch', 'uploadManifestFiles']
const required = calculateTotalQuotaCost(operations)

const quota = await client.getQuota()
if (!quota.success || !hasQuotaForMethods(quota.data.quota, operations)) {
  throw new Error(`Need ${required} units, have ${quota.data.quota}`)
}

// Proceed with operations
```

### Optimize Usage

```typescript
import { SocketSdk, getMethodsByQuotaCost } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')
const quota = await client.getQuota()

if (quota.success) {
  if (quota.data.quota < 100) {
    // Use free methods only
    const freeMethods = getMethodsByQuotaCost(0)
  } else if (quota.data.quota < 500) {
    // Use standard methods (10 units)
  } else {
    // Can use expensive operations (100 units)
  }
}
```

### Monitor Usage

```typescript
import { SocketSdk, getQuotaCost } from '@socketsecurity/sdk'

class QuotaTracker {
  private used = 0

  async track<T>(methodName: string, op: () => Promise<T>): Promise<T> {
    const cost = getQuotaCost(methodName)
    const result = await op()
    this.used += cost
    console.log(`Used ${this.used} units`)
    return result
  }
}

const tracker = new QuotaTracker()
await tracker.track('batchPackageFetch', () =>
  client.batchPackageFetch({ components })
)
```

### Fallback Strategy

```typescript
import { SocketSdk, getQuotaCost } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')

const quota = await client.getQuota()
const batchCost = getQuotaCost('batchPackageFetch')

if (quota.success && quota.data.quota >= batchCost) {
  // Use efficient batch method
  await client.batchPackageFetch({ components })
} else {
  // Fall back to individual queries
  for (const pkg of packages) {
    await client.getScoreByNpmPackage(pkg.name, pkg.version)
  }
}
```

## Costs Reference

**Free (0 units):** `getQuota`, `getOrganizations`, `getEnabledEntitlements`, `getEntitlements`

**Standard (10 units):** `createOrgFullScan`, `getScan`, `getScanList`, `getOrgAnalytics`, `getRepoAnalytics`, `getOrgSecurityPolicy`, `updateOrgSecurityPolicy`, `getOrgLicensePolicy`, `updateOrgLicensePolicy`, `getAuditLogEvents`

**Expensive (100 units):** `batchPackageFetch`, `batchPackageStream`, `uploadManifestFiles`, `createDependenciesSnapshot`

## Best Practices

- Check quota before expensive operations
- Use free methods (`getQuota`, `getOrganizations`) for health checks
- Batch operations when possible (100 units for all packages vs 10 per package)
- Monitor quota usage in production with quota tracker
- Configure retries for transient failures

## See Also

- [API Reference](./API.md) - Complete API documentation
- [Examples](./EXAMPLES.md) - Usage examples and patterns
- [Testing Utilities](./TESTING.md) - Testing helpers and mocks
