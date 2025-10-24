# Socket SDK JS - Bug Scan Report
**Generated:** 2025-10-04
**Project:** socket-sdk-js
**Location:** socket-sdk-js

## Executive Summary

This report identifies **12 bugs and potential issues** found in the socket-sdk-js codebase, ranging from critical to low severity. The scan focused on code quality, error handling, resource management, security, performance, and cross-platform compatibility.

**Critical Issues:** 2
**High Priority:** 4
**Medium Priority:** 4
**Low Priority:** 2

---

## Critical Issues

### 1. Silent Exception Swallowing in Stream Parsing
**File:** `src/socket-sdk-class.ts`
**Line:** 1830
**Severity:** CRITICAL

**Issue:**
```typescript
} catch (e) {}
```

Empty catch block silently swallows JSON parsing errors during NDJSON streaming. This makes debugging extremely difficult and can lead to silent data loss.

**Impact:**
- Silent data loss during batch package streaming
- Impossible to diagnose parsing failures
- Corrupted data may be processed without detection

**Suggested Fix:**
```typescript
} catch (e) {
  // Log parse error but continue processing next line
  debugLog('NDJSON parse error:', e)
  // Or enqueue error result:
  controller.enqueue({
    cause: e instanceof Error ? e.message : String(e),
    data: undefined,
    error: 'Failed to parse NDJSON line',
    status: 0,
    success: false,
  } as ArtifactPatches)
}
```

---

### 2. Unsafe File Path Resolution in quota-utils
**File:** `src/quota-utils.ts`
**Line:** 29
**Severity:** CRITICAL

**Issue:**
```typescript
const requirementsPath = join(process.cwd(), 'requirements.json')
const data = readFileSync(requirementsPath, 'utf8')
```

**Problems:**
1. Assumes `requirements.json` is always in current working directory
2. Will fail if SDK is called from a different directory
3. No fallback or alternative resolution strategy
4. Synchronous file I/O blocks event loop

**Impact:**
- Runtime errors when SDK is used as library in other projects
- Blocking I/O affects performance in async contexts
- Path traversal vulnerability if cwd is manipulated

**Suggested Fix:**
```typescript
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const requirementsPath = path.join(__dirname, '..', 'requirements.json')
```

Or use async version:
```typescript
import { readFile } from 'node:fs/promises'

async function loadRequirements(): Promise<Requirements> {
  if (requirements) {
    return requirements
  }

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const requirementsPath = path.join(__dirname, '..', 'requirements.json')
    const data = await readFile(requirementsPath, 'utf8')
    requirements = JSON.parse(data) as Requirements
    return requirements
  } catch (e) {
    throw new Error('Failed to load "requirements.json"', { cause: e })
  }
}
```

---

## High Priority Issues

### 3. Missing Error Handling in streamOrgFullScan Pipe Operations
**File:** `src/socket-sdk-class.ts`
**Lines:** 1778-1783
**Severity:** HIGH

**Issue:**
```typescript
if (typeof output === 'string') {
  // Stream to file
  res.pipe(createWriteStream(output))
} else if (output === true) {
  // Stream to stdout
  res.pipe(process.stdout)
}
```

**Problems:**
- No error handling for write stream creation failures (permissions, disk full)
- No error handling for pipe failures
- No cleanup on error
- Resource leak if write stream fails

**Impact:**
- Unhandled exceptions crash application
- File descriptors leak on errors
- Partial file writes without notification

**Suggested Fix:**
```typescript
if (typeof output === 'string') {
  const writeStream = createWriteStream(output)
  writeStream.on('error', (error) => {
    throw new Error(`Failed to write to file: ${output}`, { cause: error })
  })
  res.pipe(writeStream)
} else if (output === true) {
  process.stdout.on('error', (error) => {
    // Handle broken pipe (EPIPE) gracefully
    if (error.code !== 'EPIPE') {
      throw error
    }
  })
  res.pipe(process.stdout)
}
```

---

### 4. Race Condition in batchPackageStream Generator Cleanup
**File:** `src/socket-sdk-class.ts`
**Lines:** 507-511
**Severity:** HIGH

**Issue:**
```typescript
running.splice(
  running.findIndex(entry => entry.generator === generator),
  1,
)
```

**Problems:**
- `findIndex` returns -1 if not found, causing splice(-1, 1) to remove last element
- Race condition: generator may complete and be removed by another iteration
- Covered by c8 ignore comment but still represents a bug

**Impact:**
- Wrong generator removed from array
- Memory leak as generators aren't properly cleaned up
- Potential infinite loop or stalled processing

**Suggested Fix:**
```typescript
const index = running.findIndex(entry => entry.generator === generator)
if (index !== -1) {
  running.splice(index, 1)
} else {
  // Log unexpected condition
  debugLog('Generator not found in running array - possible race condition')
}
```

---

### 5. Missing Response Validation in createBatchPurlGenerator
**File:** `src/socket-sdk-class.ts`
**Lines:** 147-151
**Severity:** HIGH

**Issue:**
```typescript
const rli = readline.createInterface({
  input: res!,
  crlfDelay: Number.POSITIVE_INFINITY,
  signal: abortSignal,
})
```

**Problems:**
- Non-null assertion (`res!`) assumes `res` is always defined
- If retry logic fails in a way that returns undefined, this will throw
- No explicit check for response.ok status before streaming

**Impact:**
- Potential null pointer exception
- Streaming invalid responses
- Cryptic error messages

**Suggested Fix:**
```typescript
if (!res) {
  throw new Error('Failed to get response after retries')
}

const rli = readline.createInterface({
  input: res,
  crlfDelay: Number.POSITIVE_INFINITY,
  signal: abortSignal,
})
```

---

### 6. Incomplete Error Context in withRetry Function
**File:** `src/http-client.ts`
**Lines:** 326-362
**Severity:** HIGH

**Issue:**
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  retryDelay = 1000,
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= retries; attempt++) {
    // ... retry logic
  }

  throw lastError || new Error('Request failed after retries')
}
```

**Problems:**
- Lost context: doesn't track how many retries were attempted
- No information about which attempt failed
- Error doesn't include URL or request details

**Impact:**
- Difficult to debug intermittent network issues
- No visibility into retry behavior
- Hard to distinguish transient vs permanent failures

**Suggested Fix:**
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  retryDelay = 1000,
  context?: string,
): Promise<T> {
  let lastError: Error | undefined
  const errors: Error[] = []

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      errors.push(lastError)

      if (attempt === retries) {
        break
      }

      if (error instanceof ResponseError) {
        const status = error.response.statusCode
        if (status && status >= 400 && status < 500) {
          throw error
        }
      }

      const delayMs = retryDelay * 2 ** attempt
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  const errorMessage = `Request failed after ${retries + 1} attempts${context ? ` (${context})` : ''}`
  const aggregateError = new Error(errorMessage, { cause: lastError })
  ;(aggregateError as any).errors = errors
  throw aggregateError
}
```

---

## Medium Priority Issues

### 7. Type Coercion in Optional Chaining May Hide Bugs
**File:** `src/quota-utils.ts`
**Lines:** 152-154
**Severity:** MEDIUM

**Issue:**
```typescript
Object.keys(summary).forEach(costKey => {
  summary[costKey]?.sort()
})
```

**Problems:**
- Optional chaining hides potential bugs where array doesn't exist
- No validation that value is actually an array
- Silent failure if structure is corrupted

**Impact:**
- Corrupted data structures not detected
- Hard to debug issues with data consistency

**Suggested Fix:**
```typescript
Object.keys(summary).forEach(costKey => {
  const methods = summary[costKey]
  if (!Array.isArray(methods)) {
    throw new Error(`Expected array for cost key "${costKey}", got ${typeof methods}`)
  }
  methods.sort()
})
```

---

### 8. Potential Memory Leak in batchPackageStream
**File:** `src/socket-sdk-class.ts`
**Lines:** 453-458
**Severity:** MEDIUM

**Issue:**
```typescript
if (oldAbortSignalMaxListeners < neededMaxListeners) {
  abortSignalMaxListeners = oldAbortSignalMaxListeners + neededMaxListeners
  events.setMaxListeners(abortSignalMaxListeners, abortSignal)
}
```

**Problems:**
- Increases max listeners but calculation may be wrong
- If function is called multiple times, listeners accumulate
- Reset at end covered by c8 ignore, suggesting it may not execute

**Impact:**
- Memory leak from accumulated event listeners
- Performance degradation
- Node.js warnings about listener count

**Suggested Fix:**
```typescript
// Track if we modified the limit
let didModifyMaxListeners = false
if (oldAbortSignalMaxListeners < neededMaxListeners) {
  abortSignalMaxListeners = neededMaxListeners // Use absolute value, not additive
  events.setMaxListeners(abortSignalMaxListeners, abortSignal)
  didModifyMaxListeners = true
}

// Later in finally block:
if (didModifyMaxListeners) {
  events.setMaxListeners(oldAbortSignalMaxListeners, abortSignal)
}
```

---

### 9. Unsafe Array Spread in createUploadRequest
**File:** `src/file-upload.ts`
**Lines:** 89-96
**Severity:** MEDIUM

**Issue:**
```typescript
const requestBody = [
  ...requestBodyNoBoundaries.flatMap(part => [
    boundarySep,
    ...(Array.isArray(part) ? part : [part]),
  ]),
  finalBoundary,
]
```

**Problems:**
- Large file uploads could cause memory issues with spread operator
- No limit on array size
- Could exhaust heap with many large files

**Impact:**
- Out of memory errors with large uploads
- Performance degradation

**Suggested Fix:**
Process parts iteratively without creating intermediate array:
```typescript
// Instead of creating requestBody array, process parts on-the-fly
// in the for loop without pre-allocation
```

---

### 10. Missing Timeout Handling in getResponse Promise
**File:** `src/http-client.ts`
**Lines:** 148-173
**Severity:** MEDIUM

**Issue:**
```typescript
export async function getResponse(
  req: ClientRequest,
): Promise<IncomingMessage> {
  return await new Promise((resolve, reject) => {
    let timedOut = false
    req.on('response', (response: IncomingMessage) => {
      if (timedOut) {
        return
      }
      resolve(response)
    })
    req.on('timeout', () => {
      timedOut = true
      req.destroy()
      reject(new Error('Request timed out'))
    })
    req.on('error', e => {
      if (!timedOut) {
        reject(e)
      }
    })
  })
}
```

**Problems:**
- Response after timeout is silently ignored but stream may still be open
- Should explicitly close response stream if it arrives after timeout
- No cleanup of response listeners

**Impact:**
- Resource leak if response arrives after timeout
- Memory leak from unclosed streams

**Suggested Fix:**
```typescript
req.on('response', (response: IncomingMessage) => {
  if (timedOut) {
    response.destroy() // Clean up late response
    return
  }
  resolve(response)
})
```

---

## Low Priority Issues

### 11. Inefficient String Concatenation in Error Response
**File:** `src/http-client.ts`
**Lines:** 125-127
**Severity:** LOW

**Issue:**
```typescript
response.on('data', (chunk: string) => (body += chunk))
```

**Problems:**
- String concatenation in loop is inefficient
- Should use array and join, or buffer
- Performance issue with large responses

**Impact:**
- Slow performance with large error responses
- Higher memory usage

**Suggested Fix:**
```typescript
export async function getErrorResponseBody(
  response: IncomingMessage,
): Promise<string> {
  const chunks: string[] = []
  return await new Promise((resolve, reject) => {
    response.setEncoding('utf8')
    response.on('data', (chunk: string) => chunks.push(chunk))
    response.on('end', () => resolve(chunks.join('')))
    response.on('error', e => reject(e))
  })
}
```

---

### 12. Inconsistent Error Message Format
**File:** `src/http-client.ts`
**Lines:** 36-37
**Severity:** LOW

**Issue:**
```typescript
`Socket API ${message || 'Request failed'} (${statusCode}): ${statusMessage}`,
```

**Problems:**
- Inconsistent format: sometimes includes method, sometimes doesn't
- Fallback message doesn't provide useful context
- StatusCode and statusMessage may both be 'unknown' leading to confusing output

**Impact:**
- Poor debugging experience
- Inconsistent error messages across SDK

**Suggested Fix:**
```typescript
constructor(response: IncomingMessage, message?: string) {
  const statusCode = response.statusCode ?? 0
  const statusMessage = response.statusMessage ?? 'Unknown error'
  const errorMsg = message ?? 'Request failed'

  super(`Socket API error: ${errorMsg} [${statusCode} ${statusMessage}]`)
  this.name = 'ResponseError'
  this.response = response
  Error.captureStackTrace(this, ResponseError)
}
```

---

## Code Quality Observations

### Positive Patterns Found:
1. ✅ Excellent use of TypeScript for type safety
2. ✅ Good JSDoc documentation
3. ✅ Proper use of async/await patterns
4. ✅ Comprehensive error handling in most areas
5. ✅ Good use of dependency injection for testing
6. ✅ Proper stream backpressure handling in file uploads

### Areas for Improvement:
1. ⚠️ Some defensive c8 ignore comments hide potential bugs
2. ⚠️ Inconsistent error handling between similar functions
3. ⚠️ Missing error context in some retry/async operations
4. ⚠️ Some resource cleanup not guaranteed in error paths
5. ⚠️ File path resolution assumes specific directory structure

---

## Cross-Platform Compatibility

**Status:** Generally good, but one issue found:

The path handling in `quota-utils.ts` assumes a specific directory structure that may not work when the package is installed as a dependency in other projects.

---

## Security Considerations

1. **Path Traversal Risk** (Medium): The `process.cwd()` usage in quota-utils could be exploited if an attacker controls the working directory
2. **Resource Exhaustion** (Low): No limits on batch processing size could lead to memory exhaustion
3. **Information Disclosure** (Low): Error messages may expose internal paths

---

## Performance Considerations

1. **Synchronous I/O** (High): `readFileSync` in quota-utils blocks event loop
2. **String Concatenation** (Low): Inefficient error body accumulation
3. **Memory Usage** (Medium): Large array spreads in file upload could exhaust heap

---

## Recommendations

### Immediate Actions (Critical/High):
1. Fix empty catch block in streamPatchesFromScan (Issue #1)
2. Fix file path resolution in quota-utils (Issue #2)
3. Add error handling to stream pipe operations (Issue #3)
4. Fix race condition in batchPackageStream (Issue #4)

### Short-term Improvements (Medium):
5. Add validation in quota-utils array operations (Issue #7)
6. Fix event listener accumulation (Issue #8)
7. Improve memory efficiency in file uploads (Issue #9)
8. Add response cleanup after timeout (Issue #10)

### Long-term Enhancements (Low):
9. Optimize error response reading (Issue #11)
10. Standardize error message formats (Issue #12)

### General Improvements:
- Add more integration tests for error paths
- Add resource leak detection in tests
- Consider adding timeout limits to all async operations
- Add metrics/telemetry for retry behavior
- Document error handling patterns

---

## Testing Recommendations

1. Add tests for quota-utils when used from different directories
2. Add tests for stream error conditions (disk full, permissions)
3. Add tests for race conditions in concurrent batch processing
4. Add tests for timeout scenarios
5. Add tests for large file uploads (memory limits)
6. Add chaos testing for network failures during streaming

---

## Conclusion

The socket-sdk-js codebase is generally well-written with good TypeScript practices and comprehensive error handling. However, the critical issues around file path resolution and silent error swallowing should be addressed immediately. The high-priority issues around stream error handling and race conditions should be fixed in the next release.

Most issues are in edge cases or error paths, but fixing them will significantly improve reliability and debuggability of the SDK.
