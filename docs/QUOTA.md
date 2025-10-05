# Quota Management

Socket SDK provides comprehensive quota management utilities to help you optimize API usage and avoid quota exhaustion.

## Overview

Different API methods have different quota costs:
- **0 units**: Free tier methods (basic info, public data)
- **10 units**: Standard operations (scans, reports, policies)
- **100 units**: Resource-intensive operations (batch processing, streaming)

## Checking Your Quota

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')

const quotaResult = await client.getQuota()

if (quotaResult.success) {
  console.log(`Available quota: ${quotaResult.data.quota} units`)
  console.log(`Reset time: ${quotaResult.data.reset}`)
}
```

## Quota Utility Functions

### `getQuotaCost(methodName)`

Get the quota cost for a specific SDK method.

```typescript
import { getQuotaCost } from '@socketsecurity/sdk'

const batchCost = getQuotaCost('batchPackageFetch')
console.log(`Batch fetch costs: ${batchCost} units`) // 100

const scanCost = getQuotaCost('createOrgFullScan')
console.log(`Full scan costs: ${scanCost} units`) // 10

const quotaCost = getQuotaCost('getQuota')
console.log(`Quota check costs: ${quotaCost} units`) // 0 (free!)
```

### `calculateTotalQuotaCost(methodNames)`

Calculate total cost for multiple operations.

```typescript
import { calculateTotalQuotaCost } from '@socketsecurity/sdk'

const operations = [
  'batchPackageFetch',      // 100 units
  'getOrgAnalytics',        // 10 units
  'uploadManifestFiles',    // 100 units
  'getQuota'                // 0 units
]

const totalCost = calculateTotalQuotaCost(operations)
console.log(`Total cost: ${totalCost} units`) // 210
```

### `hasQuotaForMethods(availableQuota, methodNames)`

Check if you have sufficient quota for planned operations.

```typescript
import { SocketSdk, hasQuotaForMethods } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')

const operations = [
  'batchPackageFetch',
  'createOrgFullScan',
  'uploadManifestFiles'
]

const quotaResult = await client.getQuota()

if (quotaResult.success) {
  if (hasQuotaForMethods(quotaResult.data.quota, operations)) {
    console.log('Sufficient quota available')
    // Proceed with operations
  } else {
    console.log('Insufficient quota - use free alternatives')
  }
}
```

### `getMethodsByQuotaCost(cost)`

Find all methods with a specific quota cost.

```typescript
import { getMethodsByQuotaCost } from '@socketsecurity/sdk'

// Find all free methods (0 units)
const freeMethods = getMethodsByQuotaCost(0)
console.log('Free methods:', freeMethods)
// ['getQuota', 'getOrganizations', 'getEnabledEntitlements', ...]

// Find standard cost methods (10 units)
const standardMethods = getMethodsByQuotaCost(10)
console.log('Standard methods:', standardMethods)
// ['createOrgFullScan', 'getScan', 'getOrgAnalytics', ...]

// Find high-cost methods (100 units)
const expensiveMethods = getMethodsByQuotaCost(100)
console.log('Expensive methods:', expensiveMethods)
// ['batchPackageFetch', 'uploadManifestFiles', ...]
```

### `getMethodsByPermissions(permissions)`

Find methods requiring specific permissions.

```typescript
import { getMethodsByPermissions } from '@socketsecurity/sdk'

// Find methods that require read:scans permission
const scanReadMethods = getMethodsByPermissions(['read:scans'])
console.log('Methods requiring read:scans:', scanReadMethods)

// Find methods requiring multiple permissions
const adminMethods = getMethodsByPermissions(['write:policy', 'admin'])
console.log('Admin methods:', adminMethods)
```

### `getRequiredPermissions(methodName)`

Get permissions required for a specific method.

```typescript
import { getRequiredPermissions } from '@socketsecurity/sdk'

const scanPerms = getRequiredPermissions('createOrgFullScan')
console.log('Permissions:', scanPerms) // ['write:scans', 'read:repos']

const policyPerms = getRequiredPermissions('updateOrgSecurityPolicy')
console.log('Permissions:', policyPerms) // ['write:policy', 'admin']
```

### `getQuotaUsageSummary()`

Get a complete summary of all methods grouped by quota cost.

```typescript
import { getQuotaUsageSummary } from '@socketsecurity/sdk'

const summary = getQuotaUsageSummary()

console.log(`Free methods (0 units): ${summary.free.length}`)
for (const method of summary.free) {
  console.log(`  - ${method}`)
}

console.log(`\nStandard methods (10 units): ${summary.standard.length}`)
for (const method of summary.standard) {
  console.log(`  - ${method}`)
}

console.log(`\nExpensive methods (100 units): ${summary.expensive.length}`)
for (const method of summary.expensive) {
  console.log(`  - ${method}`)
}
```

### `getAllMethodRequirements()`

Get complete mapping of all methods to their costs and permissions.

```typescript
import { getAllMethodRequirements } from '@socketsecurity/sdk'

const requirements = getAllMethodRequirements()

for (const [method, info] of Object.entries(requirements)) {
  console.log(`${method}:`)
  console.log(`  Cost: ${info.cost} units`)
  console.log(`  Permissions: ${info.permissions.join(', ')}`)
}
```

## Practical Examples

### Pre-flight Quota Check

```typescript
import {
  SocketSdk,
  calculateTotalQuotaCost,
  hasQuotaForMethods
} from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')

async function runBatchAnalysis(packages: string[]) {
  // Calculate what we need
  const operations = ['batchPackageFetch', 'uploadManifestFiles']
  const requiredQuota = calculateTotalQuotaCost(operations)

  console.log(`Operations will cost ${requiredQuota} units`)

  // Check if we have enough
  const quotaResult = await client.getQuota()

  if (!quotaResult.success) {
    throw new Error('Failed to check quota')
  }

  if (!hasQuotaForMethods(quotaResult.data.quota, operations)) {
    throw new Error(
      `Insufficient quota. Need ${requiredQuota}, have ${quotaResult.data.quota}`
    )
  }

  // Proceed with operations
  console.log('Sufficient quota, proceeding...')
  // ... perform operations
}
```

### Optimize API Usage

```typescript
import {
  SocketSdk,
  getMethodsByQuotaCost,
  getQuotaCost
} from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')

async function optimizedAnalysis() {
  // Get quota first (free!)
  const quotaResult = await client.getQuota()

  if (!quotaResult.success) {
    throw new Error('Failed to check quota')
  }

  const available = quotaResult.data.quota

  // Use free methods when possible
  if (available < 100) {
    console.log('Low quota - using free tier methods only')
    const freeMethods = getMethodsByQuotaCost(0)
    console.log('Available free methods:', freeMethods)

    // Use getQuota, getOrganizations, etc.
  } else if (available < 500) {
    console.log('Medium quota - using standard methods')
    // Use methods costing 10 units
  } else {
    console.log('Plenty of quota - can use expensive operations')
    // Use batch methods, streaming, etc.
  }
}
```

### Monitor Quota Usage

```typescript
import {
  SocketSdk,
  getQuotaCost,
  calculateTotalQuotaCost
} from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')

class QuotaTracker {
  private usedQuota = 0
  private operations: string[] = []

  async trackOperation<T>(
    methodName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const cost = getQuotaCost(methodName)

    console.log(`Executing ${methodName} (${cost} units)...`)

    const result = await operation()

    this.usedQuota += cost
    this.operations.push(methodName)

    console.log(`Total used: ${this.usedQuota} units`)

    return result
  }

  getSummary() {
    return {
      totalUsed: this.usedQuota,
      operations: this.operations.length,
      breakdown: this.operations.reduce((acc, op) => {
        acc[op] = (acc[op] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }
}

// Usage
const tracker = new QuotaTracker()

await tracker.trackOperation('batchPackageFetch', () =>
  client.batchPackageFetch({ components: packages })
)

await tracker.trackOperation('createOrgFullScan', () =>
  client.createOrgFullScan('my-org', files, '.')
)

const summary = tracker.getSummary()
console.log('Quota usage summary:', summary)
```

### Smart Fallback Strategy

```typescript
import {
  SocketSdk,
  getQuotaCost,
  hasQuotaForMethods
} from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')

async function smartBatchAnalysis(packages: string[]) {
  const quotaResult = await client.getQuota()

  if (!quotaResult.success) {
    throw new Error('Failed to check quota')
  }

  const available = quotaResult.data.quota
  const batchCost = getQuotaCost('batchPackageFetch')

  if (available >= batchCost) {
    // Use efficient batch method
    console.log('Using batchPackageFetch (efficient)')
    return await client.batchPackageFetch({ components: packages })
  } else {
    // Fall back to free tier methods
    console.log('Low quota - using individual package queries')
    const results = []

    for (const pkg of packages) {
      const result = await client.getScoreByNpmPackage(pkg.name, pkg.version)
      if (result.success) {
        results.push(result.data)
      }
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return { success: true, data: results }
  }
}
```

### Quota Alerts

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key')

async function checkQuotaHealth() {
  const result = await client.getQuota()

  if (!result.success) {
    console.error('Failed to check quota')
    return
  }

  const quota = result.data.quota

  if (quota < 100) {
    console.error('🚨 CRITICAL: Quota below 100 units!')
    // Send alert, notify team, etc.
  } else if (quota < 500) {
    console.warn('⚠️ WARNING: Quota below 500 units')
    // Consider optimizing usage
  } else if (quota < 1000) {
    console.info('ℹ️ INFO: Quota below 1000 units')
    // Monitor usage
  } else {
    console.log('✅ Quota healthy:', quota, 'units')
  }

  return quota
}

// Run periodically
setInterval(checkQuotaHealth, 60 * 60 * 1000) // Every hour
```

## Quota Costs Reference

### Free Tier (0 units)
- `getQuota()`
- `getOrganizations()`
- `getEnabledEntitlements()`
- `getEntitlements()`

### Standard Operations (10 units)
- `createOrgFullScan()`
- `getScan()`
- `getScanList()`
- `getOrgAnalytics()`
- `getRepoAnalytics()`
- `getOrgSecurityPolicy()`
- `updateOrgSecurityPolicy()`
- `getOrgLicensePolicy()`
- `updateOrgLicensePolicy()`
- `getAuditLogEvents()`

### Resource-Intensive Operations (100 units)
- `batchPackageFetch()`
- `batchPackageStream()`
- `uploadManifestFiles()`
- `createDependenciesSnapshot()`

## Best Practices

1. **Always check quota before expensive operations**
   ```typescript
   const quota = await client.getQuota()
   if (quota.success && quota.data.quota > 100) {
     // Proceed with batch operation
   }
   ```

2. **Use free methods for health checks**
   ```typescript
   // Free quota check
   await client.getQuota()
   // Free organization list
   await client.getOrganizations()
   ```

3. **Batch operations when possible**
   ```typescript
   // Efficient: 100 units for all packages
   await client.batchPackageFetch({ components: allPackages })

   // Inefficient: 10 units per package
   for (const pkg of allPackages) {
     await client.getScoreByNpmPackage(pkg.name, pkg.version)
   }
   ```

4. **Monitor quota usage in production**
   ```typescript
   // Track usage with custom wrapper
   const tracker = new QuotaTracker()
   await tracker.trackOperation('methodName', () => client.method())
   ```

5. **Implement quota-aware retry strategies**
   ```typescript
   const client = new SocketSdk('key', {
     retries: 3, // Retry transient failures
     retryDelay: 1000
   })
   ```

## See Also

- [API Reference](./API.md) - Complete API documentation
- [Examples](./EXAMPLES.md) - Usage examples and patterns
- [Testing Utilities](./TESTING.md) - Testing helpers and mocks
