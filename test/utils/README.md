# Test Utilities

Test environment helpers for Socket SDK with automated HTTP mock management and optimized test configuration.

## Quick Start

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

## Core Utilities

### `setupTestClient(token?, options?)` - RECOMMENDED

Combines nock setup and client creation with automatic cleanup.

```typescript
const getClient = setupTestClient('test-token', { retries: 0 })
// Fresh client for each test with nock auto cleanup
```

**When to use:** 90% of SDK tests

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

## Fast Test Configuration

`FAST_TEST_CONFIG` is automatically applied by test helpers:

```typescript
{
  retries: 0,         // No retries
  retryDelay: 0,      // No delay
  timeout: 5000       // 5 second timeout
}
```

## Usage Patterns

### Basic SDK Test

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

### Custom SDK Configuration

```typescript
const getClient = setupTestClient('test-token', {
  baseUrl: 'https://custom.api.socket.dev',
  timeout: 10000,
  userAgent: 'Test/1.0'
})
```

### Multiple API Calls

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

### Error Handling

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

## Best Practices

1. **Always use helper functions**
```typescript
// ✅ Good
const getClient = setupTestClient()

// ❌ Bad
beforeEach(() => { nock.restore(); nock.activate() })
```

2. **Type-safe result checking**
```typescript
// ✅ Good
if (result.success) {
  expect(result.data.quota).toBe(1000)  // TypeScript knows data exists
}

// ❌ Bad
expect(result.data.quota).toBe(1000)  // TypeScript error
```

3. **Test both success and error paths**
```typescript
describe('Complete Coverage', () => {
  it('should handle success', async () => { /* ... */ })
  it('should handle 401 error', async () => { /* ... */ })
  it('should handle network error', async () => { /* ... */ })
})
```

4. **Use fast test config**
```typescript
// ✅ Good
const getClient = setupTestClient('test-token', { retries: 0 })

// ❌ Bad (slow)
const getClient = setupTestClient('test-token', {
  retries: 3,
  retryDelay: 1000
})
```

## Helper Selection Guide

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

## Coverage Mode Behavior

When running with `--coverage`:

1. **Relaxed nock validation** - Pending mocks don't throw errors
2. **Aggressive cleanup** - `nock.abortPendingRequests()` called
3. **Detection** - Use `isCoverageMode` flag to adjust behavior

## Key Benefits

- Consistent nock lifecycle (no forgotten cleanup)
- Fast test execution (optimized timeouts and retries)
- Type-safe results (full TypeScript support)
- Coverage mode handling (automatic adjustments)
- Reduced boilerplate (5-10 lines saved per test file)

## See Also

- [Test Style Guide](../../docs/test-style-guide.md) - Testing patterns
- [Testing Utilities](../../docs/dev/testing.md) - Fixture and mock helpers
- Test files: `test/*.test.mts` - Real-world examples
