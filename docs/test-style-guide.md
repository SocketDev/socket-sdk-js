# Test Style Guide

Testing patterns and best practices for Socket SDK JS.

## Quick Reference

**Commands:**
- All tests: `pnpm test`
- Specific file: `pnpm run test:run path/to/file.test.mts`
- Coverage: `pnpm run cover`

**File Organization:**
- Tests: `test/*.test.mts`
- Utilities: `test/utils/`
- Descriptive file names matching features

**Test Structure:**
```typescript
describe('Feature Name', () => {
  const getClient = setupTestClient('test-token', { retries: 0 })

  it('should do something specific', async () => {
    // Arrange: Setup nock mock
    nock('https://api.socket.dev').get('/v0/endpoint').reply(200, { ok: true })

    // Act: Call method
    const result = await getClient().method()

    // Assert: Check result
    expect(result.success).toBe(true)
  })
})
```

## Test Helpers

`test/utils/environment.mts` provides:

**`setupTestClient(token?, options?)`** - RECOMMENDED for most tests
```typescript
const getClient = setupTestClient('test-token', { retries: 0 })
// Combines nock setup + client creation with auto cleanup
```

**`setupTestEnvironment()`** - Just nock setup
```typescript
setupTestEnvironment()  // Use when creating custom SDK instances
```

**`createTestClient(token?, options?)`** - Just client creation
```typescript
const client = createTestClient('test-token', { retries: 0 })
```

**`isCoverageMode`** - Coverage detection flag
```typescript
if (isCoverageMode) { /* adjust test behavior */ }
```

## Best Practices

**Naming:**
- Files: `feature-name.test.mts` (descriptive)
- Describes: `'SocketSdk - Feature Name'`
- Tests: `'should do something specific'` (not "works" or "test1")

**Assertions:**
- Prefer specific: `toBe(42)`, `toHaveLength(3)`, `toContain('value')`
- Avoid vague: `toBeTruthy()`, `toBeDefined()`
- Test both success and error paths

**Nock Mocking:**
```typescript
nock('https://api.socket.dev')
  .get('/v0/endpoint')
  .reply(200, { data: 'value' })

// Auto cleanup via setupTestClient()
```

**Type-Safe Results:**
```typescript
const result = await client.getQuota()
if (result.success) {
  expect(result.data.quota).toBe(1000)  // TypeScript knows data exists
}
```

## Example Test

```typescript
import { describe, expect, it } from 'vitest'
import { setupTestClient } from './utils/environment.mts'
import nock from 'nock'

describe('SocketSdk - Get Organization', () => {
  const getClient = setupTestClient('test-token', { retries: 0 })

  it('should fetch organization successfully', async () => {
    nock('https://api.socket.dev')
      .get('/v0/orgs/test-org')
      .reply(200, { id: '123', name: 'Test Org' })

    const result = await getClient().getOrganization('test-org')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('123')
    }
  })

  it('should handle 404 errors', async () => {
    nock('https://api.socket.dev')
      .get('/v0/orgs/missing')
      .reply(404, 'Not found')

    const result = await getClient().getOrganization('missing')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(404)
    }
  })
})
```

## See Also

- [Testing Utilities](./dev/testing.md) - Complete test utilities reference
- [Test Utils README](../test/utils/README.md) - Detailed helper documentation
