# Test Coverage Improvement Plan

**Goal:** Increase coverage from 94.08% to 96%+ to meet thresholds
**Timeline:** 1-2 days
**Effort:** ~7 hours of focused work

---

## Current Status

```
Coverage Thresholds:          Current    Target    Gap
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lines:                        94.08%     96%      -1.92%  ❌
Statements:                   94.08%     96%      -1.92%  ❌
Functions:                    96.74%     100%     -3.26%  ❌
Branches:                     93.99%     93%      +0.99%  ✅
```

**Files failing thresholds:**
- `socket-sdk-class.ts` - 92.09% (112 uncovered lines)
- `http-client.ts` - 90.58% (16 uncovered lines)
- `quota-utils.ts` - 96.74% (4 uncovered lines) *close but below 96%*

---

## Phase 1: Quick Wins (2-3 hours, +3% coverage)

### Task 1.1: Add sendApi Method Tests
**File:** `test/getapi-sendapi-methods.test.mts`
**Lines covered:** ~30
**Time:** 30 minutes

```typescript
describe('sendApi method', () => {
  it('should send POST request by default', async () => {
    nock(baseUrl)
      .post('/orgs/test/endpoint')
      .reply(200, { success: true, data: 'test' })

    const result = await sdk.sendApi('orgs/test/endpoint', {
      body: { key: 'value' }
    })

    expect(result).toEqual({ success: true, data: 'test' })
  })

  it('should send PUT request when specified', async () => {
    nock(baseUrl)
      .put('/orgs/test/endpoint')
      .reply(200, { updated: true })

    const result = await sdk.sendApi('orgs/test/endpoint', {
      method: 'PUT',
      body: { key: 'value' }
    })

    expect(result).toEqual({ updated: true })
  })

  it('should return result object when throws=false', async () => {
    nock(baseUrl)
      .post('/orgs/test/endpoint')
      .reply(200, { data: 'test' })

    const result = await sdk.sendApi('orgs/test/endpoint', {
      body: { key: 'value' },
      throws: false
    })

    expect(result).toMatchObject({
      success: true,
      data: { data: 'test' },
      error: undefined,
      cause: undefined
    })
  })

  it('should return error result when throws=false and request fails', async () => {
    nock(baseUrl)
      .post('/orgs/test/endpoint')
      .reply(400, { error: { message: 'Bad request' } })

    const result = await sdk.sendApi('orgs/test/endpoint', {
      body: { key: 'value' },
      throws: false
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should throw error when throws=true and request fails', async () => {
    nock(baseUrl)
      .post('/orgs/test/endpoint')
      .reply(500, 'Internal server error')

    await expect(
      sdk.sendApi('orgs/test/endpoint', {
        body: { key: 'value' },
        throws: true
      })
    ).rejects.toThrow()
  })
})
```

### Task 1.2: Add Error Status Code Tests
**File:** `test/socket-sdk-error-responses.test.mts` (NEW)
**Lines covered:** ~25
**Time:** 45 minutes

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import nock from 'nock'

import { SocketSdk } from '../src/socket-sdk-class'

describe('SocketSdk - HTTP Error Status Codes', () => {
  let sdk: SocketSdk
  const baseUrl = 'https://api.socket.dev/v0/'
  const apiToken = 'test-token'

  beforeEach(() => {
    sdk = new SocketSdk(apiToken, { baseUrl })
    nock.cleanAll()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('Authentication errors (401)', () => {
    it('should throw 401 error without retrying', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .reply(401, 'Unauthorized')

      await expect(
        sdk.getApi('orgs/test/repos')
      ).rejects.toThrow('401')
    })

    it('should not retry on 401 errors', async () => {
      let attemptCount = 0
      nock(baseUrl)
        .get('/orgs/test/repos')
        .times(3)
        .reply(() => {
          attemptCount++
          return [401, 'Unauthorized']
        })

      await expect(
        sdk.getApi('orgs/test/repos')
      ).rejects.toThrow()

      // Should only attempt once, not retry
      expect(attemptCount).toBe(1)
    })
  })

  describe('Authorization errors (403)', () => {
    it('should throw 403 error without retrying', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .reply(403, 'Forbidden')

      await expect(
        sdk.getApi('orgs/test/repos')
      ).rejects.toThrow('403')
    })

    it('should not retry on 403 errors', async () => {
      let attemptCount = 0
      nock(baseUrl)
        .get('/orgs/test/repos')
        .times(3)
        .reply(() => {
          attemptCount++
          return [403, 'Forbidden']
        })

      await expect(
        sdk.getApi('orgs/test/repos')
      ).rejects.toThrow()

      expect(attemptCount).toBe(1)
    })
  })

  describe('Server errors (5xx)', () => {
    it('should throw on 500 errors', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .reply(500, 'Internal server error')

      await expect(
        sdk.getApi('orgs/test/repos')
      ).rejects.toThrow('server error')
    })

    it('should throw on 502 errors', async () => {
      nock(baseUrl)
        .post('/orgs/test/endpoint')
        .reply(502, 'Bad gateway')

      await expect(
        sdk.sendApi('orgs/test/endpoint', { body: {} })
      ).rejects.toThrow()
    })

    it('should throw on 503 errors', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .reply(503, 'Service unavailable')

      await expect(
        sdk.getApi('orgs/test/repos')
      ).rejects.toThrow('server error')
    })
  })

  describe('Structured error responses', () => {
    it('should parse error message from JSON response', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .reply(400, {
          error: {
            message: 'Invalid organization slug'
          }
        })

      await expect(
        sdk.getApi('orgs/test/repos')
      ).rejects.toThrow('Invalid organization slug')
    })

    it('should include error details when present', async () => {
      nock(baseUrl)
        .post('/orgs/test/endpoint')
        .reply(400, {
          error: {
            message: 'Validation failed',
            details: { field: 'email', reason: 'invalid format' }
          }
        })

      await expect(
        sdk.sendApi('orgs/test/endpoint', { body: {} })
      ).rejects.toThrow('Validation failed')
    })

    it('should stringify object details', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .reply(422, {
          error: {
            message: 'Processing failed',
            details: {
              errors: ['field1', 'field2'],
              warnings: ['deprecated_api']
            }
          }
        })

      await expect(
        sdk.getApi('orgs/test/repos')
      ).rejects.toThrow('Processing failed')
    })
  })
})
```

### Task 1.3: Add getApi throws=false Tests
**File:** `test/socket-sdk-result-type.test.mts` (NEW)
**Lines covered:** ~20
**Time:** 30 minutes

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import nock from 'nock'

import { SocketSdk } from '../src/socket-sdk-class'

describe('SocketSdk - Result Type Options (throws=false)', () => {
  let sdk: SocketSdk
  const baseUrl = 'https://api.socket.dev/v0/'
  const apiToken = 'test-token'

  beforeEach(() => {
    sdk = new SocketSdk(apiToken, { baseUrl })
    nock.cleanAll()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('getApi with throws=false', () => {
    it('should return success result on successful request', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .reply(200, { repos: ['repo1', 'repo2'] })

      const result = await sdk.getApi('orgs/test/repos', {
        throws: false
      })

      expect(result).toMatchObject({
        success: true,
        data: { repos: ['repo1', 'repo2'] },
        error: undefined,
        cause: undefined,
        status: 200
      })
    })

    it('should return error result on 404', async () => {
      nock(baseUrl)
        .get('/orgs/nonexistent/repos')
        .reply(404, 'Not found')

      const result = await sdk.getApi('orgs/nonexistent/repos', {
        throws: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.data).toBeUndefined()
      expect(result.status).toBe(404)
    })

    it('should return error result on 400', async () => {
      nock(baseUrl)
        .get('/orgs/invalid/repos')
        .reply(400, { error: { message: 'Invalid request' } })

      const result = await sdk.getApi('orgs/invalid/repos', {
        throws: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid request')
    })

    it('should return error result on network failure', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .replyWithError('Network error')

      const result = await sdk.getApi('orgs/test/repos', {
        throws: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('getApi with throws=true (default)', () => {
    it('should throw on error', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .reply(404, 'Not found')

      await expect(
        sdk.getApi('orgs/test/repos')
      ).rejects.toThrow()
    })

    it('should return data directly on success', async () => {
      nock(baseUrl)
        .get('/orgs/test/repos')
        .reply(200, { repos: ['repo1'] })

      const result = await sdk.getApi('orgs/test/repos')

      expect(result).toEqual({ repos: ['repo1'] })
    })
  })
})
```

### Task 1.4: Add HTTP Client Edge Cases
**File:** `test/http-client-edge-cases.test.mts` (NEW)
**Lines covered:** ~10
**Time:** 30 minutes

```typescript
import { describe, expect, it } from 'vitest'

import { ResponseError, getResponseJson } from '../src/http-client'

import type { IncomingMessage } from 'node:http'

describe('HTTP Client - Edge Cases', () => {
  describe('ResponseError constructor', () => {
    it('should handle empty message parameter', () => {
      const mockResponse = {
        statusCode: 500,
        statusMessage: 'Internal Server Error'
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('Request failed')
      expect(error.message).toContain('500')
      expect(error.message).toContain('Internal Server Error')
      expect(error.name).toBe('ResponseError')
    })

    it('should handle custom message', () => {
      const mockResponse = {
        statusCode: 404,
        statusMessage: 'Not Found'
      } as IncomingMessage

      const error = new ResponseError(mockResponse, 'Custom message')

      expect(error.message).toContain('Custom message')
      expect(error.message).toContain('404')
    })

    it('should handle missing statusCode', () => {
      const mockResponse = {
        statusMessage: 'Error'
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('unknown')
    })

    it('should handle missing statusMessage', () => {
      const mockResponse = {
        statusCode: 500
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.message).toContain('No status message')
    })

    it('should have response property', () => {
      const mockResponse = {
        statusCode: 500,
        statusMessage: 'Error'
      } as IncomingMessage

      const error = new ResponseError(mockResponse)

      expect(error.response).toBe(mockResponse)
    })
  })
})
```

**Phase 1 Summary:**
- 4 tasks
- ~2.5 hours
- ~115 lines covered
- Coverage increase: +3%

---

## Phase 2: Streaming Tests (2 hours, +1.5% coverage)

### Task 2.1: Add Streaming Operations Tests
**File:** `test/socket-sdk-streaming.test.mts` (NEW)
**Lines covered:** ~35
**Time:** 2 hours

```typescript
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { SocketSdk } from '../src/socket-sdk-class'
import { ResponseError } from '../src/http-client'

import type { Server } from 'node:http'

describe('SocketSdk - Streaming Operations', () => {
  let sdk: SocketSdk
  let server: Server
  let baseUrl: string
  const apiToken = 'test-token'

  beforeAll(async () => {
    // Create test server for streaming
    server = createServer((req, res) => {
      const url = req.url || ''

      if (url.includes('/full-scans/') && url.includes('/patches')) {
        // Stream NDJSON patches
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        res.write('{"pkg":"test","version":"1.0.0","patches":[]}\n')
        res.write('{"pkg":"other","version":"2.0.0","patches":[]}\n')
        res.end()
      } else if (url.includes('/full-scans/') && !url.includes('/patches')) {
        // Stream full scan JSON
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.write('{"scan":"data","results":[]}')
        res.end()
      } else if (url.includes('/error')) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
      } else {
        res.writeHead(200)
        res.end()
      }
    })

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          baseUrl = `http://localhost:${address.port}/`
          resolve()
        }
      })
    })
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    sdk = new SocketSdk(apiToken, { baseUrl })
  })

  afterEach(() => {
    // Clean up any test files
  })

  describe('streamOrgFullScan', () => {
    it('should stream full scan to file', async () => {
      const tmpFile = path.join(os.tmpdir(), `socket-test-${Date.now()}.json`)

      try {
        await sdk.streamOrgFullScan('test-org', 'scan-123', {
          output: tmpFile
        })

        expect(existsSync(tmpFile)).toBe(true)
        const content = readFileSync(tmpFile, 'utf8')
        expect(content).toContain('scan')
        expect(content).toContain('data')
      } finally {
        if (existsSync(tmpFile)) {
          unlinkSync(tmpFile)
        }
      }
    })

    it('should throw error on 404 response', async () => {
      await expect(
        sdk.streamOrgFullScan('test-org', 'error', {
          output: 'test.json'
        })
      ).rejects.toThrow(ResponseError)
    })

    // Note: stdout streaming test would require mocking process.stdout
    // Skip in normal test runs to avoid polluting console
    it.skip('should stream to stdout when output=true', async () => {
      // Mock stdout or run in isolated environment
    })
  })

  describe('streamPatchesFromScan', () => {
    it('should stream patches as NDJSON', async () => {
      const stream = await sdk.streamPatchesFromScan('test-org', 'scan-123')
      const reader = stream.getReader()

      const patches = []
      let done = false

      while (!done) {
        const { value, done: streamDone } = await reader.read()
        if (value) {
          patches.push(value)
        }
        done = streamDone
      }

      expect(patches).toHaveLength(2)
      expect(patches[0]).toMatchObject({
        pkg: 'test',
        version: '1.0.0'
      })
      expect(patches[1]).toMatchObject({
        pkg: 'other',
        version: '2.0.0'
      })
    })

    it('should throw error on non-OK response', async () => {
      await expect(
        sdk.streamPatchesFromScan('test-org', 'error')
      ).rejects.toThrow(ResponseError)
    })

    it('should handle malformed NDJSON lines', async () => {
      // Create server that returns invalid JSON line
      const invalidServer = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        res.write('{"valid":"json"}\n')
        res.write('invalid json line\n')
        res.write('{"also":"valid"}\n')
        res.end()
      })

      const port = await new Promise<number>(resolve => {
        invalidServer.listen(0, () => {
          const addr = invalidServer.address()
          resolve(typeof addr === 'object' && addr ? addr.port : 0)
        })
      })

      const testSdk = new SocketSdk(apiToken, {
        baseUrl: `http://localhost:${port}/`
      })

      const stream = await testSdk.streamPatchesFromScan('test-org', 'scan-123')
      const reader = stream.getReader()

      const patches = []
      let done = false

      while (!done) {
        const { value, done: streamDone } = await reader.read()
        if (value) {
          patches.push(value)
        }
        done = streamDone
      }

      // Should only get valid lines
      expect(patches).toHaveLength(2)

      invalidServer.close()
    })
  })
})
```

**Phase 2 Summary:**
- 1 task (complex)
- ~2 hours
- ~35 lines covered
- Coverage increase: +1.5%

---

## Phase 3: Remaining Edge Cases (1.5 hours, +1% coverage)

### Task 3.1: Add Entitlement Validation Tests
**File:** `test/entitlements.test.mts` (extend existing)
**Lines covered:** ~8
**Time:** 30 minutes

```typescript
// Add to existing entitlements.test.mts

describe('Entitlement edge cases', () => {
  it('should return undefined when entitlements is undefined', async () => {
    nock(baseUrl)
      .get('/orgs/test/entitlements')
      .reply(200, {})

    const result = await sdk.getOrgEntitlements('test')
    expect(result).toBeUndefined()
  })

  it('should return undefined when entitlements is empty array', async () => {
    nock(baseUrl)
      .get('/orgs/test/entitlements')
      .reply(200, { entitlements: [] })

    const result = await sdk.getOrgEntitlements('test')
    expect(result).toBeUndefined()
  })

  it('should filter out invalid entitlements', async () => {
    nock(baseUrl)
      .get('/orgs/test/entitlements')
      .reply(200, {
        entitlements: [
          { slug: 'valid', name: 'Valid' },
          'invalid-string',
          { name: 'missing-slug' },
          null,
          { slug: 'another-valid', name: 'Also Valid' }
        ]
      })

    const result = await sdk.getOrgEntitlements('test')
    expect(result).toHaveLength(2)
    expect(result![0].slug).toBe('valid')
    expect(result![1].slug).toBe('another-valid')
  })

  it('should return undefined when all entitlements are invalid', async () => {
    nock(baseUrl)
      .get('/orgs/test/entitlements')
      .reply(200, {
        entitlements: [
          'invalid',
          { name: 'no-slug' },
          null
        ]
      })

    const result = await sdk.getOrgEntitlements('test')
    expect(result).toBeUndefined()
  })
})
```

### Task 3.2: Add Quota Utils Error Tests
**File:** `test/quota-utils-error-handling.test.mts` (extend existing)
**Lines covered:** ~4
**Time:** 30 minutes

```typescript
import { describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

// Add to existing quota-utils-error-handling.test.mts

describe('Quota Utils - File System Errors', () => {
  it('should throw when requirements file does not exist', async () => {
    // Mock existsSync to return false
    vi.mock('node:fs', async () => {
      const actual = await vi.importActual('node:fs')
      return {
        ...actual,
        existsSync: vi.fn(() => false)
      }
    })

    // Re-import after mocking
    const { loadRequirements } = await import('../src/quota-utils')

    expect(() => {
      loadRequirements()
    }).toThrow('Requirements file not found')

    vi.unmock('node:fs')
  })

  it('should throw when requirements file contains invalid JSON', async () => {
    // Mock readFileSync to return invalid JSON
    vi.mock('node:fs', async () => {
      const actual = await vi.importActual('node:fs')
      return {
        ...actual,
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => 'invalid json {')
      }
    })

    const { loadRequirements } = await import('../src/quota-utils')

    expect(() => {
      loadRequirements()
    }).toThrow('Failed to load SDK method requirements')

    vi.unmock('node:fs')
  })
})
```

### Task 3.3: Add Empty Response Tests
**File:** `test/http-client-edge-cases.test.mts` (extend)
**Lines covered:** ~5
**Time:** 20 minutes

```typescript
// Add to existing http-client-edge-cases.test.mts

describe('getResponseJson with empty responses', () => {
  it('should handle empty string response', async () => {
    const mockResponse = {
      statusCode: 200,
      statusMessage: 'OK',
      on: vi.fn((event, handler) => {
        if (event === 'data') {
          // No data emitted
        }
        if (event === 'end') {
          handler()
        }
      })
    } as any

    const result = await getResponseJson(mockResponse)
    expect(result).toEqual({})
  })
})
```

**Phase 3 Summary:**
- 3 tasks
- ~1.5 hours
- ~17 lines covered
- Coverage increase: +1%

---

## Implementation Checklist

### Phase 1: Quick Wins (2-3 hours)
- [ ] Task 1.1: Add sendApi tests to `getapi-sendapi-methods.test.mts`
- [ ] Task 1.2: Create `socket-sdk-error-responses.test.mts`
- [ ] Task 1.3: Create `socket-sdk-result-type.test.mts`
- [ ] Task 1.4: Create `http-client-edge-cases.test.mts`
- [ ] Run coverage: `pnpm run cover --code-only`
- [ ] Verify: Lines coverage should be ~97%

### Phase 2: Streaming (2 hours)
- [ ] Task 2.1: Create `socket-sdk-streaming.test.mts`
- [ ] Run coverage: `pnpm run cover --code-only`
- [ ] Verify: Lines coverage should be ~98%

### Phase 3: Edge Cases (1.5 hours)
- [ ] Task 3.1: Extend `entitlements.test.mts`
- [ ] Task 3.2: Extend `quota-utils-error-handling.test.mts`
- [ ] Task 3.3: Extend `http-client-edge-cases.test.mts`
- [ ] Run coverage: `pnpm run cover --code-only`
- [ ] Verify: Lines coverage should be ~96%+

### Final Verification
- [ ] Run full test suite: `pnpm test`
- [ ] Run coverage: `pnpm run cover`
- [ ] Check all thresholds pass
- [ ] Update test documentation if needed
- [ ] Commit changes

---

## Expected Results

### Before Implementation:
```
Lines:       94.08%  ❌ (target: 96%)
Statements:  94.08%  ❌ (target: 96%)
Functions:   96.74%  ❌ (target: 100%)
Branches:    93.99%  ✅ (target: 93%)
```

### After Implementation:
```
Lines:       97%+    ✅ (target: 96%)
Statements:  97%+    ✅ (target: 96%)
Functions:   100%    ✅ (target: 100%)
Branches:    95%+    ✅ (target: 93%)
```

---

## Testing Commands

```bash
# Run tests for specific file
pnpm test test/socket-sdk-error-responses.test.mts

# Run coverage for all tests
pnpm run cover --code-only

# Run coverage and get percentage
pnpm run cover --percent

# Run tests with watch mode during development
pnpm test --watch

# Run tests with coverage in watch mode
pnpm test --coverage --watch
```

---

## Tips for Implementation

1. **Start with Phase 1** - These are the quickest wins and cover the most lines
2. **Test as you go** - Run tests after each task to verify they pass
3. **Use nock for HTTP mocking** - Already used extensively in the codebase
4. **Follow existing patterns** - Look at similar tests for structure
5. **Focus on error paths** - Most gaps are in error handling
6. **Keep tests simple** - Focus on coverage, not complex scenarios
7. **Use beforeEach/afterEach** - Clean up mocks and state properly
8. **Check coverage after each phase** - Verify progress incrementally

---

## Maintenance Plan

Once coverage targets are met:

1. **CI Integration** - Coverage already runs in CI, ensure it fails on threshold violations
2. **New Feature Testing** - Add tests for new features before merging
3. **Regular Review** - Check coverage reports monthly
4. **Update Thresholds** - Consider increasing thresholds gradually (e.g., 97% → 98%)
5. **Document Untestable Code** - Use c8 ignore with clear comments for truly defensive code

---

## Notes

- **Realistic timeline:** Can be completed in 1-2 focused days
- **Incremental progress:** Each phase can be completed independently
- **Low risk:** All tests are additive, no existing tests need modification
- **High value:** Closes coverage gaps and improves error handling confidence
- **Maintainable:** Tests follow existing patterns and conventions
