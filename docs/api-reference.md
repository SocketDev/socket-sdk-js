# API Reference

The Socket SDK provides TypeScript-typed access to all Socket Security API endpoints. All methods return a standardized result object with complete type safety.

## Result Object Structure

All SDK methods return a result object with this shape:

```typescript
// Success
{
  success: true
  status: number
  data: T  // Typed response data
}

// Error
{
  success: false
  status: number
  error: string
  cause?: string  // Additional error context
}
```

## Complete API Reference

For complete API method signatures and types:
- **TypeScript Types**: See `types/api.d.ts` in this repository (generated from OpenAPI spec)
- **Official API Docs**: https://docs.socket.dev/reference/
- **IntelliSense**: Your IDE provides autocomplete for all methods and parameters

## Key Examples

### Batch Package Analysis

Efficiently analyze multiple packages in parallel:

```typescript
const result = await sdk.batchPackageFetch(
  ['react@18.2.0', 'vue@3.3.4'],
  { includeTopLevelAncestors: true }
)

if (result.success) {
  for (const pkg of result.data.packages) {
    console.log(`${pkg.name}@${pkg.version}: ${pkg.score}/100`)
  }
}
```

### Full Repository Scan

Scan an entire repository for security issues:

```typescript
const result = await sdk.createFullScan(
  'my-org',
  ['package.json', 'package-lock.json'],
  {
    repo: 'my-repo',
    branch: 'main'
  }
)

if (result.success) {
  console.log(`Scan ID: ${result.data.id}`)
  console.log(`Status: ${result.data.status}`)
}
```

### Quota Management

Check API quota usage before making expensive calls:

```typescript
const quotaResult = await sdk.getQuota()
if (quotaResult.success) {
  const { total, used, remaining } = quotaResult.data.quota
  console.log(`Quota: ${used}/${total} (${remaining} remaining)`)
}
```

See also: [Quota Management Guide](./quota-management.md) for advanced quota utilities and strategies.
