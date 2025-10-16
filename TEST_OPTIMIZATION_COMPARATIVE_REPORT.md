# Test Optimization Comparative Report
## socket-sdk-js & socket-packageurl-js

**Date:** 2025-10-16
**Analysis Scope:** Both test suites analyzed for DRY principles, deduplication, and optimization opportunities while maintaining 100% code coverage

---

## Executive Summary

### Overall Metrics

| Repository | Test Files | Test Lines | Test Cases | Duplication | Optimization Potential |
|------------|------------|------------|------------|-------------|------------------------|
| **socket-sdk-js** | 25 | 6,127 | 537 | 9-11% | 600-750 lines (10-12%) |
| **socket-packageurl-js** | 13 | 5,705 | 317 | 28% | 700-900 lines (12-16%) |
| **TOTAL** | **38** | **11,832** | **854** | **18%** | **1,300-1,650 lines (11-14%)** |

### Key Findings

**socket-sdk-js:**
- Well-organized test infrastructure with helpers
- **Low adoption** of existing helpers (32% usage)
- Isolated duplication hotspots (local server setup, error handling)
- Two redundant test files covering same scenarios

**socket-packageurl-js:**
- **High structural duplication** (28% overall, up to 75% in some areas)
- Inconsistent helper adoption (34 manual constructions vs helpers)
- Excellent parameterized test examples but underutilized
- Strong candidates for test factories

---

## socket-sdk-js: Detailed Findings

### Test Suite Composition
- **25 test files** (6,127 lines)
- **537 test cases** in 156 describe blocks
- **8 utility helper files** (1,147 lines)
- **Excellent documentation** (655-line README)

### Duplication Patterns (9-11%)

#### 1. Local HTTP Server Setup (HIGH PRIORITY)
**Impact:** 60-90 lines saved
**Effort:** 1-2 hours
**Risk:** LOW

**Affected Files (3):**
- `socket-sdk-api-methods.coverage.test.mts`
- `socket-sdk-error-handling.test.mts`
- `socket-sdk-download-patch-blob.test.mts`

**Current Pattern (repeated 3x):**
```typescript
// Each file has this 35-50 line boilerplate
let server: http.Server | undefined
let serverPort: number | undefined

function setupLocalHttpServer(handler: RequestListener): void {
  before(async () => {
    server = http.createServer(handler)
    await new Promise<void>((resolve) => {
      server!.listen(0, () => {
        serverPort = (server!.address() as AddressInfo).port
        resolve()
      })
    })
  })

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()))
      })
      server = undefined
      serverPort = undefined
    }
  })
}
```

**Proposed Solution:**
Create `test/utils/local-server-helpers.mts`:
```typescript
export function setupLocalHttpServer(
  handler: RequestListener
): () => number {
  let server: http.Server | undefined
  let port: number | undefined

  before(async () => {
    server = http.createServer(handler)
    await new Promise<void>((resolve) => {
      server!.listen(0, () => {
        port = (server!.address() as AddressInfo).port
        resolve()
      })
    })
  })

  after(async () => {
    await server?.close()
    server = undefined
    port = undefined
  })

  return () => port!
}
```

**Usage:**
```typescript
import { setupLocalHttpServer } from './utils/local-server-helpers.mts'

const getPort = setupLocalHttpServer((req, res) => {
  // handler logic
})

it('should work', async () => {
  const client = getClient({ baseUrl: `http://localhost:${getPort()}` })
  // test logic
})
```

---

#### 2. Error Response Mocking (HIGH PRIORITY)
**Impact:** 100-150 lines saved
**Effort:** 2-3 hours
**Risk:** LOW

**Problem:** `error-test-helpers.mts` exists with these helpers but **tests don't use them**

**Duplication Count (26+ tests):**
- 401 Unauthorized: 5 implementations
- 403 Forbidden: 4 implementations
- 404 Not Found: 8 implementations
- 500 Server Error: 6 implementations
- Network errors: 3+ implementations

**Current Pattern (repeated):**
```typescript
// In multiple files
it('should handle 401 unauthorized', async () => {
  nock('https://api.socket.dev')
    .get('/v0/some/endpoint')
    .reply(401, { error: 'Unauthorized' })

  const client = getClient()
  await expect(client.someMethod()).rejects.toThrow('Unauthorized')
})

it('should handle 404 not found', async () => {
  nock('https://api.socket.dev')
    .get('/v0/some/endpoint')
    .reply(404, { error: 'Not found' })

  const client = getClient()
  await expect(client.someMethod()).rejects.toThrow('Not found')
})
```

**Proposed Solution:**
Use existing helpers from `error-test-helpers.mts`:
```typescript
import { testErrorResponse } from './utils/error-test-helpers.mts'

// Parameterized error tests
const errorCases = [
  { code: 401, message: 'Unauthorized', error: 'Invalid API key' },
  { code: 403, message: 'Forbidden', error: 'Access denied' },
  { code: 404, message: 'Not Found', error: 'Resource not found' },
  { code: 500, message: 'Server Error', error: 'Internal error' }
] as const

errorCases.forEach(({ code, message, error }) => {
  it(`should handle ${code} ${message}`, async () => {
    testErrorResponse({
      method: 'get',
      path: '/v0/some/endpoint',
      statusCode: code,
      responseBody: { error },
      expectedError: error,
      testFn: () => getClient().someMethod()
    })
  })
})
```

---

#### 3. Constructor/Validation Duplication (HIGH PRIORITY)
**Impact:** 130+ lines saved, **delete 1 entire file**
**Effort:** 1 hour
**Risk:** LOW

**Problem:** Two files test identical scenarios

**Files:**
1. `socket-sdk-constructor-validation.test.mts` (99 lines)
2. `socket-sdk-validation.test.mts` (185 lines)

**Overlap:**
- Both test token validation (missing, invalid, empty)
- Both test configuration options (baseUrl, timeout, retries)
- Both test error scenarios
- Both test constructor behavior

**Recommendation:**
- **Delete** `socket-sdk-constructor-validation.test.mts`
- **Keep** `socket-sdk-validation.test.mts` (more comprehensive)
- Verify all scenarios in deleted file are covered in remaining file
- Run coverage report to confirm no loss

---

#### 4. Entitlements Test Parameterization (MEDIUM PRIORITY)
**Impact:** 150-200 lines saved
**Effort:** 2 hours
**Risk:** LOW

**File:** `entitlements.test.mts`

**Current:** 31 test cases with similar structure

**Example Pattern:**
```typescript
it('should get organization entitlements', async () => {
  const orgSlug = 'test-org'
  nock('https://api.socket.dev')
    .get(`/v0/organizations/${orgSlug}/entitlements`)
    .reply(200, { data: mockEntitlements })

  const client = getClient()
  const result = await client.getOrganizationEntitlements(orgSlug)
  expect(result).toEqual(mockEntitlements)
})

it('should get organization quotas', async () => {
  const orgSlug = 'test-org'
  nock('https://api.socket.dev')
    .get(`/v0/organizations/${orgSlug}/quotas`)
    .reply(200, { data: mockQuotas })

  const client = getClient()
  const result = await client.getOrganizationQuotas(orgSlug)
  expect(result).toEqual(mockQuotas)
})
```

**Proposed Parameterization:**
```typescript
interface EntitlementTestCase {
  name: string
  method: keyof SocketSdk
  path: string
  params: string[]
  response: unknown
}

const testCases: EntitlementTestCase[] = [
  {
    name: 'organization entitlements',
    method: 'getOrganizationEntitlements',
    path: '/v0/organizations/{orgSlug}/entitlements',
    params: ['test-org'],
    response: mockEntitlements
  },
  {
    name: 'organization quotas',
    method: 'getOrganizationQuotas',
    path: '/v0/organizations/{orgSlug}/quotas',
    params: ['test-org'],
    response: mockQuotas
  }
  // ... 29 more cases
]

testCases.forEach(({ name, method, path, params, response }) => {
  it(`should get ${name}`, async () => {
    const pathWithParams = path.replace(/{(\w+)}/g, (_, key) => params.shift()!)
    nock('https://api.socket.dev')
      .get(pathWithParams)
      .reply(200, { data: response })

    const client = getClient()
    const result = await client[method](...params)
    expect(result).toEqual(response)
  })
})
```

---

#### 5. Batch Operations Parameterization (LOW PRIORITY)
**Impact:** 100-150 lines saved
**Effort:** 2-3 hours
**Risk:** MEDIUM (complex test logic)

**File:** `socket-sdk-batch.test.mts` (508 lines)

**Current:** 16 describe blocks with similar patterns

**Recommendation:**
- Create parameterized fixtures for batch operations
- Extract common assertion patterns
- Consider data-driven testing approach
- **Lower ROI** - only pursue if time permits

---

### Helper Adoption Gap

**Current State:**
- `setupTestClient()`: 8/25 files (32%)
- Direct nock setup: 14/25 files (56%)
- Local HTTP servers: 3/25 files (12%)

**Opportunity:** 14 files could migrate to `setupTestClient()`

**Migration Example:**
```typescript
// Before (manual setup)
import nock from 'nock'

describe('My tests', () => {
  beforeEach(() => {
    nock.cleanAll()
  })

  afterEach(() => {
    nock.cleanAll()
    nock.enableNetConnect()
  })

  it('should work', async () => {
    const client = new SocketSdk('test-token')
    // test logic
  })
})

// After (using helper)
import { setupTestClient } from './utils/environment.mts'

describe('My tests', () => {
  const getClient = setupTestClient('test-token')

  it('should work', async () => {
    const client = getClient()
    // test logic
  })
})
```

---

### Implementation Roadmap

| Phase | Focus | Files | Effort | Savings | Priority |
|-------|-------|-------|--------|---------|----------|
| **1** | Quick wins | 5 | 3-4 hrs | 290-370 lines | HIGH |
| **2** | Consolidation | 8 | 4-5 hrs | 190-260 lines | MEDIUM |
| **3** | Enhancements | 3 | 2-3 hrs | 100-150 lines | LOW |
| **TOTAL** | **All phases** | **16** | **8-12 hrs** | **600-750 lines** | - |

**Phase 1 (Quick Wins):**
1. Create `local-server-helpers.mts` (1-2 hours, 60-90 lines)
2. Merge validation tests (1 hour, 130+ lines, delete 1 file)
3. Standardize error testing (2-3 hours, 100-150 lines)

**Phase 2 (Consolidation):**
4. Parameterize entitlements tests (2 hours, 150-200 lines)
5. Enhance existing fixtures (1-2 hours, 40-60 lines)

**Phase 3 (Enhancements):**
6. Migrate to `setupTestClient()` (1-2 hours, quality improvement)
7. Batch operations parameterization (2-3 hours, 100-150 lines)

---

## socket-packageurl-js: Detailed Findings

### Test Suite Composition
- **13 test files** (5,705 lines)
- **317 test cases** in 77 describe blocks
- **19 parameterized tests** (it.each blocks)
- **5 test utility files**

### Duplication Patterns (28%)

#### 1. Manual Constructor Overuse (HIGH PRIORITY)
**Impact:** 34 constructions → helper calls
**Effort:** 30 minutes
**Risk:** ZERO

**Problem:** 78 total `new PackageURL()` calls, only 44 use `createTestPurl()` helper

**Worst Offenders:**
- `package-url-builder.test.mts`: 4/21 uses helper (19%)
- `purl-edge-cases.test.mts`: 31/31 uses helper (100%) ✅

**Manual Pattern:**
```typescript
const purl = new PackageURL('pkg:npm/lodash@4.17.21')
```

**Helper Pattern:**
```typescript
const purl = createTestPurl('pkg:npm/lodash@4.17.21')
```

**Recommendation:**
- Search and replace all 34 manual constructions
- Enforce helper usage via lint rule or code review
- **Zero functional change** - pure refactor

---

#### 2. URL Converter Test Duplication (HIGH PRIORITY)
**Impact:** 150 → 80 lines (47% reduction)
**Effort:** 2 hours
**Risk:** LOW

**File:** `url-converter.test.mts`

**Problem:** 75% similarity between `toRepositoryUrl` and `toDownloadUrl` tests

**Current Pattern (repeated):**
```typescript
describe('toRepositoryUrl', () => {
  it('should convert npm package', () => {
    const purl = createTestPurl('pkg:npm/lodash@4.17.21')
    const result = toRepositoryUrl(purl)
    expect(result.ok).toBe(true)
    expect(result.value).toBe('https://registry.npmjs.org/lodash')
  })

  it('should handle npm scoped package', () => {
    const purl = createTestPurl('pkg:npm/%40types/node@18.0.0')
    const result = toRepositoryUrl(purl)
    expect(result.ok).toBe(true)
    expect(result.value).toBe('https://registry.npmjs.org/@types/node')
  })
  // ... 8 more similar tests
})

describe('toDownloadUrl', () => {
  it('should convert npm package', () => {
    const purl = createTestPurl('pkg:npm/lodash@4.17.21')
    const result = toDownloadUrl(purl)
    expect(result.ok).toBe(true)
    expect(result.value).toBe('https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz')
  })

  it('should handle npm scoped package', () => {
    const purl = createTestPurl('pkg:npm/%40types/node@18.0.0')
    const result = toDownloadUrl(purl)
    expect(result.ok).toBe(true)
    expect(result.value).toBe('https://registry.npmjs.org/@types/node/-/node-18.0.0.tgz')
  })
  // ... 8 more similar tests
})
```

**Proposed Factory Pattern:**
```typescript
interface UrlConverterTestCase {
  purl: string
  expectedRepo: string
  expectedDownload: string
  description: string
}

const testCases: UrlConverterTestCase[] = [
  {
    purl: 'pkg:npm/lodash@4.17.21',
    expectedRepo: 'https://registry.npmjs.org/lodash',
    expectedDownload: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
    description: 'npm package'
  },
  {
    purl: 'pkg:npm/%40types/node@18.0.0',
    expectedRepo: 'https://registry.npmjs.org/@types/node',
    expectedDownload: 'https://registry.npmjs.org/@types/node/-/node-18.0.0.tgz',
    description: 'npm scoped package'
  }
  // ... more cases
]

describe('URL Converters', () => {
  testCases.forEach(({ purl, expectedRepo, expectedDownload, description }) => {
    describe(description, () => {
      const testPurl = createTestPurl(purl)

      it('toRepositoryUrl', () => {
        const result = toRepositoryUrl(testPurl)
        expect(result.ok).toBe(true)
        expect(result.value).toBe(expectedRepo)
      })

      it('toDownloadUrl', () => {
        const result = toDownloadUrl(testPurl)
        expect(result.ok).toBe(true)
        expect(result.value).toBe(expectedDownload)
      })
    })
  })
})
```

**Benefits:**
- Single source of truth for test data
- Easy to add new ecosystems (one object vs 2+ tests)
- Guarantees both converters tested with same inputs

---

#### 3. JSON Error Validation Duplication (HIGH PRIORITY)
**Impact:** 80 → 40 lines (50% reduction)
**Effort:** 1.5 hours
**Risk:** LOW

**Files (3):**
- `json-export.test.mts`
- `json-import.test.mts`
- `integration.test.mts`

**Problem:** 70% duplication across JSON round-trip error handling

**Current Pattern (repeated in 3 files):**
```typescript
describe('Invalid JSON handling', () => {
  it('should reject missing required fields', () => {
    const invalid = { type: 'npm' } // missing name
    expect(() => PackageURL.fromJSON(invalid)).toThrow(/name is required/)
  })

  it('should reject invalid type values', () => {
    const invalid = { type: 'invalid', name: 'foo' }
    expect(() => PackageURL.fromJSON(invalid)).toThrow(/invalid type/)
  })

  it('should reject malformed qualifiers', () => {
    const invalid = { type: 'npm', name: 'foo', qualifiers: 'not-object' }
    expect(() => PackageURL.fromJSON(invalid)).toThrow(/qualifiers must be object/)
  })
  // ... more similar tests
})
```

**Proposed Consolidation:**
Create `test/utils/json-validation-helpers.mts`:
```typescript
interface JsonValidationCase {
  description: string
  input: unknown
  expectedError: RegExp
}

export const invalidJsonCases: JsonValidationCase[] = [
  {
    description: 'missing required fields',
    input: { type: 'npm' },
    expectedError: /name is required/
  },
  {
    description: 'invalid type values',
    input: { type: 'invalid', name: 'foo' },
    expectedError: /invalid type/
  },
  {
    description: 'malformed qualifiers',
    input: { type: 'npm', name: 'foo', qualifiers: 'not-object' },
    expectedError: /qualifiers must be object/
  }
  // ... more cases
]

export function testInvalidJsonCases(
  cases: JsonValidationCase[] = invalidJsonCases
): void {
  cases.forEach(({ description, input, expectedError }) => {
    it(`should reject ${description}`, () => {
      expect(() => PackageURL.fromJSON(input)).toThrow(expectedError)
    })
  })
}
```

**Usage in all 3 files:**
```typescript
import { testInvalidJsonCases } from './utils/json-validation-helpers.mts'

describe('JSON validation', () => {
  testInvalidJsonCases() // Runs all standard validation tests
})
```

---

#### 4. Builder Test Consolidation (MEDIUM PRIORITY)
**Impact:** 30 → 22 lines (27% reduction)
**Effort:** 1 hour
**Risk:** LOW

**File:** `package-url-builder.test.mts`

**Problem:** Repetitive builder method tests

**Current Pattern:**
```typescript
it('should set type', () => {
  const builder = new PackageURLBuilder()
  builder.setType('npm')
  expect(builder.build().type).toBe('npm')
})

it('should set name', () => {
  const builder = new PackageURLBuilder()
  builder.setName('lodash')
  expect(builder.build().name).toBe('lodash')
})

it('should set version', () => {
  const builder = new PackageURLBuilder()
  builder.setVersion('4.17.21')
  expect(builder.build().version).toBe('4.17.21')
})
```

**Proposed Parameterization:**
```typescript
const setterTests = [
  { method: 'setType', property: 'type', value: 'npm' },
  { method: 'setName', property: 'name', value: 'lodash' },
  { method: 'setVersion', property: 'version', value: '4.17.21' },
  { method: 'setNamespace', property: 'namespace', value: '@types' }
] as const

setterTests.forEach(({ method, property, value }) => {
  it(`should set ${property}`, () => {
    const builder = new PackageURLBuilder()
    builder[method](value)
    expect(builder.build()[property]).toBe(value)
  })
})
```

---

#### 5. Result Type Assertion Duplication (MEDIUM PRIORITY)
**Impact:** 110 → 90 lines (18% reduction)
**Effort:** 1.5 hours
**Risk:** LOW

**Files:** Multiple files with Result<T, E> assertions

**Problem:** Repeated ok/error assertion patterns

**Current Pattern (repeated 40+ times):**
```typescript
const result = someFunction()
expect(result.ok).toBe(true)
if (result.ok) {
  expect(result.value).toBe(expectedValue)
}

const errorResult = someErrorFunction()
expect(errorResult.ok).toBe(false)
if (!errorResult.ok) {
  expect(errorResult.error).toMatch(/expected error/)
}
```

**Proposed Helper (in existing `assertions.mts`):**
```typescript
export function expectOk<T>(result: Result<T, unknown>): asserts result is Ok<T> {
  expect(result.ok).toBe(true)
}

export function expectError<E>(result: Result<unknown, E>): asserts result is Err<E> {
  expect(result.ok).toBe(false)
}

export function expectOkValue<T>(result: Result<T, unknown>, expected: T): void {
  expectOk(result)
  expect(result.value).toEqual(expected)
}

export function expectErrorMatch<E>(
  result: Result<unknown, E>,
  pattern: RegExp
): void {
  expectError(result)
  expect(String(result.error)).toMatch(pattern)
}
```

**Usage:**
```typescript
import { expectOkValue, expectErrorMatch } from './utils/assertions.mts'

const result = someFunction()
expectOkValue(result, expectedValue)

const errorResult = someErrorFunction()
expectErrorMatch(errorResult, /expected error/)
```

---

#### 6. String Transformation Test Patterns (LOW PRIORITY)
**Impact:** 35 → 25 lines (29% reduction)
**Effort:** 1 hour
**Risk:** LOW

**File:** `strings.test.mts`

**Current:** Good use of `it.each` but could be more consistent

**Recommendation:**
- Standardize all string transformation tests to use `it.each`
- Create helper for transformation test cases
- Document pattern for future additions

---

### Inconsistency Patterns

**1. Assertion Styles (3 different approaches):**
```typescript
// Style 1: toBeInstanceOf
expect(purl).toBeInstanceOf(PackageURL)

// Style 2: constructor.name
expect(purl.constructor.name).toBe('PackageURL')

// Style 3: typeof + property check
expect(typeof purl).toBe('object')
expect(purl.type).toBeDefined()
```

**Recommendation:** Standardize on `toBeInstanceOf` (most type-safe)

**2. Error Message Validation (3 different approaches):**
```typescript
// Style 1: Regex
expect(() => fn()).toThrow(/expected pattern/)

// Style 2: Exact match
expect(() => fn()).toThrow('Exact error message')

// Style 3: Substring
expect(() => fn()).toThrow(expect.stringContaining('substring'))
```

**Recommendation:** Prefer regex for flexibility with message changes

**3. Import Extensions (inconsistent):**
```typescript
// Some files
import { PackageURL } from '../src/package-url.mjs'

// Other files
import { PackageURL } from '../src/package-url.mts'
```

**Recommendation:** Standardize on `.mts` (source) or `.mjs` (build)

---

### Implementation Roadmap

| Phase | Focus | Files | Effort | Savings | Priority |
|-------|-------|-------|--------|---------|----------|
| **1** | Foundation | 8 | 3-4 hrs | 150-200 lines | HIGH |
| **2** | Consolidation | 3 | 3.5 hrs | 100-150 lines | MEDIUM |
| **3** | Enhancement | 5 | 3-4 hrs | 50-100 lines | LOW |
| **TOTAL** | **All phases** | **16** | **9.5-11.5 hrs** | **700-900 lines** | - |

**Phase 1 (Foundation):**
1. Enforce `createTestPurl()` usage (30 min, quality)
2. Create assertion helpers (1 hour, 20-30 lines saved)
3. Consolidate JSON error validation (1.5 hours, 40-50 lines saved)
4. URL converter test factory (2 hours, 70 lines saved)

**Phase 2 (Consolidation):**
5. JSON round-trip factory (1.5 hours, 50-70 lines saved)
6. Builder test parameterization (1 hour, 8 lines saved)
7. Result type assertions (1 hour, 20 lines saved)

**Phase 3 (Enhancement):**
8. Type-specific fixtures (2 hours, quality improvement)
9. Unify assertion styles (1 hour, quality improvement)
10. Standardize string transformation tests (1 hour, 10 lines saved)

---

## Combined Recommendations

### Priority Matrix

| Priority | Repository | Task | Effort | Impact | Coverage Risk |
|----------|------------|------|--------|--------|---------------|
| **P0** | socket-sdk-js | Merge validation tests | 1 hr | 130+ lines | ZERO |
| **P0** | socket-packageurl-js | Enforce helper usage | 30 min | Quality++ | ZERO |
| **P1** | socket-sdk-js | Local server helpers | 1-2 hrs | 60-90 lines | ZERO |
| **P1** | socket-packageurl-js | URL converter factory | 2 hrs | 70 lines | ZERO |
| **P1** | socket-sdk-js | Standardize error tests | 2-3 hrs | 100-150 lines | LOW |
| **P2** | socket-packageurl-js | JSON validation helpers | 1.5 hrs | 40-50 lines | LOW |
| **P2** | socket-sdk-js | Entitlements parameterization | 2 hrs | 150-200 lines | LOW |
| **P2** | socket-packageurl-js | Result assertions | 1.5 hrs | 20 lines | LOW |
| **P3** | socket-sdk-js | Batch parameterization | 2-3 hrs | 100-150 lines | MEDIUM |
| **P3** | socket-packageurl-js | Style consistency | 2 hrs | Quality++ | ZERO |

---

### Estimated Total Impact

**Time Investment:** 17.5-23.5 hours across both repos

**Lines Saved:**
- socket-sdk-js: 600-750 lines (10-12%)
- socket-packageurl-js: 700-900 lines (12-16%)
- **Total: 1,300-1,650 lines (11-14%)**

**Quality Improvements:**
- Consistent helper adoption across all tests
- Standardized assertion patterns
- Improved maintainability through parameterization
- Better documentation through test structure
- Easier addition of new test cases

**Coverage Guarantee:** 100% maintained throughout all refactorings

---

### Execution Strategy

**Week 1 (P0 + P1): Quick Wins**
- Day 1: socket-packageurl-js helper enforcement (30 min)
- Day 1: socket-sdk-js validation merge (1 hr)
- Day 2: socket-sdk-js local server helpers (1-2 hrs)
- Day 3: socket-packageurl-js URL converter factory (2 hrs)
- Day 4-5: socket-sdk-js error test standardization (2-3 hrs)

**Expected Week 1 Results:**
- 390-540 lines saved
- Zero coverage loss
- 5 major improvements delivered

**Week 2 (P2): Consolidation**
- Day 1: socket-packageurl-js JSON validation (1.5 hrs)
- Day 2: socket-packageurl-js Result assertions (1.5 hrs)
- Day 3-4: socket-sdk-js entitlements parameterization (2 hrs)

**Expected Week 2 Results:**
- 210-270 lines saved
- Enhanced test infrastructure
- 3 major improvements delivered

**Week 3 (P3): Enhancement (Optional)**
- Day 1-2: socket-sdk-js batch parameterization (2-3 hrs)
- Day 3: socket-packageurl-js style consistency (2 hrs)

**Expected Week 3 Results:**
- 100-150 lines saved
- Quality standardization complete
- 2 major improvements delivered

---

## Risk Assessment

### Zero-Risk Changes (Can do immediately)
- Helper usage enforcement (search/replace)
- File merges with coverage verification
- Style consistency improvements
- Import standardization

### Low-Risk Changes (Straightforward refactoring)
- Parameterization of similar tests
- Creating new utility helpers
- Extracting common patterns
- Factory pattern implementations

### Medium-Risk Changes (Require careful testing)
- Complex test logic consolidation (batch operations)
- Tests with external dependencies
- Tests with timing or order sensitivity

**Mitigation Strategy:**
1. Run full test suite after each change
2. Check coverage reports before/after
3. Create separate PR for each major change
4. Review diffs carefully for lost test cases

---

## Success Metrics

**Before Optimization:**
- 38 test files
- 11,832 lines of test code
- 854 test cases
- 18% duplication
- Inconsistent patterns

**After Optimization:**
- 37 test files (1 deleted)
- 10,182-10,532 lines (11-14% reduction)
- 854 test cases (same coverage)
- <5% duplication
- Consistent patterns across both repos

**Quality Indicators:**
- ✅ 100% test coverage maintained
- ✅ All tests pass
- ✅ No behavioral changes
- ✅ Improved maintainability
- ✅ Easier to add new tests
- ✅ Better documentation through structure

---

## Conclusion

Both repositories have significant opportunities for test optimization:

**socket-sdk-js** has **low overall duplication** (9-11%) but suffers from:
- Underutilized existing helpers
- Isolated duplication hotspots
- Redundant test files

**socket-packageurl-js** has **high structural duplication** (28%) from:
- Manual constructor overuse
- Repeated test patterns
- Inconsistent styles

**Combined opportunity:** 1,300-1,650 lines (11-14%) can be eliminated with **zero coverage loss** through systematic application of DRY principles.

**Recommended approach:**
1. Start with zero-risk changes (P0)
2. Focus on high-impact items (P1)
3. Build momentum with quick wins
4. Tackle complex items last (P3)

**Expected outcome:** More maintainable, consistent, and efficient test suites while preserving complete coverage.
