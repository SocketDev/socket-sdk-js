# testing guide

Comprehensive guide to testing Socket SDK - covers test environment setup, utilities, fixtures, and patterns.

## quick start

```typescript
import { describe, expect, it } from 'vitest'
import { setupTestClient } from './utils/environment.mts'
import nock from 'nock'

describe('SocketSdk - Quota', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  it('should fetch quota successfully', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(200, { quota: 1000 })

    const result = await getClient().getQuota()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quota).toBe(1000)
    }
  })
})
```

---

## test environment helpers

Internal utilities for SDK development (from `test/utils/environment.mts`).

### `setupTestClient(token?, options?)` - RECOMMENDED

Combines nock setup and client creation with automatic cleanup.

```typescript
const getClient = setupTestClient('test-token', { retries: 0 })
// Fresh client for each test with nock auto cleanup
```

**When to use:** 90% of SDK tests
**Benefits:**
- Automatic nock lifecycle management
- Fresh client per test
- No cleanup boilerplate

### `setupTestEnvironment()`

Just nock environment setup without client creation.

```typescript
setupTestEnvironment()  // Use when creating custom SDK instances
```

**When to use:** Tests that need manual control over client creation

### `createTestClient(token?, options?)`

Create test client without automatic environment setup.

```typescript
const client = createTestClient('test-token', { retries: 0 })
```

**When to use:** Unit tests without HTTP mocking, or manual client management

### `isCoverageMode`

Boolean flag indicating if tests are running in coverage mode.

```typescript
import { isCoverageMode } from './utils/environment.mts'

if (isCoverageMode) {
  // Adjust test behavior for coverage mode
}
```

### fast test configuration

`FAST_TEST_CONFIG` is automatically applied by test helpers:

```typescript
{
  retries: 0,         // No retries
  retryDelay: 0,      // No delay
  timeout: 5000       // 5 second timeout
}
```

---

## public testing utilities

Utilities exported from `@socketsecurity/sdk/testing` for external use.

### response builders

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

### fixtures

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

### type guards

```typescript
import { isSuccessResult, isErrorResult } from '@socketsecurity/sdk/testing'

if (isSuccessResult(result)) {
  console.log(result.data)  // Type-safe
}

if (isErrorResult(result)) {
  console.log(result.error)  // Type-safe
}
```

---

## usage patterns

### basic SDK test

```typescript
import { setupTestClient } from './utils/environment.mts'

describe('SocketSdk - Quota', () => {
  const getClient = setupTestClient()

  it('should fetch quota', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(200, { quota: 1000 })

    const result = await getClient().getQuota()
    expect(result.success).toBe(true)
  })

  it('should handle 401', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(401, { error: { message: 'Unauthorized' } })

    const result = await getClient().getQuota()
    expect(result.success).toBe(false)
  })
})
```

### custom SDK configuration

```typescript
const getClient = setupTestClient('test-token', {
  baseUrl: 'https://custom.api.socket.dev',
  timeout: 10000,
  userAgent: 'Test/1.0'
})
```

### multiple API calls

```typescript
it('should handle multiple nock mocks', async () => {
  nock('https://api.socket.dev')
    .get('/v0/orgs/test-org/repos')
    .reply(200, { repos: [...] })
    .get('/v0/orgs/test-org/repos/repo1')
    .reply(200, { name: 'repo1' })

  const repoList = await getClient().getOrgRepoList('test-org')
  const repo1 = await getClient().getOrgRepo('test-org', 'repo1')

  expect(repoList.success).toBe(true)
  expect(repo1.success).toBe(true)
})
```

### unit test with fixtures

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

### integration test with nock

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

### error handling

```typescript
describe('Error Handling', () => {
  const getClient = setupTestClient()

  it('should handle 404', async () => {
    nock('https://api.socket.dev')
      .get('/v0/nonexistent')
      .reply(404, { error: { message: 'Not found' } })

    const result = await getClient().getData()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(404)
    }
  })

  it('should handle network errors', async () => {
    nock('https://api.socket.dev')
      .get('/v0/endpoint')
      .replyWithError('ECONNREFUSED')

    await expect(getClient().getData()).rejects.toThrow()
  })
})
```

---

## best practices

### 1. always use helper functions

```typescript
// ✅ Good
const getClient = setupTestClient()

// ❌ Bad
beforeEach(() => { nock.restore(); nock.activate() })
```

### 2. type-safe result checking

```typescript
// ✅ Good
if (result.success) {
  expect(result.data.quota).toBe(1000)  // TypeScript knows data exists
}

// ❌ Bad
expect(result.data.quota).toBe(1000)  // TypeScript error
```

### 3. test both success and error paths

```typescript
describe('Complete Coverage', () => {
  it('should handle success', async () => { /* ... */ })
  it('should handle 401 error', async () => { /* ... */ })
  it('should handle network error', async () => { /* ... */ })
})
```

### 4. use fast test config

```typescript
// ✅ Good
const getClient = setupTestClient('test-token', { retries: 0 })

// ❌ Bad (slow)
const getClient = setupTestClient('test-token', {
  retries: 3,
  retryDelay: 1000
})
```

---

## helper selection guide

```
What do you need?
│
├─ Fresh SDK instance for each test?
│  └─ Use setupTestClient()
│
├─ Manual control over SDK lifecycle?
│  └─ Use createTestClient()
│
├─ Just nock setup without SDK?
│  └─ Use setupTestEnvironment()
│
└─ Testing SDK initialization?
   └─ Use createTestClient() or new SocketSdk()
```

---

## coverage mode behavior

When running with `--coverage`:

1. **Relaxed nock validation** - Pending mocks don't throw errors
2. **Aggressive cleanup** - `nock.abortPendingRequests()` called
3. **Detection** - Use `isCoverageMode` flag to adjust behavior

```typescript
it.skipIf(isCoverageMode)('should test advanced feature', async () => {
  // This test only runs in regular mode
})
```

---

## key benefits

- **Consistent nock lifecycle** - No forgotten cleanup
- **Fast test execution** - Optimized timeouts and retries
- **Type-safe results** - Full TypeScript support
- **Coverage mode handling** - Automatic adjustments
- **Reduced boilerplate** - 5-10 lines saved per test file
- **Rich fixtures** - Pre-built test data
- **Flexible mocking** - Response builders for any scenario

---

## see also

- [Test Style Guide](./test-style-guide.md) - Testing patterns and conventions
- [CI Testing](./ci-testing.md) - Continuous integration setup
- [API Reference](../api-reference.md) - Complete API documentation
- Test files: `test/*.test.mts` - Real-world examples
