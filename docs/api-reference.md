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
  url?: string    // Request URL (useful for debugging)
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
  {
    components: [
      { purl: 'pkg:npm/react@18.2.0' },
      { purl: 'pkg:npm/vue@3.3.4' },
    ],
  },
  { alerts: true, compact: true },
)

if (result.success) {
  for (const pkg of result.data) {
    console.log(`${pkg.name}@${pkg.version}: ${pkg.score?.overall ?? 'N/A'}`)
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
    branch: 'main',
  },
)

if (result.success) {
  console.log(`Scan ID: ${result.data.id}`)
  console.log(`Scan State: ${result.data.scan_state}`)
}
```

### Quota Management

Check API quota usage before making expensive calls:

```typescript
const quotaResult = await sdk.getQuota()
if (quotaResult.success) {
  const quota = quotaResult.data.quota
  console.log(`Available quota: ${quota} units`)
}
```

See also: [Quota Management Guide](./quota-management.md) for advanced quota utilities and strategies.
