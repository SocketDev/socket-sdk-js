# Uncovered Lines Quick Reference

This document provides exact line numbers and code snippets for all uncovered code in Socket SDK.

---

## http-client.ts (16 uncovered lines)

### Lines 38-45: ResponseError Constructor
```typescript
// Lines 38-40: Empty message fallback
super(
  /* c8 ignore next - fallback empty message if not provided */
  `Socket API ${message || 'Request failed'} (${statusCode}): ${statusMessage}`,
)

// Lines 42-45: Error initialization
this.name = 'ResponseError'
this.response = response
Error.captureStackTrace(this, ResponseError)
```

**Why uncovered:** All tests pass a message parameter
**Fix:** Add test calling `new ResponseError(response)` without message

### Lines 236-240: Non-OK Response in getResponseJson
```typescript
if (!isResponseOk(response)) {
  throw new ResponseError(
    response,
    method ? `${method} Request failed` : undefined,
  )
}
```

**Why uncovered:** Tests don't call getResponseJson with failed responses
**Fix:** Mock response with statusCode 400-500

### Lines 245-248: Empty Response Handling
```typescript
if (responseBody === '') {
  debugLog('API response: empty response treated as {}')
  stopTimer({ success: true })
  return {}
}
```

**Why uncovered:** Tests don't send empty string responses
**Fix:** Mock API endpoint returning empty body

### Line 285: Outer Catch Block
```typescript
} catch (error) {
  stopTimer({ error: true })
  throw error  // <-- Line 285
}
```

**Why uncovered:** All errors caught in inner try-catch
**Fix:** Difficult to test - this is defensive code

---

## quota-utils.ts (4 uncovered lines)

### Lines 38-39: File Not Found Error
```typescript
if (!existsSync(requirementsPath)) {
  throw new Error(`Requirements file not found at: ${requirementsPath}`)
}
```

**Why uncovered:** File always exists in tests
**Fix:** Mock fs.existsSync to return false

### Lines 44-45: JSON Parse Error
```typescript
} catch (e) {
  throw new Error('Failed to load SDK method requirements', { cause: e })
}
```

**Why uncovered:** File is always valid JSON
**Fix:** Mock fs.readFileSync to return invalid JSON

---

## socket-sdk-class.ts (112 uncovered lines)

### Lines 185-189: Retry with 401/403 Errors
```typescript
const { statusCode } = error.response
// Don't retry authentication/authorization errors - they won't succeed.
if (statusCode === 401 || statusCode === 403) {
  throw error
}
```

**Why uncovered:** No tests trigger 401/403 during retry
**Fix:** Mock API to return 401, then 200 on retry

### Lines 193-194: Retry Return
```typescript
return undefined
```

**Why uncovered:** Part of onRetry callback never invoked
**Fix:** Trigger retry with non-ResponseError

### Lines 373-379: Server Error (5xx) Handling
```typescript
const { statusCode } = error.response
// Throw server errors (5xx) immediately - these are not recoverable client-side.
if (statusCode && statusCode >= 500) {
  throw new Error(`Socket API server error (${statusCode})`, {
    cause: error,
  })
}
```

**Why uncovered:** No tests trigger 5xx errors
**Fix:** Mock API to return 500 status

### Lines 381-404: Structured Error Body Parsing
```typescript
const bodyStr = await getErrorResponseBody(error.response)
let body: string | undefined
try {
  const parsed: {
    error?: { message?: string; details?: unknown } | undefined
  } = JSON.parse(bodyStr)

  if (typeof parsed?.error?.message === 'string') {
    body = parsed.error.message

    if (parsed.error.details) {
      const detailsStr: string =
        typeof parsed.error.details === 'string'
          ? parsed.error.details
          : JSON.stringify(parsed.error.details)
      body = `${body} - Details: ${detailsStr}`
    }
  }
```

**Why uncovered:** No tests send structured error responses
**Fix:** Mock API to return `{error: {message: 'Error', details: {...}}}`

### Lines 413-429: Error Message Formatting
```typescript
let errorMessage =
  error.message ??
  /* c8 ignore next - fallback for missing error message */ UNKNOWN_ERROR

const trimmedBody = body?.trim()
if (trimmedBody && !errorMessage.includes(trimmedBody)) {
  const statusMessage = error.response?.statusMessage
  if (statusMessage && errorMessage.includes(statusMessage)) {
    errorMessage = errorMessage.replace(statusMessage, trimmedBody)
  } else {
    errorMessage = `${errorMessage}: ${trimmedBody}`
  }
}

return {
  cause: body,
  data: undefined,
  error: errorMessage,
```

**Why uncovered:** Error message manipulation not triggered
**Fix:** Test with various error response formats

### Lines 462-463, 466-467, 473: Optional Entitlement Parsing
```typescript
// Line 462-463
if (!entitlements) {
  return undefined
}

// Line 466-467
const validEntitlements = entitlements.filter(
  (ent: unknown): ent is Entitlement => isObjectObject(ent) && 'slug' in ent,
)

// Line 473
return validEntitlements.length > 0 ? validEntitlements : undefined
```

**Why uncovered:** Tests always return valid entitlements
**Fix:** Mock API response with empty/invalid entitlements

### Lines 1076-1111: getApi with throws=false
```typescript
// Lines 1076-1089: Error path
if (!isResponseOk(response)) {
  if (throws) {
    throw new ResponseError(response)
  }
  const errorResult = await this.#handleApiError<never>(
    new ResponseError(response),
  )
  return {
    cause: errorResult.cause,
    data: undefined,
    error: errorResult.error,
    status: errorResult['status'],
    success: false,
  }
}

// Lines 1096-1111: Success path
if (throws) {
  return data as T
}

return {
  cause: undefined,
  data,
  error: undefined,
  status: response.statusCode ?? 200,
  success: true,
}
```

**Why uncovered:** getApi never called with `throws: false`
**Fix:** Add tests with `sdk.getApi('/path', { throws: false })`

### Lines 2020-2057: sendApi Method (COMPLETELY UNTESTED)
```typescript
async sendApi<T>(
  urlPath: string,
  options?: SendOptions | undefined,
): Promise<T | SocketSdkGenericResult<T>> {
  const {
    body,
    method = 'POST',
    throws = true,
  } = { __proto__: null, ...options } as SendOptions

  try {
    const response = await createRequestWithJson(
      method,
      this.#baseUrl,
      urlPath,
      body,
      this.#reqOptions,
    )

    const data = (await getResponseJson(response)) as T

    if (throws) {
      return data
    }

    return {
      cause: undefined,
      data,
      error: undefined,
      status: response.statusCode ?? 200,
      success: true,
    }
  } catch (e) {
    if (throws) {
      throw e
    }
    // ... error handling
  }
}
```

**Why uncovered:** Method never called in tests
**Fix:** Add comprehensive sendApi tests

### Lines 2083-2084: sendApi Error Return
```typescript
}
}  // End of sendApi catch block
```

**Why uncovered:** Part of untested sendApi method
**Fix:** Test sendApi with errors and throws=false

### Lines 2113-2159: streamOrgFullScan (COMPLETELY UNTESTED)
```typescript
// Lines 2113-2115: Error check
if (!isResponseOk(res)) {
  throw new ResponseError(res)
}

// Lines 2117-2133: File streaming
if (typeof output === 'string') {
  const writeStream = createWriteStream(output)
  let bytesWritten = 0

  res.on('data', (chunk: Buffer) => {
    bytesWritten += chunk.length
    if (bytesWritten > MAX_STREAM_SIZE) {
      res.destroy()
      writeStream.destroy()
      throw new Error(`Response exceeds maximum stream size`)
    }
  })

  res.pipe(writeStream)
  writeStream.on('error', error => {
    throw new Error(`Failed to write to file: ${output}`, { cause: error })
  })
}

// Lines 2140-2159: Stdout streaming
else if (output === true) {
  let bytesWritten = 0

  res.on('data', (chunk: Buffer) => {
    bytesWritten += chunk.length
    if (bytesWritten > MAX_STREAM_SIZE) {
      res.destroy()
      throw new Error(`Response exceeds maximum stream size`)
    }
  })

  res.pipe(process.stdout)
  process.stdout.on('error', error => {
    throw new Error('Failed to write to stdout', { cause: error })
  })
}
```

**Why uncovered:** Streaming method never tested
**Fix:** Add streaming tests with file and stdout output

### Lines 2193-2213: streamPatchesFromScan Error Handling
```typescript
// Lines 2193-2194: Response error
if (!isResponseOk(response)) {
  throw new ResponseError(response, 'GET Request failed')
}

// Lines 2210-2213: NDJSON parse error
try {
  const data = JSON.parse(line) as ArtifactPatches
  controller.enqueue(data)
} catch (e) {
  debugLog('streamPatchesFromScan', `Failed to parse line: ${e}`)
}
```

**Why uncovered:** Stream parsing never tested with errors
**Fix:** Mock NDJSON response with malformed lines

### Lines 2425: uploadManifestFiles Error Handling
```typescript
return (await this.#handleApiError<never>(
  e,
)) as unknown as UploadManifestFilesError
```

**Why uncovered:** Upload errors handled in catch block
**Fix:** Trigger upload error scenario

### Lines 2504, 2508: downloadPatchBlob Error Callbacks
```typescript
// Line 2504
res.on('error', err => {
  reject(err)
})

// Line 2508
req.on('error', err => {
  reject(new Error(`Error downloading blob ${hash}: ${err.message}`))
})
```

**Why uncovered:** Download never fails in tests
**Fix:** Mock network error during download

---

## Summary by Category

### Error Handling (85 lines)
- HTTP status code errors (401, 403, 5xx)
- Structured error body parsing
- Error message formatting
- Network/stream errors

### Streaming Operations (40 lines)
- File output streaming
- Stdout streaming
- Size limit enforcement
- NDJSON parsing
- Stream error handlers

### API Method Options (25 lines)
- throws=false parameter handling
- Result object formatting
- Optional parameter defaults

### Edge Cases (12 lines)
- Empty messages
- Missing properties
- File system errors
- Constructor fallbacks

---

## Quick Win Tests (High Impact, Low Effort)

### 1. sendApi Tests (15 lines, 30 min)
```typescript
// Covers 30+ uncovered lines
it('should send POST with throws=true', async () => {
  const result = await sdk.sendApi('/test', { body: { key: 'val' }})
})

it('should return result object with throws=false', async () => {
  const result = await sdk.sendApi('/test', {
    body: { key: 'val' },
    throws: false
  })
  expect(result.success).toBe(true)
})
```

### 2. Error Status Code Tests (20 lines, 30 min)
```typescript
// Covers 20+ uncovered lines
it('should handle 401 without retry', async () => {
  nock(baseUrl).get('/test').reply(401)
  await expect(sdk.getApi('/test')).rejects.toThrow()
})

it('should handle 500 errors', async () => {
  nock(baseUrl).get('/test').reply(500, { error: { message: 'Server error' }})
  await expect(sdk.getApi('/test')).rejects.toThrow('server error')
})
```

### 3. getApi throws=false Tests (10 lines, 20 min)
```typescript
// Covers 15+ uncovered lines
it('should return error result when throws=false', async () => {
  nock(baseUrl).get('/test').reply(404)
  const result = await sdk.getApi('/test', { throws: false })
  expect(result.success).toBe(false)
})
```

### 4. ResponseError Edge Cases (5 lines, 15 min)
```typescript
// Covers 8+ uncovered lines
it('should handle empty message in ResponseError', () => {
  const error = new ResponseError({ statusCode: 500 } as any)
  expect(error.message).toContain('Request failed')
})
```

**Total: 50 lines of test code, 95 minutes → +5% coverage**

---

## Files by Priority

### P0: Must Fix (fails thresholds)
1. **socket-sdk-class.ts** - 112 lines, 92.09% coverage
2. **http-client.ts** - 16 lines, 90.58% coverage

### P1: Should Fix (close to threshold)
3. **quota-utils.ts** - 4 lines, 96.74% coverage

### P2: Already Passing
- All other files at 100% coverage ✅

---

## Test File Recommendations

### New Test Files Needed:
1. `test/socket-sdk-error-responses.test.mts` - Error handling scenarios
2. `test/socket-sdk-result-type.test.mts` - throws=false tests
3. `test/socket-sdk-streaming.test.mts` - Streaming operations
4. `test/http-client-edge-cases.test.mts` - Constructor/edge cases

### Existing Files to Extend:
1. `test/getapi-sendapi-methods.test.mts` - Add sendApi tests
2. `test/http-client-error-paths.test.mts` - Add more error scenarios
3. `test/socket-sdk-validation.test.mts` - Add entitlement validation
4. `test/quota-utils-error-handling.test.mts` - Add file system errors

---

## Coverage Goals

### Current: 94.08% statements
### Target: 96% statements
### Gap: 1.92 percentage points

**Lines to cover:** ~132 uncovered statements
**Test code needed:** ~200 lines
**Estimated time:** 7 hours
**Files to create:** 4 new test files
**Files to extend:** 4 existing test files

**Achievable in 1-2 days of focused work.**
