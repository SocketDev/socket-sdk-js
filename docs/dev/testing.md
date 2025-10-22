# Testing Utilities

Test helpers for Socket SDK provided by `@socketsecurity/sdk/testing`.

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

```typescript
import {
  mockSuccessResponse,
  mockErrorResponse,
  mockApiErrorBody,
  mockSdkError
} from '@socketsecurity/sdk/testing'

// Success response
mockSuccessResponse({ id: '123' }, 200)
// { success: true, status: 200, data: { id: '123' } }

// Error response
mockErrorResponse('Not found', 404)
// { success: false, status: 404, error: 'Not found' }

// API error body (for nock)
mockApiErrorBody('Repository not found')
// { error: { message: 'Repository not found' } }

// Common errors
mockSdkError('NOT_FOUND')      // status: 404
mockSdkError('UNAUTHORIZED')   // status: 401
mockSdkError('SERVER_ERROR')   // status: 500
```

## Fixtures

```typescript
import { fixtures } from '@socketsecurity/sdk/testing'

// Organizations
fixtures.organizations.basic  // { id, name, plan }
fixtures.organizations.full   // + timestamps

// Repositories
fixtures.repositories.basic    // { id, name, archived, default_branch }
fixtures.repositories.full     // + homepage, visibility, timestamps

// Scans
fixtures.scans.pending      // { id, status: 'pending' }
fixtures.scans.completed    // + completed_at
fixtures.scans.withIssues   // issues_found > 0

// Packages
fixtures.packages.safe        // { score: 95 }
fixtures.packages.vulnerable  // { score: 45 }
fixtures.packages.malware     // { score: 0 }
```

## Type Guards

```typescript
import { isSuccessResult, isErrorResult } from '@socketsecurity/sdk/testing'

if (isSuccessResult(result)) {
  console.log(result.data)  // Type-safe
}

if (isErrorResult(result)) {
  console.log(result.error)  // Type-safe
}
```

## Examples

### Unit Test

```typescript
import { mockSuccessResponse, fixtures } from '@socketsecurity/sdk/testing'

it('should fetch repository', async () => {
  const mockSdk = {
    getOrgRepo: vi.fn().mockResolvedValue(
      mockSuccessResponse(fixtures.repositories.full)
    )
  }

  const result = await mockSdk.getOrgRepo('org', 'repo')
  expect(result.success).toBe(true)
})
```

### Integration Test

```typescript
import nock from 'nock'
import { SocketSdk } from '@socketsecurity/sdk'
import { mockApiErrorBody } from '@socketsecurity/sdk/testing'

it('should handle API errors', async () => {
  nock('https://api.socket.dev')
    .get('/v0/repo/org/repo')
    .reply(404, mockApiErrorBody('Not found'))

  const client = new SocketSdk('test-token')
  const result = await client.getOrgRepo('org', 'repo')

  expect(result.success).toBe(false)
})
```

## See Also

- [API Reference](../api-reference.md) - Complete API documentation
- [Test Style Guide](../test-style-guide.md) - Testing patterns
- [Test Utils README](../../test/utils/README.md) - Environment helpers
