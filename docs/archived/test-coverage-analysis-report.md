# Socket SDK Test Coverage Analysis Report

**Generated:** 2025-10-15
**Project:** @socketsecurity/sdk v2.0.0
**Coverage Tool:** Vitest with V8 provider

---

## Executive Summary

The Socket SDK currently has **94.08% statement coverage**, which falls short of the target thresholds defined in `vitest.config.mts`:
- **Lines:** 94.08% (target: 96%) ❌ **-1.92%**
- **Statements:** 94.08% (target: 96%) ❌ **-1.92%**
- **Functions:** 96.74% (target: 100%) ❌ **-3.26%**
- **Branches:** 93.99% (target: 93%) ✅ **+0.99%**

**Total Gap to Close:** 2 percentage points in lines/statements, 4 untested functions

---

## Coverage by File

| File | Statements | Branches | Functions | Lines | Uncovered |
|------|-----------|----------|-----------|-------|-----------|
| **constants.ts** | 100% ✅ | 100% ✅ | 100% ✅ | 100% ✅ | 0 |
| **file-upload.ts** | 100% ✅ | 100% ✅ | 100% ✅ | 100% ✅ | 0 |
| **index.ts** | 100% ✅ | 100% ✅ | 100% ✅ | 100% ✅ | 0 |
| **promise-queue.ts** | 100% ✅ | 100% ✅ | 100% ✅ | 100% ✅ | 0 |
| **testing.ts** | 100% ✅ | 100% ✅ | 100% ✅ | 100% ✅ | 0 |
| **user-agent.ts** | 100% ✅ | 100% ✅ | 100% ✅ | 100% ✅ | 0 |
| **utils.ts** | 100% ✅ | 100% ✅ | 100% ✅ | 100% ✅ | 0 |
| **quota-utils.ts** | 96.74% ⚠️ | 92.85% | 100% ✅ | 96.74% | 4 lines |
| **http-client.ts** | 90.58% ❌ | 92.30% | 87.50% | 90.58% | 16 lines |
| **socket-sdk-class.ts** | 92.09% ❌ | 92.72% | 97.26% | 92.09% | 112 lines |

---

## Top Priority: Files Needing Coverage Improvements

### 1. **http-client.ts** (90.58% coverage, -5.42% from target)

**File Size:** 506 lines
**Purpose:** HTTP client utilities for Socket API communication
**Uncovered Lines:** 16 statements

#### Uncovered Code Patterns:

**A. ResponseError Constructor Edge Cases (Lines 38-45)**
```typescript
// Lines 38-45: ResponseError constructor fallback paths
- Line 38-40: Empty message parameter fallback
- Line 42-45: Error.captureStackTrace call
```
**Issue:** Constructor called with message parameter in all tests
**Recommendation:** Add test for ResponseError with undefined/empty message

**B. getResponseJson Error Handling (Lines 236-248, 285)**
```typescript
// Lines 236-248: Non-OK response handling
- Line 236-240: ResponseError throw for non-OK responses
- Line 245-248: Empty response string handling

// Line 285: Outer catch block rethrow
- Line 285: Catch block that rethrows errors
```
**Issue:** Tests don't trigger non-OK response path in getResponseJson
**Recommendation:** Create test with 400/500 status codes

**C. Uncovered Branch Scenarios:**
- Line 28 branch 0: ResponseError instance initialization
- Line 235 branch 0: isResponseOk false path
- Line 244 branch 0: Empty string response
- Line 269 branch 0: Non-Error thrown from JSON.parse

---

### 2. **socket-sdk-class.ts** (92.09% coverage, -3.91% from target)

**File Size:** 2,520 lines (largest file)
**Purpose:** Main SocketSdk class with all API methods
**Uncovered Lines:** 112 statements

#### Uncovered Functions:
1. **`onRetry` callback (line 180)** - Retry logic for non-ResponseError types
2. **`sendApi` method (line 2019)** - Generic POST/PUT API method with throws=false

#### Uncovered Code Patterns by Category:

**A. Error Handling - Retry Logic (Lines 185-194)**
```typescript
// Lines 185-189: Authentication/authorization errors in retry
const { statusCode } = error.response
if (statusCode === 401 || statusCode === 403) {
  throw error
}
return undefined
```
**Issue:** No tests trigger 401/403 errors during retry
**Recommendation:** Mock API to return 401/403 on first attempt, success on retry

**B. Error Handling - API Error Processing (Lines 373-429)**
```typescript
// Lines 373-379: Server error (5xx) handling
if (statusCode && statusCode >= 500) {
  throw new Error(`Socket API server error (${statusCode})`)
}

// Lines 383-404: JSON error body parsing with details
const parsed = JSON.parse(bodyStr)
if (typeof parsed?.error?.message === 'string') {
  body = parsed.error.message
  if (parsed.error.details) { /* ... */ }
}

// Lines 419-429: Status message replacement in error text
if (statusMessage && errorMessage.includes(statusMessage)) {
  errorMessage = errorMessage.replace(statusMessage, trimmedBody)
} else {
  errorMessage = `${errorMessage}: ${trimmedBody}`
}
```
**Issue:** Error responses with structured JSON bodies not tested
**Recommendation:** Test API errors with `{error: {message, details}}` structure

**C. API Methods - Error Return Paths (Lines 1076-1111)**
```typescript
// Lines 1076-1089: getApi with throws=false and non-OK response
if (!isResponseOk(response)) {
  if (throws) {
    throw new ResponseError(response)
  }
  return { success: false, error: errorResult.error, ... }
}

// Lines 1096-1111: getApi success/error result formatting
if (throws) {
  return data as T
}
return { success: true, data, ... }
```
**Issue:** getApi() called with throws=false not tested
**Recommendation:** Test getApi with `{ throws: false }` option

**D. Streaming Methods (Lines 2113-2159)**
```typescript
// Lines 2113-2115: streamOrgFullScan error response
if (!isResponseOk(res)) {
  throw new ResponseError(res)
}

// Lines 2119-2133: File streaming with size limits
if (typeof output === 'string') {
  const writeStream = createWriteStream(output)
  res.on('data', (chunk) => {
    if (bytesWritten > MAX_STREAM_SIZE) { /* ... */ }
  })
}

// Lines 2140-2159: Stdout streaming with size limits
else if (output === true) {
  res.on('data', (chunk) => {
    if (bytesWritten > MAX_STREAM_SIZE) { /* ... */ }
  })
}
```
**Issue:** Streaming methods not tested at all
**Recommendation:** Add tests for streamOrgFullScan with file/stdout output

**E. Stream Error Handlers (Lines 2193-2213)**
```typescript
// Lines 2193-2194: HTTP error in streamPatchesFromScan
if (!isResponseOk(response)) {
  throw new ResponseError(response, 'GET Request failed')
}

// Lines 2212-2213: NDJSON parse errors
catch (e) {
  debugLog('streamPatchesFromScan', `Failed to parse line: ${e}`)
}
```
**Issue:** Stream parsing error paths not tested
**Recommendation:** Test with malformed NDJSON responses

**F. Download Error Handlers (Lines 2504, 2508)**
```typescript
// Lines 2504, 2508: downloadPatchBlob error callbacks
res.on('error', err => reject(err))
req.on('error', err => reject(new Error(...)))
```
**Issue:** Network errors during download not tested
**Recommendation:** Mock request/response errors

---

### 3. **quota-utils.ts** (96.74% coverage, -0.26% from target)

**File Size:** 217 lines
**Purpose:** Quota cost calculation and requirements checking
**Uncovered Lines:** 4 statements

#### Uncovered Code:
```typescript
// Lines 38-39: File not found error
if (!existsSync(requirementsPath)) {
  throw new Error(`Requirements file not found at: ${requirementsPath}`)
}

// Lines 44-45: JSON parse error
catch (e) {
  throw new Error('Failed to load SDK method requirements', { cause: e })
}
```

**Issue:** Error paths in loadRequirements() function not tested
**Recommendation:** Test with missing/malformed requirements file (requires mocking file system)

**Uncovered Branches:**
- Line 37 branch 0: File existence check false path
- Line 43 branch 0: JSON parse error catch block

---

## Patterns of Untested Code

### 1. **Error Handling Paths** (70% of gaps)
- Server errors (5xx responses)
- Authentication errors (401/403)
- Structured JSON error bodies with `{error: {message, details}}`
- Network failures during streaming/downloads
- File system errors (missing files, write failures)

### 2. **Edge Cases in Error Messages** (15% of gaps)
- Empty/undefined error messages
- Missing statusCode/statusMessage properties
- Non-Error objects thrown from JSON parsing

### 3. **Streaming Operations** (10% of gaps)
- File output streaming
- Stdout streaming
- Stream size limit enforcement
- NDJSON parsing errors
- Stream error handlers

### 4. **Optional Parameters** (5% of gaps)
- `throws: false` option in API methods
- Empty message in ResponseError constructor
- Missing error details in API responses

---

## Actionable Recommendations

### High Priority (to reach 96% coverage threshold)

#### 1. **Add http-client.ts error tests** (5-10 lines of test code)
```typescript
// test/http-client-edge-cases.test.mts
describe('ResponseError constructor', () => {
  it('should handle empty message parameter', () => {
    const mockResponse = { statusCode: 500, statusMessage: 'Error' }
    const error = new ResponseError(mockResponse as any)
    expect(error.message).toContain('Request failed')
  })

  it('should handle missing statusCode/statusMessage', () => {
    const mockResponse = {} as any
    const error = new ResponseError(mockResponse)
    expect(error.message).toContain('unknown')
    expect(error.message).toContain('No status message')
  })
})

describe('getResponseJson', () => {
  it('should throw ResponseError for non-OK responses', async () => {
    // Mock response with statusCode 400
    await expect(getResponseJson(mockResponse)).rejects.toThrow(ResponseError)
  })

  it('should handle empty response body', async () => {
    // Mock response with empty string body
    const result = await getResponseJson(mockResponse)
    expect(result).toEqual({})
  })
})
```

#### 2. **Add socket-sdk-class.ts error scenario tests** (20-30 lines)
```typescript
// test/socket-sdk-error-responses.test.mts
describe('SocketSdk - Error Response Handling', () => {
  it('should handle 401 errors without retry', async () => {
    nock(baseUrl).get('/test').reply(401, 'Unauthorized')
    await expect(sdk.getApi('/test')).rejects.toThrow()
  })

  it('should handle 403 errors without retry', async () => {
    nock(baseUrl).get('/test').reply(403, 'Forbidden')
    await expect(sdk.getApi('/test')).rejects.toThrow()
  })

  it('should handle 5xx server errors', async () => {
    nock(baseUrl).get('/test').reply(500, { error: { message: 'Server error' }})
    await expect(sdk.getApi('/test')).rejects.toThrow('server error')
  })

  it('should parse structured error responses', async () => {
    const errorBody = {
      error: {
        message: 'Validation failed',
        details: { field: 'email' }
      }
    }
    nock(baseUrl).post('/test').reply(400, errorBody)
    await expect(sdk.sendApi('/test')).rejects.toThrow('Validation failed')
  })
})
```

#### 3. **Add API method throws=false tests** (10-15 lines)
```typescript
// test/socket-sdk-result-type.test.mts
describe('SocketSdk - Result Type Options', () => {
  it('should return error result when throws=false and request fails', async () => {
    nock(baseUrl).get('/test').reply(404, 'Not found')
    const result = await sdk.getApi('/test', { throws: false })
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should return success result when throws=false', async () => {
    nock(baseUrl).get('/test').reply(200, { data: 'test' })
    const result = await sdk.getApi('/test', { throws: false })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ data: 'test' })
  })
})
```

#### 4. **Add sendApi method tests** (10-15 lines)
```typescript
// Add to existing test/getapi-sendapi-methods.test.mts
describe('sendApi method', () => {
  it('should send POST request with throws=true', async () => {
    nock(baseUrl).post('/test').reply(200, { success: true })
    const result = await sdk.sendApi('/test', { body: { key: 'value' }})
    expect(result).toEqual({ success: true })
  })

  it('should return result object when throws=false', async () => {
    nock(baseUrl).post('/test').reply(200, { success: true })
    const result = await sdk.sendApi('/test', {
      body: { key: 'value' },
      throws: false
    })
    expect(result.success).toBe(true)
  })
})
```

### Medium Priority (to reach 100% function coverage)

#### 5. **Add streaming tests** (30-40 lines)
```typescript
// test/socket-sdk-streaming.test.mts
describe('SocketSdk - Streaming Operations', () => {
  it('should stream full scan to file', async () => {
    const tmpFile = path.join(os.tmpdir(), 'test-scan.json')
    nock(baseUrl).get('/orgs/test/full-scans/123').reply(200, '{...}')

    await sdk.streamOrgFullScan('test', '123', { output: tmpFile })
    expect(existsSync(tmpFile)).toBe(true)
    unlinkSync(tmpFile)
  })

  it('should handle errors in streamOrgFullScan', async () => {
    nock(baseUrl).get('/orgs/test/full-scans/123').reply(404)
    await expect(
      sdk.streamOrgFullScan('test', '123', { output: 'test.json' })
    ).rejects.toThrow(ResponseError)
  })

  it('should stream patches from scan', async () => {
    const ndjson = '{"pkg":"test","version":"1.0.0"}\n{"pkg":"other"}'
    nock(baseUrl).get('/orgs/test/full-scans/123/patches').reply(200, ndjson)

    const stream = await sdk.streamPatchesFromScan('test', '123')
    const reader = stream.getReader()
    const results = []
    let done = false
    while (!done) {
      const { value, done: streamDone } = await reader.read()
      if (value) results.push(value)
      done = streamDone
    }
    expect(results).toHaveLength(2)
  })
})
```

### Low Priority (nice to have, already above thresholds)

#### 6. **Add quota-utils file system error tests**
```typescript
// Requires mocking fs module - complex, low value
// File already at 96.74%, above 93% threshold
```

---

## Test Coverage Gaps Summary

### By Error Type:
1. **HTTP Status Codes:** 401, 403, 5xx responses - 25 uncovered lines
2. **Structured Error Bodies:** JSON with error.message/details - 15 uncovered lines
3. **Streaming Operations:** File/stdout streaming, NDJSON parsing - 35 uncovered lines
4. **API Method Options:** throws=false, empty parameters - 20 uncovered lines
5. **Edge Cases:** Empty responses, missing properties - 17 uncovered lines

### By Priority:
- **P0 (Critical):** 40 lines - Error response handling, retry logic
- **P1 (High):** 35 lines - Streaming operations, sendApi method
- **P2 (Medium):** 20 lines - API method options, error formatting
- **P3 (Low):** 17 lines - Constructor edge cases, file system errors

---

## Estimated Effort to Close Gaps

| Task | Lines to Cover | Test Code | Time | Impact |
|------|---------------|-----------|------|--------|
| HTTP client errors | 16 | 30 lines | 1 hour | +1.5% |
| Socket SDK errors | 40 | 50 lines | 2 hours | +2.5% |
| API method options | 20 | 30 lines | 1 hour | +1.0% |
| sendApi method | 15 | 20 lines | 1 hour | +0.5% |
| Streaming tests | 35 | 60 lines | 2 hours | +1.5% |
| **Total** | **126** | **190** | **7 hours** | **+7%** |

**Result:** Achieves 96%+ statement/line coverage and 100% function coverage

---

## Existing Test Coverage Strengths

### Excellent Coverage Areas:
1. **Promise utilities** (100%) - promise-queue.test.mts, promise-with-resolvers.test.mts
2. **Utility functions** (100%) - All utility modules fully covered
3. **Constants** (100%) - user-agent, constants files
4. **Testing helpers** (100%) - testing.ts utilities
5. **File uploads** (100%) - file-upload.ts completely tested
6. **Query params** (100%) - query-params-normalization.test.mts
7. **JSON parsing** (95%+) - Comprehensive edge case testing

### Well-Tested Features:
- Batch operations (socket-sdk-batch.test.mts - 14 tests)
- Validation logic (socket-sdk-validation.test.mts - 69 tests)
- API methods (socket-sdk-api-methods.coverage.test.mts - 60 tests)
- HTTP client basics (http-client-functions.test.mts - 10 tests)
- Quota calculations (quota-utils.test.mts - 30 tests)

---

## Configuration Review

### Current Thresholds (vitest.config.mts):
```javascript
thresholds: {
  lines: 96,        // Current: 94.08% ❌
  functions: 100,   // Current: 96.74% ❌
  branches: 93,     // Current: 93.99% ✅
  statements: 96,   // Current: 94.08% ❌
}
```

### Recommendations:
1. **Keep thresholds as-is** - They are reasonable and achievable
2. **Focus on error paths** - Most gaps are in error handling
3. **Add streaming tests** - Currently zero coverage for streaming operations
4. **Test API method options** - throws=false option completely untested

---

## Next Steps

1. **Immediate (Week 1):**
   - [ ] Add HTTP client error constructor tests (1 hour)
   - [ ] Add 401/403 error retry tests (1 hour)
   - [ ] Add 5xx server error tests (1 hour)
   - [ ] Add getApi/sendApi with throws=false tests (1 hour)

2. **Short-term (Week 2):**
   - [ ] Add structured error body parsing tests (1 hour)
   - [ ] Add streaming operation tests (2 hours)
   - [ ] Add NDJSON parsing error tests (1 hour)

3. **Maintenance:**
   - [ ] Run coverage on every PR (already configured in CI)
   - [ ] Review coverage reports monthly
   - [ ] Add tests for new features before merging

---

## Conclusion

The Socket SDK has **strong baseline coverage (94%)** with excellent coverage of core functionality. The remaining gaps are primarily in **error handling paths** and **streaming operations**.

With **~7 hours of focused testing effort**, the project can achieve:
- ✅ 96%+ statement/line coverage
- ✅ 100% function coverage
- ✅ 94%+ branch coverage

The test suite demonstrates **good engineering practices** with comprehensive test helpers, organized test structure, and thorough validation testing. Adding the recommended error scenario tests will bring coverage to production-ready levels.

**Key Takeaway:** The gaps are not in core functionality (which is well-tested), but in defensive error handling code paths. This is common and acceptable - the question is whether to invest in testing these rare error scenarios or accept c8 ignore comments for truly defensive code.
