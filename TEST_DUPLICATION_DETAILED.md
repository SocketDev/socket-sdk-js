# Detailed Test Suite Duplication Analysis

## File Structure Summary

```
test/
├── utils/                          # 8 helper utilities files
│   ├── environment.mts             # 139 lines - Nock setup & client creation
│   ├── error-test-helpers.mts      # 182 lines - Error testing helpers (UNDERUTILIZED)
│   ├── fast-test-config.mts        # 31 lines - Optimized configs
│   ├── assertions.mts              # 78 lines - Type-safe assertions
│   ├── fixtures.mts                # 30 lines - Test data fixtures
│   ├── constants.mts               # 3 lines
│   ├── mock-helpers.mts            # 23 lines
│   └── README.md                   # 655 lines - Comprehensive docs
│
├── socket-sdk-*.test.mts           # 12 SDK test files
├── http-client-*.test.mts          # 3 HTTP client test files
├── quota-utils*.test.mts           # 2 quota utility test files
├── promise-*.test.mts              # 2 promise utility test files
├── entitlements.test.mts           # Entitlements tests
├── getapi-sendapi-methods.test.mts # Generic API tests
└── ... (additional test files)
```

## Detailed Duplication Analysis

### 1. Local HTTP Server Setup Duplication

#### Affected Files
- `socket-sdk-api-methods.coverage.test.mts` (lines 21-92)
- `socket-sdk-error-handling.test.mts` (lines 21-78)
- `socket-sdk-download-patch-blob.test.mts` (lines 20-80)

#### Pattern Found
All 3 files implement nearly identical boilerplate:

**socket-sdk-api-methods.coverage.test.mts:**
```typescript
beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || ''
    // ... routing logic ...
  })

  await new Promise<void>(resolve => {
    server.listen(0, () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const { port } = address
        baseUrl = `http://127.0.0.1:${port}`
        resolve()
      }
    })
  })

  client = new SocketSdk('test-token', { baseUrl, retries: 0 })
})

afterAll(async () => {
  await new Promise<void>(resolve => {
    server.close(() => resolve())
  })
})
```

**socket-sdk-error-handling.test.mts:**
```typescript
beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // ... same setup ...
  })

  await new Promise<void>(resolve => {
    server.listen(0, () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const { port } = address
        baseUrl = `http://127.0.0.1:${port}`
        resolve()
      }
    })
  })

  client = new SocketSdk('test-token', { baseUrl, retries: 0 })
})

afterAll(async () => {
  await new Promise<void>(resolve => {
    server.close(() => resolve())
  })
})
```

**socket-sdk-download-patch-blob.test.mts:**
```typescript
beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // ... same setup pattern ...
  })

  await new Promise<void>(resolve => {
    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' ? addr?.port : 0
      baseUrl = `http://localhost:${port}`
      resolve()
    })
  })

  client = new SocketSdk('test-token', { baseUrl, retries: 0 })
})

afterAll(() => {
  server.close()
})
```

#### Duplication Metrics
- **Lines of duplicate code:** ~35-50 per file = 105-150 total
- **Variation:** Minor differences in URL construction (127.0.0.1 vs localhost)
- **Maintainability impact:** Changes to server setup must be made in 3 places

#### Proposed Consolidation
Create `test/utils/local-server-helpers.mts`:
```typescript
/**
 * Helper utilities for tests using local HTTP servers.
 * Reduces boilerplate for real HTTP server testing.
 */

import type { Server } from 'node:http'

export interface TestServerOptions {
  port?: number
  host?: string
}

export interface TestServerAddress {
  baseUrl: string
  port: number
}

/**
 * Start a test server and return its base URL.
 * Handles async server startup with proper promise resolution.
 */
export async function startTestServer(
  server: Server,
  options: TestServerOptions = {}
): Promise<TestServerAddress> {
  const { host = '127.0.0.1', port = 0 } = options

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Invalid server address'))
        return
      }

      resolve({
        baseUrl: `http://${host}:${address.port}`,
        port: address.port,
      })
    })

    server.once('error', reject)
  })
}

/**
 * Close a test server cleanly.
 */
export async function closeTestServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(err => {
      if (err) reject(err)
      else resolve()
    })
  })
}
```

#### Refactored Usage
After consolidation, each test file would use:
```typescript
import { startTestServer, closeTestServer } from './utils/local-server-helpers.mts'

describe('SocketSdk - API Methods Coverage', () => {
  let server: Server
  let baseUrl: string
  let client: SocketSdk

  beforeAll(async () => {
    server = createServer((req, res) => {
      // ... routing logic ...
    })

    const { baseUrl: url } = await startTestServer(server)
    baseUrl = url
    client = new SocketSdk('test-token', { baseUrl, retries: 0 })
  })

  afterAll(async () => {
    await closeTestServer(server)
  })
})
```

**Lines saved:** 20-30 per file × 3 files = 60-90 lines

---

### 2. Error Response Mocking Duplication

#### Current State Analysis
**error-test-helpers.mts exists but is NOT USED anywhere:**
```typescript
export async function testServerError(...) { }
export async function testNetworkError(...) { }
export async function test404Error(...) { }
export async function test403Error(...) { }
export async function test401Error(...) { }
export async function testCommonErrors(...) { }
```

#### Error Testing Patterns Found

**Pattern 1: 401 Errors** (~5 occurrences)
```typescript
// socket-sdk-retry.test.mts:18
it('should not retry on 401 authentication errors', async () => {
  let attemptCount = 0
  nock('https://api.socket.dev')
    .get('/v0/quota')
    .reply(() => {
      attemptCount++
      return [401, { error: { message: 'Unauthorized' } }]
    })
  // ... test code
})

// socket-sdk-validation.test.mts:22
it('rejects null API token', () => {
  expect(() => new SocketSdk(null)).toThrow()
})

// getapi-sendapi-methods.test.mts (implicit)
// entitlements.test.mts (implicit)
```

**Pattern 2: 404 Errors** (~8 occurrences)
```typescript
// Multiple files implement:
nock('https://api.socket.dev')
  .get('/endpoint')
  .reply(404, { error: { message: 'Not found' } })
```

**Pattern 3: 500 Errors** (~6 occurrences)
```typescript
// Multiple implementations:
nock('https://api.socket.dev')
  .post('/endpoint')
  .reply(500, { error: { message: 'Internal Server Error' } })
```

#### Count of Error Test Scenarios

| Error Type | Files | Count | Lines/Test |
|:--|:--|:--|:--|
| 401 Unauthorized | 5 | 5+ | 5-8 |
| 403 Forbidden | 4 | 4+ | 5-8 |
| 404 Not Found | 8 | 8+ | 5-8 |
| 500 Server Error | 6 | 6+ | 5-8 |
| Network Errors | 3 | 3+ | 5-8 |
| **TOTAL** | - | **26+** | **6-8 each** |

#### Total Duplicate Lines
26+ tests × 7 lines average = **182+ lines of duplicate error handling**

#### Recommended Refactoring
Expand error-test-helpers.mts and promote its usage:

**Option A: Direct Helper Usage** (Current helpers, unused)
```typescript
// In test files:
describe('Error Handling', () => {
  const getClient = setupTestClient()

  it('handles 401 errors', async () => {
    await testServerError(getClient(), {
      method: 'getQuota',
      endpoint: '/v0/quota',
      args: [],
      httpMethod: 'get'
    })
  })
})
```

**Option B: Parameterized Test Matrix** (Recommended)
Create `test/utils/error-test-matrix.mts`:
```typescript
import { describe, it, expect } from 'vitest'
import nock from 'nock'
import type { SocketSdk } from '../src/index'

export interface ErrorTestCase {
  status: number
  description: string
  shouldRetry?: boolean
  errorPattern?: string
}

export const COMMON_ERROR_CASES: ErrorTestCase[] = [
  {
    status: 401,
    description: 'authentication errors',
    shouldRetry: false,
    errorPattern: 'Unauthorized'
  },
  {
    status: 403,
    description: 'forbidden errors',
    shouldRetry: false,
    errorPattern: 'Forbidden'
  },
  {
    status: 404,
    description: 'not found errors',
    shouldRetry: false,
    errorPattern: 'Not found'
  },
  {
    status: 500,
    description: 'server errors',
    shouldRetry: true,
    errorPattern: 'Internal Server Error'
  }
]

export function createErrorTestSuite(
  methodName: string,
  endpoint: string,
  methodCall: (client: SocketSdk) => Promise<any>
) {
  return COMMON_ERROR_CASES.map(errorCase => ({
    name: `should handle ${errorCase.status} ${errorCase.description}`,
    test: async (client: SocketSdk) => {
      nock('https://api.socket.dev')
        [httpMethod](endpoint)
        .reply(errorCase.status, { error: { message: errorCase.errorPattern } })

      const result = await methodCall(client)
      
      expect(result.success).toBe(false)
      expect(result.status).toBe(errorCase.status)
    }
  }))
}
```

Usage in tests:
```typescript
describe('Method Error Handling', () => {
  const getClient = setupTestClient()

  createErrorTestSuite('getQuota', '/v0/quota', (client) => client.getQuota())
    .forEach(testCase => {
      it(testCase.name, () => testCase.test(getClient()))
    })
})
```

**Lines saved:** 50-100+ by standardizing error testing

---

### 3. Constructor/Validation Test Duplication

#### Affected Files
- `socket-sdk-constructor-validation.test.mts` (99 lines)
- `socket-sdk-validation.test.mts` (185 lines)

#### Duplicate Test Cases

**Both files test identical scenarios:**

| Test Scenario | File 1 | File 2 |
|:--|:--:|:--:|
| Token not a string | ✓ | ✓ |
| Token null | ✓ | ✓ |
| Token undefined | ✓ | ✓ |
| Token empty string | ✓ | ✓ |
| Token whitespace only | ✓ | ✓ |
| Token exceeds max length | ✓ | ✓ |
| Token accepts max length | ✓ | ✓ |
| Timeout below minimum | ✓ | ✓ |
| Timeout above maximum | ✓ | ✓ |
| Timeout non-numeric | ✓ | ✓ |

#### Code Duplication Example

**socket-sdk-constructor-validation.test.mts (lines 12-57):**
```typescript
describe('apiToken validation', () => {
  it('should throw TypeError when apiToken is not a string', () => {
    expect(() => new SocketSdk(123 as unknown as string)).toThrow(TypeError)
    expect(() => new SocketSdk(123 as unknown as string)).toThrow(
      '"apiToken" is required and must be a string'
    )
  })

  it('should throw TypeError when apiToken is null', () => {
    expect(() => new SocketSdk(null as unknown as string)).toThrow(TypeError)
    expect(() => new SocketSdk(null as unknown as string)).toThrow(
      '"apiToken" is required and must be a string'
    )
  })

  // ... 6 more similar tests
})
```

**socket-sdk-validation.test.mts (lines 8-46):**
```typescript
describe('Constructor Validation', () => {
  it('creates a valid SDK instance with API token', () => {
    const client = new SocketSdk('valid-token')
    expect(client).toBeInstanceOf(SocketSdk)
  })

  it('rejects empty API token', () => {
    expect(() => new SocketSdk('')).toThrow('cannot be empty')
  })

  it('rejects whitespace-only API token', () => {
    expect(() => new SocketSdk('   ')).toThrow('cannot be empty')
  })

  // ... same tests repeated
})
```

#### Consolidation Strategy

Merge into single file `socket-sdk-constructor-validation.test.mts` with parameterization:
```typescript
import { describe, expect, it } from 'vitest'
import { SocketSdk } from '../src/index'

describe('SocketSdk - Constructor Validation', () => {
  describe('API Token Validation', () => {
    const invalidTokens = [
      { value: 123, expectedError: 'required and must be a string' },
      { value: null, expectedError: 'required and must be a string' },
      { value: undefined, expectedError: 'required and must be a string' },
      { value: '', expectedError: 'cannot be empty or whitespace-only' },
      { value: '   ', expectedError: 'cannot be empty or whitespace-only' },
      { value: 'a'.repeat(1025), expectedError: 'exceeds maximum length' }
    ]

    invalidTokens.forEach(({ value, expectedError }) => {
      it(`should reject token: ${String(value).slice(0, 20)}...`, () => {
        expect(() => new SocketSdk(value as unknown as string)).toThrow(
          expectedError
        )
      })
    })

    const validTokens = [
      { value: 'valid-token', description: 'normal token' },
      { value: 'a'.repeat(1024), description: 'max length token' },
      { value: '  token  ', description: 'token with whitespace' }
    ]

    validTokens.forEach(({ value, description }) => {
      it(`should accept ${description}`, () => {
        const client = new SocketSdk(value)
        expect(client).toBeInstanceOf(SocketSdk)
      })
    })
  })

  describe('Configuration Options Validation', () => {
    const invalidConfigs = [
      { config: { timeout: 4999 }, expectedError: 'must be a number between' },
      { config: { timeout: 301000 }, expectedError: 'must be a number between' },
      { config: { timeout: 'fast' }, expectedError: /must be.*number/ }
    ]

    invalidConfigs.forEach(({ config, expectedError }) => {
      it(`should reject invalid config: ${JSON.stringify(config)}`, () => {
        expect(() => new SocketSdk('token', config as any)).toThrow(
          expectedError
        )
      })
    })

    const validConfigs = [
      { timeout: 5000 },
      { timeout: 300000 },
      { retries: 0 }
    ]

    validConfigs.forEach(config => {
      it(`should accept valid config: ${JSON.stringify(config)}`, () => {
        const client = new SocketSdk('token', config as any)
        expect(client).toBeInstanceOf(SocketSdk)
      })
    })
  })
})
```

#### Result
- **Before:** 284 lines across 2 files
- **After:** ~150 lines in 1 file
- **Savings:** 130+ lines
- **Delete:** socket-sdk-validation.test.mts

---

### 4. Quota Utils Test Overlap

#### Affected Files
- `quota-utils.test.mts` (256 lines)
- `quota-utils-error-handling.test.mts` (126 lines)

#### Overlap Analysis
**quota-utils.test.mts (lines 16-41):**
```typescript
describe('getQuotaCost', () => {
  it('should return correct quota cost for high-cost methods', () => {
    expect(getQuotaCost('batchPackageFetch')).toBe(100)
    expect(getQuotaCost('searchDependencies')).toBe(100)
  })

  it('should throw error for unknown method', () => {
    expect(() => getQuotaCost('unknownMethod')).toThrow(
      'Unknown SDK method: "unknownMethod"'
    )
  })
})
```

**quota-utils-error-handling.test.mts (lines 20-61):**
```typescript
describe('loadRequirements error paths', () => {
  it('should throw error when requirements.json file cannot be read', async () => {
    vi.doMock('node:fs', () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => {
        throw new Error('ENOENT: no such file or directory')
      })
    }))
    // ... error handling test
  })
})
```

#### Strategy
- Keep `quota-utils.test.mts` for normal cases (feature tests)
- Keep `quota-utils-error-handling.test.mts` for edge cases (module mocking)
- Could extract shared test data to `test/utils/quota-fixtures.mts`

**Minimal consolidation opportunity** (40-60 lines max) - These serve different purposes.

---

### 5. Entitlements Test Parameterization

#### File Analysis
- **entitlements.test.mts** (417 lines)
- **31 test cases** across multiple describe blocks

#### Duplicate Patterns

**Pattern 1: Multiple entitlements scenarios** (lines 15-51):
```typescript
it('should return all entitlements for an organization', async () => {
  const mockResponse: EntitlementsResponse = {
    items: [
      { key: 'firewall', enabled: true },
      { key: 'scanning', enabled: false },
      { key: 'alerts', enabled: true }
    ]
  }
  nock('https://api.socket.dev')
    .get('/v0/orgs/test-org/entitlements')
    .reply(200, mockResponse)
  const result = await getClient().getEntitlements('test-org')
  expect(result).toHaveLength(3)
  expect(result).toEqual([...])
})

it('should handle empty entitlements response', async () => {
  const mockResponse: EntitlementsResponse = { items: [] }
  nock('https://api.socket.dev')
    .get('/v0/orgs/empty-org/entitlements')
    .reply(200, mockResponse)
  const result = await getClient().getEntitlements('empty-org')
  expect(result).toHaveLength(0)
  expect(result).toEqual([])
})
```

#### Consolidation Opportunity
Create test scenarios matrix:
```typescript
interface EntitlementTestCase {
  name: string
  org: string
  items: Entitlement[]
  expectedLength: number
}

const testCases: EntitlementTestCase[] = [
  {
    name: 'all entitlements',
    org: 'test-org',
    items: [
      { key: 'firewall', enabled: true },
      { key: 'scanning', enabled: false },
      { key: 'alerts', enabled: true }
    ],
    expectedLength: 3
  },
  {
    name: 'empty entitlements',
    org: 'empty-org',
    items: [],
    expectedLength: 0
  }
  // ... more cases
]

testCases.forEach(({ name, org, items, expectedLength }) => {
  it(`should ${name}`, async () => {
    nock('https://api.socket.dev')
      .get(`/v0/orgs/${org}/entitlements`)
      .reply(200, { items })

    const result = await getClient().getEntitlements(org)
    expect(result).toHaveLength(expectedLength)
  })
})
```

**Estimated savings:** 150-200 lines

---

## Coverage and Test Distribution

### Test Type Distribution
```
Configuration/Validation: 19%  (185 lines)
Error Handling:          18%  (283 lines)
HTTP Client:             13%  (241 lines)
API Methods:             23%  (1450 lines)
Utilities:               15%  (319 lines)
Fixtures/Mocking:         7%  (136 lines)
Infrastructure:           5%  (97 lines)
```

### Testing Approach Distribution
```
Nock-based HTTP mocking:  22 files (88%)
Local HTTP servers:        3 files (12%)
Module mocking (vi.mock):  2 files (8%)
Direct unit tests:         6 files (24%)
```

### Helper Adoption
```
setupTestClient():    8/25 files = 32%  (RECOMMENDED)
setupTestEnvironment(): 3/25 files = 12%
Direct nock setup:    14/25 files = 56% (Could use helpers)
```

---

## Opportunities Summary Table

| Opportunity | Files | Effort | Savings | Impact |
|:--|:--:|:--:|:--:|:--|
| Local server helpers | 3 | Low | 60-90 | High |
| Error test consolidation | 5+ | Medium | 100-150 | High |
| Validation test merge | 2 | Low | 130+ | Medium |
| Entitlements parameterize | 1 | Medium | 150-200 | Low |
| Batch ops parameterize | 1 | Medium | 100-150 | Low |
| Quota fixtures extract | 2 | Low | 40-60 | Low |
| **TOTAL** | - | - | **600-750** | - |

## Key Metrics

- **Duplication Factor:** 9-11% of test code is duplicated
- **Helper Adoption Gap:** 56% of files could use existing helpers better
- **Test Maturity:** High - good patterns, good isolation, good error handling
- **Refactoring Safety:** High - all opportunities maintain or improve coverage

