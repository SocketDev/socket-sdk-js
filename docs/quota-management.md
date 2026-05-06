# Quota Management

Every Socket API call costs a fixed number of quota units:

| Cost | Tier      | What's in it                                                                                  |
| ---- | --------- | --------------------------------------------------------------------------------------------- |
| `0`  | Free      | Status and listing methods — `getQuota`, `listOrganizations`, `getEntitlements`, scan CRUD, repo management, triage, labels, exports. |
| `10` | Standard  | Per-package reads and analytics — `getScoreByNpmPackage`, `getIssuesByNpmPackage`, `getOrgAnalytics`, `getRepoAnalytics`, `getAuditLogEvents`, API-token operations. |
| `100`| Expensive | Batch and scan creation — `batchPackageFetch`, `batchOrgPackageFetch`, `batchPackageStream`, `createDependenciesSnapshot`, `createScanFromFilepaths`, `searchDependencies`, `uploadManifestFiles`. |

The authoritative per-method table is [`data/api-method-quota-and-permissions.json`](../data/api-method-quota-and-permissions.json).

## Check your quota

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-token')
const quota = await client.getQuota()

if (quota.success) {
  console.log(`Available: ${quota.data.quota} units`)
}
```

`getQuota()` itself is free.

## Helpers

The SDK exports four helpers for planning quota usage:

```typescript
import {
  calculateTotalQuotaCost,
  getMethodsByQuotaCost,
  getQuotaCost,
  hasQuotaForMethods,
} from '@socketsecurity/sdk'

getQuotaCost('batchPackageFetch')         // 100
getQuotaCost('getQuota')                  // 0

calculateTotalQuotaCost([                 // 110
  'batchPackageFetch',
  'getOrgAnalytics',
])

hasQuotaForMethods(50, ['batchPackageFetch'])  // false — needs 100

getMethodsByQuotaCost(0)                  // ['getQuota', 'listOrganizations', …]
```

## Pre-flight check

Before kicking off an expensive batch, confirm you can afford the whole job:

```typescript
const planned = ['batchPackageFetch', 'uploadManifestFiles']
const required = calculateTotalQuotaCost(planned)

const quota = await client.getQuota()
if (!quota.success || !hasQuotaForMethods(quota.data.quota, planned)) {
  throw new Error(`Need ${required} units, have ${quota.data?.quota ?? 0}`)
}
```

## Practical tips

- **Batch instead of looping.** `batchPackageFetch` is 100 units total for any number of packages; calling `getScoreByNpmPackage` in a loop is 10 units *per package*. Past 10 packages, batching is cheaper.
- **Cache `getQuota()`.** Pass `{ cache: true }` to the SDK constructor — `getQuota` and `listOrganizations` will be cached for 5 minutes by default.
- **Quota is per-organization, not per-token.** If you hit the limit, all tokens for that org hit it.
