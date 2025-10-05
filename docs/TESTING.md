# Testing Utilities

Socket SDK provides comprehensive testing utilities to make mocking and testing easier.

## Installation

The testing utilities are exported from the SDK:

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
import { SocketSdk } from '@socketsecurity/sdk'
import {
  mockSuccessResponse,
  mockErrorResponse,
  fixtures
} from '@socketsecurity/sdk/testing'

describe('My App', () => {
  it('should handle successful API calls', async () => {
    // Create mock SDK
    const mockSdk = {
      getOrgRepo: vi.fn().mockResolvedValue(
        mockSuccessResponse(fixtures.repositories.basic)
      )
    } as unknown as SocketSdk

    // Use in tests
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

Create a successful SDK response.

```typescript
import { mockSuccessResponse } from '@socketsecurity/sdk/testing'

const response = mockSuccessResponse(
  { id: '123', name: 'test' },
  200
)

expect(response).toEqual({
  success: true,
  status: 200,
  data: { id: '123', name: 'test' },
  error: undefined,
  cause: undefined
})
```

### `mockErrorResponse(error, status?, cause?)`

Create an error SDK response.

```typescript
import { mockErrorResponse } from '@socketsecurity/sdk/testing'

const response = mockErrorResponse(
  'Not found',
  404,
  'Resource does not exist'
)

expect(response).toEqual({
  success: false,
  status: 404,
  error: 'Not found',
  data: undefined,
  cause: 'Resource does not exist'
})
```

### `mockApiErrorBody(message, details?)`

Create Socket API error response structure (for use with nock/msw).

```typescript
import { mockApiErrorBody } from '@socketsecurity/sdk/testing'
import nock from 'nock'

nock('https://api.socket.dev')
  .get('/v0/repo/org/repo')
  .reply(404, mockApiErrorBody('Repository not found'))

// Returns:
// {
//   error: {
//     message: 'Repository not found'
//   }
// }

// With details
nock('https://api.socket.dev')
  .post('/v0/scan')
  .reply(400, mockApiErrorBody('Validation failed', {
    field: 'name',
    reason: 'required'
  }))
```

## Fixtures

Pre-built test data for common Socket API entities.

### Organizations

```typescript
import { fixtures } from '@socketsecurity/sdk/testing'

// Basic organization
fixtures.organizations.basic
// { id: 'org_123', name: 'test-org', plan: 'free' }

// Full organization
fixtures.organizations.full
// {
//   id: 'org_123',
//   name: 'test-org',
//   plan: 'enterprise',
//   created_at: '2024-01-01T00:00:00Z',
//   updated_at: '2024-01-02T00:00:00Z'
// }
```

### Repositories

```typescript
// Basic repository
fixtures.repositories.basic
// { id: 'repo_123', name: 'test-repo', archived: false, default_branch: 'main' }

// Archived repository
fixtures.repositories.archived
// { id: 'repo_456', name: 'old-repo', archived: true, default_branch: 'master' }

// Full repository details
fixtures.repositories.full
// {
//   id: 'repo_123',
//   name: 'test-repo',
//   archived: false,
//   default_branch: 'main',
//   homepage: 'https://example.com',
//   visibility: 'public',
//   created_at: '2024-01-01T00:00:00Z',
//   updated_at: '2024-01-02T00:00:00Z'
// }
```

### Scans

```typescript
// Pending scan
fixtures.scans.pending
// { id: 'scan_pending', status: 'pending', created_at: '2024-01-01T00:00:00Z' }

// Completed scan
fixtures.scans.completed
// {
//   id: 'scan_completed',
//   status: 'completed',
//   created_at: '2024-01-01T00:00:00Z',
//   completed_at: '2024-01-01T00:01:00Z',
//   issues_found: 0
// }

// Scan with issues
fixtures.scans.withIssues
// { ..., issues_found: 3 }

// Failed scan
fixtures.scans.failed
// { id: 'scan_failed', status: 'failed', created_at: '...', error: 'Scan timeout' }
```

### Packages

```typescript
// Safe package
fixtures.packages.safe
// { id: 'pkg_safe', name: 'safe-package', version: '1.0.0', score: 95 }

// Vulnerable package
fixtures.packages.vulnerable
// {
//   id: 'pkg_vuln',
//   name: 'vulnerable-package',
//   version: '2.0.0',
//   score: 45,
//   issues: ['vulnerability']
// }

// Malware package
fixtures.packages.malware
// {
//   id: 'pkg_malware',
//   name: 'malware-package',
//   version: '3.0.0',
//   score: 0,
//   issues: ['malware']
// }
```

### Issues

```typescript
// Vulnerability issue
fixtures.issues.vulnerability
// {
//   type: 'vulnerability',
//   severity: 'high',
//   key: 'CVE-2024-1234',
//   description: 'SQL Injection vulnerability'
// }

// Malware issue
fixtures.issues.malware
// {
//   type: 'malware',
//   severity: 'critical',
//   key: 'malware-detected',
//   description: 'Malicious code detected'
// }

// License issue
fixtures.issues.license
// {
//   type: 'license',
//   severity: 'medium',
//   key: 'license-incompatible',
//   description: 'License incompatible with project'
// }
```

## Error Mocking

### `mockSdkError(type, options?)`

Create Socket SDK error with proper structure.

```typescript
import { mockSdkError } from '@socketsecurity/sdk/testing'

// NOT_FOUND error
const notFoundError = mockSdkError('NOT_FOUND')
// Error: 'Resource not found', status: 404

// UNAUTHORIZED error
const authError = mockSdkError('UNAUTHORIZED')
// Error: 'Unauthorized', status: 401

// FORBIDDEN error
const forbiddenError = mockSdkError('FORBIDDEN')
// Error: 'Access forbidden', status: 403

// SERVER_ERROR
const serverError = mockSdkError('SERVER_ERROR')
// Error: 'Internal server error', status: 500

// TIMEOUT
const timeoutError = mockSdkError('TIMEOUT')
// Error: 'Request timeout', status: 408

// Custom message and status
const customError = mockSdkError('NOT_FOUND', {
  message: 'Custom error message',
  status: 422,
  cause: 'Additional context'
})
```

## Type Guards

### `isSuccessResult(result)`

Type-safe check for successful results.

```typescript
import { isSuccessResult } from '@socketsecurity/sdk/testing'

const result = await sdk.getOrgRepo('org', 'repo')

if (isSuccessResult(result)) {
  // TypeScript knows result.data exists
  console.log(result.data.name)
  // result.error does not exist here
}
```

### `isErrorResult(result)`

Type-safe check for error results.

```typescript
import { isErrorResult } from '@socketsecurity/sdk/testing'

const result = await sdk.getOrgRepo('org', 'missing')

if (isErrorResult(result)) {
  // TypeScript knows result.error exists
  console.log(result.error)
  console.log(result.status)
  console.log(result.cause)
  // result.data does not exist here
}
```

## Complete Testing Examples

### Unit Test with Mocked SDK

```typescript
import { describe, expect, it, vi } from 'vitest'
import { SocketSdk } from '@socketsecurity/sdk'
import {
  mockSuccessResponse,
  mockErrorResponse,
  fixtures
} from '@socketsecurity/sdk/testing'

describe('Repository Service', () => {
  it('should fetch repository details', async () => {
    const mockSdk = {
      getOrgRepo: vi.fn().mockResolvedValue(
        mockSuccessResponse(fixtures.repositories.full)
      )
    } as unknown as SocketSdk

    const result = await mockSdk.getOrgRepo('my-org', 'my-repo')

    expect(mockSdk.getOrgRepo).toHaveBeenCalledWith('my-org', 'my-repo')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('test-repo')
      expect(result.data.archived).toBe(false)
    }
  })

  it('should handle missing repository', async () => {
    const mockSdk = {
      getOrgRepo: vi.fn().mockResolvedValue(
        mockErrorResponse('Repository not found', 404)
      )
    } as unknown as SocketSdk

    const result = await mockSdk.getOrgRepo('my-org', 'missing')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Repository not found')
      expect(result.status).toBe(404)
    }
  })
})
```

### Integration Test with nock

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import nock from 'nock'
import { SocketSdk } from '@socketsecurity/sdk'
import {
  mockApiErrorBody,
  fixtures
} from '@socketsecurity/sdk/testing'

describe('Socket SDK Integration', () => {
  beforeEach(() => {
    nock.disableNetConnect()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('should handle successful scan creation', async () => {
    nock('https://api.socket.dev')
      .post('/v0/scans')
      .reply(200, {
        id: 'scan_123',
        status: 'pending'
      })

    const client = new SocketSdk('test-token')
    const result = await client.createScanFromFilepaths(['package.json'])

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('scan_123')
    }
  })

  it('should handle API errors', async () => {
    nock('https://api.socket.dev')
      .get('/v0/repo/org/repo')
      .reply(404, mockApiErrorBody('Repository not found'))

    const client = new SocketSdk('test-token')
    const result = await client.getOrgRepo('org', 'repo')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(404)
    }
  })
})
```

### Test Error Scenarios

```typescript
import { describe, expect, it, vi } from 'vitest'
import { mockSdkError } from '@socketsecurity/sdk/testing'

describe('Error Handling', () => {
  it('should handle authentication errors', async () => {
    const mockSdk = {
      getOrgRepo: vi.fn().mockRejectedValue(
        mockSdkError('UNAUTHORIZED')
      )
    }

    await expect(
      mockSdk.getOrgRepo('org', 'repo')
    ).rejects.toMatchObject({
      message: 'Unauthorized',
      status: 401
    })
  })

  it('should handle timeout errors', async () => {
    const mockSdk = {
      batchPackageFetch: vi.fn().mockRejectedValue(
        mockSdkError('TIMEOUT', {
          message: 'Request timed out after 30s',
          cause: 'Network latency'
        })
      )
    }

    await expect(
      mockSdk.batchPackageFetch({ components: [] })
    ).rejects.toMatchObject({
      message: 'Request timed out after 30s',
      status: 408,
      cause: 'Network latency'
    })
  })
})
```

### Test with Type Guards

```typescript
import { describe, expect, it, vi } from 'vitest'
import {
  mockSuccessResponse,
  mockErrorResponse,
  isSuccessResult,
  isErrorResult
} from '@socketsecurity/sdk/testing'

describe('Type Guards', () => {
  it('should narrow types correctly', async () => {
    const successResult = mockSuccessResponse({ id: '123' })
    const errorResult = mockErrorResponse('Error')

    // Success case
    if (isSuccessResult(successResult)) {
      expect(successResult.data.id).toBe('123')
      // TypeScript error if we try to access .error
    }

    // Error case
    if (isErrorResult(errorResult)) {
      expect(errorResult.error).toBe('Error')
      // TypeScript error if we try to access .data
    }
  })
})
```

### Mock Streaming Operations

```typescript
import { describe, expect, it, vi } from 'vitest'
import { mockSuccessResponse, fixtures } from '@socketsecurity/sdk/testing'

describe('Streaming', () => {
  it('should handle batch package stream', async () => {
    async function* mockStream() {
      yield mockSuccessResponse(fixtures.packages.safe)
      yield mockSuccessResponse(fixtures.packages.vulnerable)
      yield mockSuccessResponse(fixtures.packages.malware)
    }

    const mockSdk = {
      batchPackageStream: vi.fn().mockReturnValue(mockStream())
    }

    const results = []
    for await (const result of mockSdk.batchPackageStream({ components: [] })) {
      if (isSuccessResult(result)) {
        results.push(result.data)
      }
    }

    expect(results).toHaveLength(3)
    expect(results[0].score).toBe(95) // safe package
    expect(results[1].score).toBe(45) // vulnerable package
    expect(results[2].score).toBe(0)  // malware package
  })
})
```

## Best Practices

### 1. Use Fixtures for Consistency

```typescript
// ✅ Good: Use provided fixtures
const mockRepo = fixtures.repositories.full

// ❌ Avoid: Creating test data inline everywhere
const mockRepo = { id: 'repo_1', name: 'test', archived: false, ... }
```

### 2. Type-Safe Mocking

```typescript
// ✅ Good: Use type guards
if (isSuccessResult(result)) {
  console.log(result.data.name) // Type-safe
}

// ❌ Avoid: Unsafe type assertions
const data = (result as any).data
```

### 3. Test Both Success and Error Paths

```typescript
describe('getOrgRepo', () => {
  it('should return repository on success', async () => {
    // Test success case
  })

  it('should handle 404 errors', async () => {
    // Test error case
  })

  it('should handle network errors', async () => {
    // Test network failure
  })
})
```

### 4. Use Descriptive Error Messages

```typescript
// ✅ Good: Descriptive errors
mockSdkError('NOT_FOUND', {
  message: 'Repository "my-repo" not found in organization "my-org"',
  cause: 'Repository was deleted 30 days ago'
})

// ❌ Avoid: Generic errors
mockSdkError('NOT_FOUND')
```

### 5. Clean Up Mocks

```typescript
import nock from 'nock'

describe('API Tests', () => {
  afterEach(() => {
    nock.cleanAll() // Clean up after each test
  })

  afterAll(() => {
    nock.restore() // Restore after all tests
  })
})
```

## See Also

- [API Reference](./API.md) - Complete API documentation
- [Examples](./EXAMPLES.md) - Usage examples and patterns
- [Quota Management](./QUOTA.md) - Quota utilities and cost management
