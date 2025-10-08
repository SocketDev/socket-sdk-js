# Testing Utilities

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
```

## Quick Start

```typescript
import { describe, expect, it, vi } from 'vitest'
import { mockSuccessResponse, fixtures } from '@socketsecurity/sdk/testing'

describe('My App', () => {
  it('should handle successful API calls', async () => {
    const mockSdk = {
      getOrgRepo: vi.fn().mockResolvedValue(
        mockSuccessResponse(fixtures.repositories.basic)
      )
    }

    const result = await mockSdk.getOrgRepo('org', 'repo')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('test-repo')
    }
  })
})
```

## Response Builders

### `mockSuccessResponse(data, status?)`

```typescript
import { mockSuccessResponse } from '@socketsecurity/sdk/testing'

const response = mockSuccessResponse({ id: '123' }, 200)
// { success: true, status: 200, data: { id: '123' } }
```

### `mockErrorResponse(error, status?, cause?)`

```typescript
import { mockErrorResponse } from '@socketsecurity/sdk/testing'

const response = mockErrorResponse('Not found', 404)
// { success: false, status: 404, error: 'Not found' }
```

### `mockApiErrorBody(message, details?)`

```typescript
import { mockApiErrorBody } from '@socketsecurity/sdk/testing'
import nock from 'nock'

nock('https://api.socket.dev')
  .get('/v0/repo/org/repo')
  .reply(404, mockApiErrorBody('Repository not found'))

// Returns: { error: { message: 'Repository not found' } }
```

## Fixtures

```typescript
import { fixtures } from '@socketsecurity/sdk/testing'

// Organizations
fixtures.organizations.basic  // { id, name, plan }
fixtures.organizations.full   // + created_at, updated_at

// Repositories
fixtures.repositories.basic    // { id, name, archived, default_branch }
fixtures.repositories.archived // archived: true
fixtures.repositories.full     // + homepage, visibility, timestamps

// Scans
fixtures.scans.pending      // { id, status: 'pending', created_at }
fixtures.scans.completed    // + completed_at, issues_found: 0
fixtures.scans.withIssues   // issues_found > 0
fixtures.scans.failed       // status: 'failed', error

// Packages
fixtures.packages.safe        // { id, name, version, score: 95 }
fixtures.packages.vulnerable  // score: 45, issues: ['vulnerability']
fixtures.packages.malware     // score: 0, issues: ['malware']

// Issues
fixtures.issues.vulnerability  // { type, severity, key, description }
fixtures.issues.malware        // severity: 'critical'
fixtures.issues.license        // type: 'license'
```

## Error Mocking

### `mockSdkError(type, options?)`

```typescript
import { mockSdkError } from '@socketsecurity/sdk/testing'

mockSdkError('NOT_FOUND')      // status: 404
mockSdkError('UNAUTHORIZED')   // status: 401
mockSdkError('FORBIDDEN')      // status: 403
mockSdkError('SERVER_ERROR')   // status: 500
mockSdkError('TIMEOUT')        // status: 408

// Custom options
mockSdkError('NOT_FOUND', {
  message: 'Custom message',
  status: 422,
  cause: 'Additional context'
})
```

## Type Guards

### `isSuccessResult(result)`

```typescript
import { isSuccessResult } from '@socketsecurity/sdk/testing'

const result = await sdk.getOrgRepo('org', 'repo')
if (isSuccessResult(result)) {
  console.log(result.data.name)  // Type-safe
}
```

### `isErrorResult(result)`

```typescript
import { isErrorResult } from '@socketsecurity/sdk/testing'

const result = await sdk.getOrgRepo('org', 'missing')
if (isErrorResult(result)) {
  console.log(result.error)   // Type-safe
  console.log(result.status)
}
```

## Examples

### Unit Test

```typescript
import { describe, expect, it, vi } from 'vitest'
import { mockSuccessResponse, mockErrorResponse, fixtures } from '@socketsecurity/sdk/testing'

describe('Repository Service', () => {
  it('should fetch repository', async () => {
    const mockSdk = {
      getOrgRepo: vi.fn().mockResolvedValue(
        mockSuccessResponse(fixtures.repositories.full)
      )
    }

    const result = await mockSdk.getOrgRepo('org', 'repo')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('test-repo')
    }
  })

  it('should handle errors', async () => {
    const mockSdk = {
      getOrgRepo: vi.fn().mockResolvedValue(
        mockErrorResponse('Not found', 404)
      )
    }

    const result = await mockSdk.getOrgRepo('org', 'missing')
    expect(result.success).toBe(false)
  })
})
```

### Integration Test

```typescript
import nock from 'nock'
import { SocketSdk } from '@socketsecurity/sdk'
import { mockApiErrorBody } from '@socketsecurity/sdk/testing'

describe('Socket SDK', () => {
  afterEach(() => nock.cleanAll())

  it('should handle API errors', async () => {
    nock('https://api.socket.dev')
      .get('/v0/repo/org/repo')
      .reply(404, mockApiErrorBody('Not found'))

    const client = new SocketSdk('test-token')
    const result = await client.getOrgRepo('org', 'repo')

    expect(result.success).toBe(false)
  })
})
```

### Mock Streaming

```typescript
import { mockSuccessResponse, fixtures, isSuccessResult } from '@socketsecurity/sdk/testing'

async function* mockStream() {
  yield mockSuccessResponse(fixtures.packages.safe)
  yield mockSuccessResponse(fixtures.packages.vulnerable)
}

const mockSdk = {
  batchPackageStream: vi.fn().mockReturnValue(mockStream())
}

const results = []
for await (const result of mockSdk.batchPackageStream({ components: [] })) {
  if (isSuccessResult(result)) results.push(result.data)
}
```

## Best Practices

- Use provided fixtures instead of creating test data inline
- Use type guards (`isSuccessResult`, `isErrorResult`) for type safety
- Test both success and error paths
- Use descriptive error messages with `mockSdkError`
- Clean up mocks with `nock.cleanAll()` in `afterEach()`

## See Also

- [API Reference](../api-reference.md) - Complete API documentation
- [Examples](../usage-examples.md) - Usage examples and patterns
- [Quota Management](../quota-management.md) - Quota utilities and cost management
