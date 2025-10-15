# Socket SDK JS Test Utilities

Comprehensive test utilities for Socket SDK for JavaScript/TypeScript that provide consistent testing patterns and reduce boilerplate.

## Overview

This test utilities library provides:
- **Nock environment setup** - Automated HTTP mock lifecycle management
- **Test client factories** - Pre-configured SDK instances for testing
- **Fast test configuration** - Optimized timeouts for test performance
- **Coverage mode handling** - Special behavior for code coverage runs

## Quick Start

```typescript
import { describe, expect, it } from 'vitest'
import { setupTestClient } from './utils/environment.mts'

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

## Test Utilities

### Environment Setup

**File:** `test/utils/environment.mts`

#### `setupTestEnvironment()`

Standard nock environment setup with beforeEach/afterEach hooks.

**What it does:**
- Restores and activates nock before each test
- Cleans up and validates nock mocks after each test
- Handles coverage mode with aggressive cleanup
- Throws error if pending nock mocks remain (except in coverage mode)

**When to use:**
- Tests that need nock but create their own SDK instances
- Tests that need manual control over SDK creation

**Example:**
```typescript
import { setupTestEnvironment } from './utils/environment.mts'
import nock from 'nock'

describe('My custom tests', () => {
  setupTestEnvironment()

  it('should make HTTP request', async () => {
    nock('https://api.socket.dev')
      .get('/v0/test')
      .reply(200, { success: true })

    // Your test code
  })
})
```

#### `setupTestClient(token?, options?)`

Setup test environment AND create a test client automatically.

**Parameters:**
- `token` - API token (default: `'test-api-token'`)
- `options` - SDK configuration options

**Returns:**
- Function that returns the current test client

**What it does:**
- Calls `setupTestEnvironment()` for nock setup
- Creates fresh SDK instance before each test
- Applies fast test configuration (0 retries, short timeouts)

**When to use:**
- Most SDK tests (recommended default approach)
- When you need a fresh client for each test

**Example:**
```typescript
import { setupTestClient } from './utils/environment.mts'

describe('SocketSdk - Organizations', () => {
  const getClient = setupTestClient('test-api-token', {
    retries: 0,
    timeout: 5000
  })

  it('should fetch organizations', async () => {
    nock('https://api.socket.dev')
      .get('/v0/organizations')
      .reply(200, { organizations: [] })

    const result = await getClient().getOrganizations()

    expect(result.success).toBe(true)
  })
})
```

#### `createTestClient(token?, options?)`

Create a single test client without automatic setup.

**Parameters:**
- `token` - API token (default: `'test-api-token'`)
- `options` - SDK configuration options

**Returns:**
- SocketSdk instance

**When to use:**
- When you need manual control over client lifecycle
- When you want to create multiple clients with different configs
- When testing client initialization itself

**Example:**
```typescript
import { createTestClient } from './utils/environment.mts'

describe('SocketSdk initialization', () => {
  it('should create client with custom config', () => {
    const client = createTestClient('custom-token', {
      baseUrl: 'https://custom.api.socket.dev',
      timeout: 10000,
      userAgent: 'Custom/1.0'
    })

    expect(client).toBeDefined()
  })
})
```

#### `setupNockEnvironment()`

Pure nock setup without client creation.

**What it does:**
- Same as `setupTestEnvironment()`
- Provided for semantic clarity when not using test client

**When to use:**
- Tests that create their own SDK instances
- Tests that need nock but don't need the test client helper

**Example:**
```typescript
import { setupNockEnvironment } from './utils/environment.mts'
import { SocketSdk } from '../src/index'

describe('Custom SDK tests', () => {
  setupNockEnvironment()

  it('should work with custom SDK instance', async () => {
    const client = new SocketSdk('custom-token', {
      baseUrl: 'https://custom.api.socket.dev'
    })

    nock('https://custom.api.socket.dev')
      .get('/v0/test')
      .reply(200, { success: true })

    // Your test code
  })
})
```

### Fast Test Configuration

**File:** `test/utils/fast-test-config.mts`

#### `FAST_TEST_CONFIG`

Optimized SDK configuration for fast test execution.

**Configuration:**
```typescript
{
  retries: 0,         // No retries in tests
  retryDelay: 0,      // No delay between retries
  timeout: 5000       // 5 second timeout
}
```

**Automatically applied by:**
- `createTestClient()`
- `setupTestClient()`

**Manual usage:**
```typescript
import { FAST_TEST_CONFIG } from './utils/fast-test-config.mts'
import { SocketSdk } from '../src/index'

const client = new SocketSdk('test-token', {
  ...FAST_TEST_CONFIG,
  baseUrl: 'https://custom.api.socket.dev'
})
```

### Coverage Mode Detection

**File:** `test/utils/environment.mts`

#### `isCoverageMode`

Boolean flag indicating if tests are running in coverage mode.

**Set by:** `vitest.config.mts` when `--coverage` flag is used

**Used for:**
- Disabling strict nock validation in coverage mode
- Aggressive nock cleanup to prevent test pollution
- Adjusting test behavior for single-threaded execution

**Example:**
```typescript
import { isCoverageMode } from './utils/environment.mts'

describe('My tests', () => {
  it('should adapt to coverage mode', () => {
    if (isCoverageMode) {
      // Skip strict validations in coverage mode
    } else {
      // Strict validations in normal mode
    }
  })
})
```

## Usage Patterns

### Pattern 1: Basic SDK Test

Most common pattern for testing SDK methods.

```typescript
import { describe, expect, it } from 'vitest'
import { setupTestClient } from './utils/environment.mts'
import nock from 'nock'

describe('SocketSdk - Quota', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  it('should fetch quota successfully', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(200, { quota: 1000, used: 500, remaining: 500 })

    const result = await getClient().getQuota()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quota).toBe(1000)
      expect(result.data.used).toBe(500)
      expect(result.data.remaining).toBe(500)
    }
  })

  it('should handle 401 errors', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(401, { error: { message: 'Unauthorized' } })

    const result = await getClient().getQuota()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
    }
  })
})
```

### Pattern 2: Testing with Custom SDK Configuration

When you need to test with specific SDK settings.

```typescript
import { describe, expect, it } from 'vitest'
import { setupTestClient } from './utils/environment.mts'
import nock from 'nock'

describe('SocketSdk - Custom Config', () => {
  const getClient = setupTestClient('test-token', {
    baseUrl: 'https://custom.api.socket.dev',
    timeout: 10000,
    userAgent: 'Test/1.0'
  })

  it('should use custom base URL', async () => {
    nock('https://custom.api.socket.dev')
      .get('/v0/quota')
      .reply(200, { quota: 1000 })

    const result = await getClient().getQuota()

    expect(result.success).toBe(true)
  })
})
```

### Pattern 3: Testing Multiple API Calls

When testing methods that make multiple API requests.

```typescript
import { describe, expect, it } from 'vitest'
import { setupTestClient } from './utils/environment.mts'
import nock from 'nock'

describe('SocketSdk - Batch Operations', () => {
  const getClient = setupTestClient()

  it('should handle multiple nock mocks', async () => {
    nock('https://api.socket.dev')
      .get('/v0/orgs/test-org/repos')
      .reply(200, { repos: [{ name: 'repo1' }, { name: 'repo2' }] })
      .get('/v0/orgs/test-org/repos/repo1')
      .reply(200, { name: 'repo1', visibility: 'public' })
      .get('/v0/orgs/test-org/repos/repo2')
      .reply(200, { name: 'repo2', visibility: 'private' })

    const repoList = await getClient().getOrgRepoList('test-org')
    expect(repoList.success).toBe(true)

    const repo1 = await getClient().getOrgRepo('test-org', 'repo1')
    expect(repo1.success).toBe(true)

    const repo2 = await getClient().getOrgRepo('test-org', 'repo2')
    expect(repo2.success).toBe(true)
  })
})
```

### Pattern 4: Testing Retry Logic

When testing SDK retry behavior.

```typescript
import { describe, expect, it } from 'vitest'
import { SocketSdk } from '../src/index'
import { setupNockEnvironment } from './utils/environment.mts'
import nock from 'nock'

describe('SocketSdk - Retry Logic', () => {
  setupNockEnvironment()

  it('should retry on 500 errors', async () => {
    let attemptCount = 0

    nock('https://api.socket.dev')
      .get('/v0/quota')
      .times(2)
      .reply(() => {
        attemptCount++
        if (attemptCount < 2) {
          return [500, { error: { message: 'Internal Server Error' } }]
        }
        return [200, { quota: 1000 }]
      })

    const client = new SocketSdk('test-token', {
      retries: 3,
      retryDelay: 10
    })

    const result = await client.getQuota()

    expect(result.success).toBe(true)
    expect(attemptCount).toBe(2)
  })
})
```

### Pattern 5: Testing Error Responses

When testing various error scenarios.

```typescript
import { describe, expect, it } from 'vitest'
import { setupTestClient } from './utils/environment.mts'
import nock from 'nock'

describe('SocketSdk - Error Handling', () => {
  const getClient = setupTestClient()

  it('should handle 401 unauthorized', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(401, { error: { message: 'Unauthorized' } })

    const result = await getClient().getQuota()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
    }
  })

  it('should handle 404 not found', async () => {
    nock('https://api.socket.dev')
      .get('/v0/orgs/nonexistent/repos')
      .reply(404, { error: { message: 'Organization not found' } })

    const result = await getClient().getOrgRepoList('nonexistent')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(404)
    }
  })

  it('should handle network errors', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .replyWithError('ECONNREFUSED')

    await expect(getClient().getQuota()).rejects.toThrow()
  })
})
```

## Best Practices

### 1. Always Use Helper Functions

```typescript
// ✅ Good - Use helper
const getClient = setupTestClient()

// ❌ Bad - Manual setup
beforeEach(() => {
  nock.restore()
  nock.cleanAll()
  nock.activate()
})

afterEach(() => {
  nock.cleanAll()
  nock.restore()
})
```

### 2. Use Type-Safe Result Checking

```typescript
// ✅ Good - Type-safe
const result = await client.getQuota()
expect(result.success).toBe(true)
if (result.success) {
  // TypeScript knows result.data exists
  expect(result.data.quota).toBe(1000)
}

// ❌ Bad - Unsafe
const result = await client.getQuota()
expect(result.data.quota).toBe(1000) // TypeScript error!
```

### 3. Clean Nock Mocks

The helpers automatically clean nock mocks, but for complex tests you may want to verify:

```typescript
it('should consume all nock mocks', async () => {
  nock('https://api.socket.dev')
    .get('/v0/quota')
    .reply(200, { quota: 1000 })

  await getClient().getQuota()

  // Nock will automatically verify all mocks were used
  // If any remain, test will fail (unless in coverage mode)
})
```

### 4. Test Both Success and Error Paths

```typescript
describe('SocketSdk - Complete Coverage', () => {
  const getClient = setupTestClient()

  it('should handle success', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(200, { quota: 1000 })

    const result = await getClient().getQuota()
    expect(result.success).toBe(true)
  })

  it('should handle 401 error', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .reply(401, { error: { message: 'Unauthorized' } })

    const result = await getClient().getQuota()
    expect(result.success).toBe(false)
  })

  it('should handle network error', async () => {
    nock('https://api.socket.dev')
      .get('/v0/quota')
      .replyWithError('ECONNREFUSED')

    await expect(getClient().getQuota()).rejects.toThrow()
  })
})
```

### 5. Use Fast Test Config

```typescript
// ✅ Good - Fast tests
const getClient = setupTestClient('test-token', {
  retries: 0,  // No retries in tests
  timeout: 5000
})

// ❌ Bad - Slow tests
const getClient = setupTestClient('test-token', {
  retries: 3,      // Retries slow down tests
  retryDelay: 1000 // Delays make tests even slower
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
│  └─ Use setupTestEnvironment() or setupNockEnvironment()
│
└─ Testing SDK initialization itself?
   └─ Use createTestClient() or new SocketSdk()
```

## Common Patterns Summary

| Pattern | Helper Function | Use Case |
|---------|----------------|----------|
| Standard SDK test | `setupTestClient()` | Testing SDK methods with HTTP mocks |
| Custom SDK config | `setupTestClient(token, options)` | Testing with specific SDK settings |
| Multiple API calls | `setupTestClient()` + multiple nocks | Testing batch operations |
| Retry logic | `setupNockEnvironment()` + custom SDK | Testing retry behavior |
| Error handling | `setupTestClient()` + error nocks | Testing error responses |
| SDK initialization | `createTestClient()` | Testing SDK construction |

## Test File Structure

**Recommended structure:**

```typescript
/** @fileoverview Tests for [feature name]. */
import { describe, expect, it } from 'vitest'
import { setupTestClient } from './utils/environment.mts'
import nock from 'nock'

describe('[Feature Name]', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  describe('[Method Name]', () => {
    it('should [behavior] successfully', async () => {
      // Setup nock mock
      nock('https://api.socket.dev')
        .get('/v0/endpoint')
        .reply(200, { success: true })

      // Call SDK method
      const result = await getClient().method()

      // Assert result
      expect(result.success).toBe(true)
    })

    it('should handle [error type] errors', async () => {
      // Test error path
    })

    it('should handle [edge case]', async () => {
      // Test edge case
    })
  })
})
```

## Coverage Mode Behavior

When running tests with `--coverage`:

1. **Nock validation is relaxed:**
   - Pending mocks don't throw errors
   - Allows for timing issues in single-threaded coverage mode

2. **Aggressive cleanup:**
   - `nock.abortPendingRequests()` called in beforeEach/afterEach
   - Prevents mock state bleeding between tests

3. **Detection:**
   ```typescript
   import { isCoverageMode } from './utils/environment.mts'
   
   if (isCoverageMode) {
     // Adjust test behavior
   }
   ```

## Key Benefits

1. **Consistent nock lifecycle** - No more forgotten cleanup
2. **Fast test execution** - Optimized timeouts and retries
3. **Type-safe results** - Full TypeScript support
4. **Coverage mode handling** - Automatic adjustments for coverage runs
5. **Reduced boilerplate** - 5-10 lines saved per test file

## See Also

- **Test Files:** `test/*.test.mts` - Real-world usage examples
- **SDK Source:** `src/socket-sdk-class.ts` - SDK implementation
- **Vitest Config:** `.config/vitest.config.mts` - Test configuration
- **Fast Test Config:** `test/utils/fast-test-config.mts` - Optimized settings

## Contributing

When adding new test utilities:

1. **Add to `environment.mts`** for test environment utilities
2. **Include JSDoc comments** with examples
3. **Follow existing patterns** for consistency
4. **Test the utilities** in actual test files
5. **Update this README** with new patterns
