# Quota Management

API methods cost: 0 (free), 10 (standard), or 100 (resource-intensive)) units.

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

```typescript
import {
  getQuotaCost,
  calculateTotalQuotaCost,
  hasQuotaForMethods,
  getMethodsByQuotaCost
} from '@socketsecurity/sdk'

// Get method cost
getQuotaCost('batchPackageFetch')  // 100
getQuotaCost('createOrgFullScan')  // 10
getQuotaCost('getQuota')           // 0

// Calculate total
const cost = calculateTotalQuotaCost([
  'batchPackageFetch',  // 100
  'getOrgAnalytics',    // 10
  'getQuota'            // 0
])  // Returns: 110

// Check quota
const canProceed = hasQuotaForMethods(availableQuota, [
  'batchPackageFetch',
  'createOrgFullScan'
])

// Methods by cost
getMethodsByQuotaCost(0)    // Free methods
getMethodsByQuotaCost(10)   // Standard methods
getMethodsByQuotaCost(100)  // Expensive methods
```

## Examples

### Pre-flight Check

```typescript
const operations = ['batchPackageFetch', 'uploadManifestFiles']
const required = calculateTotalQuotaCost(operations)

const quota = await client.getQuota()
if (!quota.success || !hasQuotaForMethods(quota.data.quota, operations)) {
  throw new Error(`Need ${required} units, have ${quota.data.quota}`)
}
```

### Monitor Usage

```typescript
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
```

### Fallback Strategy

```typescript
const quota = await client.getQuota()
const batchCost = getQuotaCost('batchPackageFetch')

if (quota.success && quota.data.quota >= batchCost) {
  await client.batchPackageFetch({ components })
} else {
  // Fall back to individual queries
  for (const pkg of packages) {
    await client.getScoreByNpmPackage(pkg.name, pkg.version)
  }
}
```

## Cost Reference

- **Free (0):** `getQuota`, `getOrganizations`, `getEnabledEntitlements`, `getEntitlements`
- **Standard (10):** `createOrgFullScan`, `getScan`, `getScanList`, `getOrgAnalytics`, `getOrgSecurityPolicy`, `updateOrgSecurityPolicy`
- **Expensive (100):** `batchPackageFetch`, `batchPackageStream`, `uploadManifestFiles`, `createDependenciesSnapshot`

## Best Practices

- Check quota before expensive operations
- Use batching (100 units for all vs 10 per package)
- Monitor usage with tracker
- Implement fallback strategies
