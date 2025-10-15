# Socket Test Style Guide

Comprehensive testing patterns and best practices across all Socket projects (socket-sdk-js, socket-packageurl-js, socket-registry).

## Table of Contents

- [Universal Patterns](#universal-patterns)
- [Test Helpers by Project](#test-helpers-by-project)
- [Naming Conventions](#naming-conventions)
- [Assertion Best Practices](#assertion-best-practices)
- [Mock Setup Patterns](#mock-setup-patterns)
- [Coverage Requirements](#coverage-requirements)
- [Project-Specific Examples](#project-specific-examples)

---

## Universal Patterns

### File Organization

**All Projects:**
- Test files in `test/` directory
- Test utilities in `test/utils/`
- Use `.test.mts` extension for TypeScript test files
- Descriptive file names matching feature/module tested

**Examples:**
```
socket-sdk-js/test/socket-sdk-api-methods.coverage.test.mts
socket-packageurl-js/test/purl-edge-cases.test.mts
socket-registry/test/npm/assert.test.mts
```

### Test Structure

**Standard describe/it pattern:**
```typescript
describe('Feature Name', () => {
  // Setup
  beforeEach(() => {
    // Per-test setup
  })

  afterEach(() => {
    // Per-test cleanup
  })

  describe('specific behavior', () => {
    it('should do something specific', () => {
      // Arrange
      const input = setupInput()

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toBe(expected)
    })
  })
})
```

### Running Tests

**All Projects:**
- Run all tests: `pnpm test`
- Run specific file: `pnpm test path/to/file.test.mts`
- **CRITICAL**: Never use `--` before test paths (runs ALL tests)
- Coverage: `pnpm run cover` or `pnpm run coverage`

---

## Test Helpers by Project

### socket-sdk-js Helpers

**Location:** `test/utils/environment.mts`

#### setupTestClient() - RECOMMENDED

Combines nock setup and client creation in one call.

```typescript
import { setupTestClient } from './utils/environment.mts'

describe('API Methods', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  it('should make API call', async () => {
    nock('https://api.socket.dev')
      .get('/v0/endpoint')
      .reply(200, { success: true })

    const client = getClient()
    const result = await client.someMethod()
    expect(result).toBeDefined()
  })
})
```

#### setupTestEnvironment()

Just nock setup (for custom client creation).

```typescript
import { setupTestEnvironment, createTestClient } from './utils/environment.mts'

describe('Custom Client Tests', () => {
  setupTestEnvironment()

  it('should work with custom client', async () => {
    const client = createTestClient('custom-token', {
      baseUrl: 'https://custom.api.socket.dev'
    })
    // ... test code
  })
})
```

#### createTestClient()

Just client creation (no nock setup).

```typescript
const client = createTestClient('test-token', {
  retries: 0,
  timeout: 5000
})
```

#### isCoverageMode

Flag for detecting coverage mode.

```typescript
import { isCoverageMode } from './utils/environment.mts'

if (isCoverageMode) {
  // Skip or adjust tests that don't work well in coverage mode
}
```

**When to use what:**
- **setupTestClient()**: 90% of tests - standard pattern
- **setupTestEnvironment()**: Need custom client creation
- **createTestClient()**: Unit tests without HTTP mocking
- **isCoverageMode**: Conditional test behavior in coverage mode

---

### socket-packageurl-js Helpers

**Location:** `test/utils/test-helpers.mts`

#### createTestPurl()

Factory for creating PackageURL instances cleanly.

```typescript
import { createTestPurl } from './utils/test-helpers.mts'

// Before:
new PackageURL('npm', undefined, 'lodash', '4.17.21', undefined, undefined)

// After:
createTestPurl('npm', 'lodash', { version: '4.17.21' })

// With all options:
createTestPurl('npm', 'lodash', {
  version: '4.17.21',
  namespace: '@scope',
  qualifiers: { arch: 'x64', os: 'linux' },
  subpath: 'dist/index.js'
})
```

**Benefits:**
- No need for `undefined` parameters
- Clear intent with named options
- Type-safe optional parameters

#### createTestFunction()

Creates test functions with optional return values.

```typescript
import { createTestFunction } from './utils/test-helpers.mts'

const testFn = createTestFunction('result')
expect(testFn()).toBe('result')

const voidFn = createTestFunction()
expect(voidFn()).toBeUndefined()
```

---

### socket-registry Helpers

**Location:** `test/utils/`

#### setupNpmPackageTest()

Standardizes NPM package testing setup.

**Location:** `npm-package-helper.mts`

```typescript
import { setupNpmPackageTest } from '../utils/npm-package-helper.mts'

// Replaces ~15-20 lines of boilerplate
const { module: assert, pkgPath, skip, eco, sockRegPkgName } =
  await setupNpmPackageTest(__filename)

describe(`${eco} > ${sockRegPkgName}`, { skip }, () => {
  it('should have correct exports', () => {
    expect(assert).toBeDefined()
    expect(assert.strictEqual).toBeTypeOf('function')
  })
})
```

**What it does:**
- Extracts package name from filename
- Checks if package testing should be skipped
- Installs package for testing
- Returns module, path, and metadata

#### Temp File Helpers

**Location:** `temp-file-helper.mts`

**withTempDir()** - Temp directory with cleanup:

```typescript
import { withTempDir } from '../utils/temp-file-helper.mts'

it('should work with temp directory', async () => {
  const { path: tmpDir, cleanup } = await withTempDir('test-prefix-')
  try {
    // Use tmpDir...
    writeFileSync(path.join(tmpDir, 'test.txt'), 'content')
  } finally {
    await cleanup()
  }
})
```

**runWithTempDir()** - Automatic cleanup with callback:

```typescript
import { runWithTempDir } from '../utils/temp-file-helper.mts'

it('should work with temp directory', async () => {
  await runWithTempDir(async (tmpDir) => {
    // Use tmpDir... cleanup happens automatically
    writeFileSync(path.join(tmpDir, 'test.txt'), 'content')
  }, 'test-prefix-')
})
```

**withTempFile()** - Temp file with content:

```typescript
import { withTempFile } from '../utils/temp-file-helper.mts'

const { path: tmpFile, cleanup } = await withTempFile('test content', {
  extension: '.json',
  prefix: 'config-'
})
try {
  const content = readFileSync(tmpFile, 'utf8')
  expect(content).toBe('test content')
} finally {
  await cleanup()
}
```

**withTempFiles()** - Multiple temp files:

```typescript
import { withTempFiles } from '../utils/temp-file-helper.mts'

const { dir, files, cleanup } = await withTempFiles([
  { name: 'config.json', content: '{"key": "value"}' },
  { name: 'data.txt', content: 'test data' }
])
try {
  console.log(files['config.json']) // Full path
  console.log(files['data.txt'])    // Full path
} finally {
  await cleanup()
}
```

#### Platform Test Helpers

**Location:** `platform-test-helpers.mts`

**Platform detection:**

```typescript
import { platform } from '../utils/platform-test-helpers.mts'

if (platform.isWindows) {
  // Windows-specific logic
}

if (platform.isUnix) {
  // Unix-specific logic
}

if (platform.isMac) {
  // macOS-specific logic
}
```

**Conditional test execution:**

```typescript
import { itOnWindows, itOnUnix, describeOnWindows } from '../utils/platform-test-helpers.mts'

describe('cross-platform tests', () => {
  // Runs on all platforms
  it('should normalize paths', () => {
    expect(normalizePath('test')).toBeTruthy()
  })

  // Windows only
  itOnWindows('should handle backslashes', () => {
    expect(path.sep).toBe('\\')
  })

  // Unix only
  itOnUnix('should handle forward slashes', () => {
    expect(path.sep).toBe('/')
  })

  // Entire suite Windows-only
  describeOnWindows('Windows path handling', () => {
    it('should handle drive letters', () => {
      expect(isAbsolute('C:\\Windows')).toBe(true)
    })
  })
})
```

**Path comparison:**

```typescript
import { normalizePath, expectNormalizedPath } from '../utils/platform-test-helpers.mts'

// Normalize paths for comparison
const normalized = normalizePath('C:\\Users\\test')
expect(normalized).toBe('/c/Users/test')

// Assert path equality cross-platform
expectNormalizedPath('C:\\Users\\test', '/c/Users/test')
```

#### Assertion Helpers

**Location:** `assertion-helpers.mts`

**Type assertions:**

```typescript
import {
  expectString,
  expectNumber,
  expectBoolean,
  expectFunction
} from '../utils/assertion-helpers.mts'

// Before:
expect(typeof config.apiKey).toBe('string')
expect(typeof config.timeout).toBe('number')

// After:
expectString(config.apiKey)
expectNumber(config.timeout)
```

**Object state assertions:**

```typescript
import { expectFrozen, expectSealed } from '../utils/assertion-helpers.mts'

// Before:
expect(Object.isFrozen(constants)).toBe(true)

// After:
expectFrozen(constants)
expectSealed(config)
```

**Property assertions:**

```typescript
import { expectHasProperty, expectHasProperties } from '../utils/assertion-helpers.mts'

// Before:
expect(config).toHaveProperty('apiKey')
expect(config).toHaveProperty('baseUrl')
expect(config).toHaveProperty('timeout')

// After:
expectHasProperties(config, ['apiKey', 'baseUrl', 'timeout'])
```

**Additional assertions:**

```typescript
import {
  expectDefined,
  expectTruthy,
  expectFalsy,
  expectArrayLength,
  expectInstanceOf,
  expectMatches,
  expectDeepEqual,
  expectInRange
} from '../utils/assertion-helpers.mts'

expectDefined(value)
expectTruthy(result)
expectFalsy(error)
expectArrayLength(items, 3)
expectInstanceOf(error, Error)
expectMatches(text, /pattern/)
expectDeepEqual(obj1, obj2)
expectInRange(value, 0, 100)
```

---

## Naming Conventions

### Test File Names

**Good:**
- `socket-sdk-api-methods.coverage.test.mts` - Clear what's being tested
- `purl-edge-cases.test.mts` - Specific test purpose
- `assert.test.mts` - Package name being tested

**Bad:**
- `test1.test.mts` - Non-descriptive
- `tests.test.mts` - Too generic
- `temp.test.mts` - Unclear purpose

### describe() Blocks

**Good:**
```typescript
describe('SocketSdk - Upload Manifest', () => {})
describe('PackageURL - Namespace Handling', () => {})
describe('NPM > assert', () => {})
```

**Bad:**
```typescript
describe('tests', () => {})
describe('it works', () => {})
describe('test1', () => {})
```

### it() Blocks

**Good - Specific and actionable:**
```typescript
it('should return IncomingMessage when throws=true (default)', async () => {})
it('should handle Windows paths with drive letters', () => {})
it('should throw PurlError for invalid namespace', () => {})
```

**Bad - Vague or unclear:**
```typescript
it('works', () => {})
it('test1', () => {})
it('should be ok', () => {})
```

---

## Assertion Best Practices

### Prefer Specific Assertions

**Good:**
```typescript
expect(result).toBe(42)              // Exact value
expect(result).toBeTypeOf('string')  // Type check
expect(result).toHaveLength(3)       // Array/string length
expect(result).toContain('value')    // Array/string contains
expect(result).toMatchObject({ id: 1 }) // Partial object match
```

**Avoid:**
```typescript
expect(result).toBeTruthy()          // Too vague
expect(result).toBeDefined()         // Minimal assertion
```

### Test Both Success and Error Paths

**Always test:**
1. Success case with valid input
2. Error case with invalid input
3. Edge cases (empty, null, undefined, boundary values)

```typescript
describe('parseConfig', () => {
  it('should parse valid config', () => {
    const result = parseConfig({ apiKey: 'test' })
    expect(result).toBeDefined()
    expect(result.apiKey).toBe('test')
  })

  it('should throw on missing apiKey', () => {
    expect(() => parseConfig({})).toThrow('apiKey is required')
  })

  it('should handle empty config object', () => {
    expect(() => parseConfig({})).toThrow()
  })

  it('should handle null config', () => {
    expect(() => parseConfig(null)).toThrow()
  })
})
```

### Use Helper Assertions When Available

**socket-registry projects:**
```typescript
// Before:
expect(typeof result).toBe('string')
expect(Object.isFrozen(config)).toBe(true)
expect(config).toHaveProperty('apiKey')
expect(config).toHaveProperty('baseUrl')

// After:
expectString(result)
expectFrozen(config)
expectHasProperties(config, ['apiKey', 'baseUrl'])
```

---

## Mock Setup Patterns

### socket-sdk-js: HTTP Mocking with nock

**Pattern 1: Simple mock**
```typescript
import nock from 'nock'

it('should fetch data', async () => {
  nock('https://api.socket.dev')
    .get('/v0/endpoint')
    .reply(200, { success: true })

  const result = await client.getData()
  expect(result.success).toBe(true)
})
```

**Pattern 2: Complex mock with headers**
```typescript
it('should include custom headers', async () => {
  let capturedHeaders: IncomingHttpHeaders = {}

  nock('https://api.socket.dev')
    .post('/v0/endpoint', { data: 'test' })
    .reply(function () {
      capturedHeaders = this.req.headers
      return [200, { received: true }]
    })

  await client.sendData({ data: 'test' })
  expect(capturedHeaders['content-type']).toBe('application/json')
})
```

**Pattern 3: Error responses**
```typescript
it('should handle 404 errors', async () => {
  nock('https://api.socket.dev')
    .get('/v0/nonexistent')
    .reply(404, 'Not found')

  await expect(client.getData()).rejects.toThrow(/404/)
})
```

**Automatic cleanup:**
- setupTestClient() automatically cleans up nock mocks
- No manual nock.cleanAll() needed
- Coverage mode handles special cleanup cases

### socket-packageurl-js: No Mocking Needed

Pure parsing/validation tests don't require mocking:

```typescript
it('should parse npm package URL', () => {
  const purl = createTestPurl('npm', 'lodash', { version: '4.17.21' })
  expect(purl.toString()).toBe('pkg:npm/lodash@4.17.21')
})

it('should throw on invalid namespace', () => {
  expect(() => createTestPurl('npm', 'name', {
    namespace: 'invalid space'
  })).toThrow(PurlError)
})
```

### socket-registry: Process and File System Mocking

**Use temp helpers instead of mocking:**
```typescript
it('should create cache directory', async () => {
  await runWithTempDir(async (tmpDir) => {
    const cacheDir = path.join(tmpDir, 'cache')
    mkdirSync(cacheDir)
    expect(existsSync(cacheDir)).toBe(true)
    // Automatic cleanup
  })
})
```

**For NPM package tests:**
```typescript
const { module: assert, pkgPath, skip } = await setupNpmPackageTest(__filename)

describe('NPM > assert', { skip }, () => {
  it('should export strictEqual', () => {
    expectFunction(assert.strictEqual)
  })
})
```

---

## Coverage Requirements

### socket-sdk-js

**Target:** High coverage (not 100% required)
**Focus:** API methods, error paths, edge cases

```typescript
// Test success and error paths
it('should return data when request succeeds', async () => {
  nock('https://api.socket.dev').get('/v0/data').reply(200, { ok: true })
  const result = await client.getData()
  expect(result.ok).toBe(true)
})

it('should throw when request fails', async () => {
  nock('https://api.socket.dev').get('/v0/data').reply(500, 'Error')
  await expect(client.getData()).rejects.toThrow()
})
```

### socket-packageurl-js

**Target:** 100% coverage (MANDATORY)
**Focus:** All code paths, spec compliance, edge cases

```typescript
// Test all branches
describe('namespace validation', () => {
  it('should accept valid namespace', () => {
    const purl = createTestPurl('npm', 'name', { namespace: '@scope' })
    expect(purl.namespace).toBe('@scope')
  })

  it('should reject namespace with spaces', () => {
    expect(() => createTestPurl('npm', 'name', {
      namespace: 'invalid space'
    })).toThrow(PurlError)
  })

  it('should handle null namespace', () => {
    const purl = createTestPurl('npm', 'name', { namespace: null })
    expect(purl.namespace).toBeNull()
  })
})
```

### socket-registry

**Target:** High coverage, never decrease
**Focus:** Core functionality, cross-platform paths, NPM packages

**Coverage comments when needed:**
```typescript
/* c8 ignore next 3 - Coverage comment explaining why. */
if (process.platform === 'win32') {
  // Windows-specific code
}
```

---

## Project-Specific Examples

### socket-sdk-js Example: API Method Test

```typescript
import { setupTestClient } from './utils/environment.mts'
import nock from 'nock'
import { describe, expect, it } from 'vitest'

describe('SocketSdk - Get Organization', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  it('should return organization when throws=true (default)', async () => {
    const orgData = { id: '123', name: 'Test Org' }

    nock('https://api.socket.dev')
      .get('/v0/organizations/test-org')
      .reply(200, orgData)

    const result = await getClient().getOrganization('test-org')
    expect(result).toEqual(orgData)
  })

  it('should return CResult when throws=false', async () => {
    const orgData = { id: '123', name: 'Test Org' }

    nock('https://api.socket.dev')
      .get('/v0/organizations/test-org')
      .reply(200, orgData)

    const result = await getClient().getOrganization('test-org', {
      throws: false
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(orgData)
    }
  })

  it('should throw on 404 when throws=true', async () => {
    nock('https://api.socket.dev')
      .get('/v0/organizations/nonexistent')
      .reply(404, 'Not found')

    await expect(
      getClient().getOrganization('nonexistent')
    ).rejects.toThrow(/404/)
  })

  it('should return error CResult when throws=false on 404', async () => {
    nock('https://api.socket.dev')
      .get('/v0/organizations/nonexistent')
      .reply(404, 'Not found')

    const result = await getClient().getOrganization('nonexistent', {
      throws: false
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(404)
      expect(result.error).toContain('Socket API')
    }
  })
})
```

### socket-packageurl-js Example: Parser Test

```typescript
import { describe, expect, it } from 'vitest'
import { createTestPurl } from './utils/test-helpers.mts'
import { PurlError } from '../src/error.js'

describe('PackageURL - NPM Type', () => {
  it('should parse npm package with version', () => {
    const purl = createTestPurl('npm', 'lodash', { version: '4.17.21' })
    expect(purl.type).toBe('npm')
    expect(purl.name).toBe('lodash')
    expect(purl.version).toBe('4.17.21')
    expect(purl.toString()).toBe('pkg:npm/lodash@4.17.21')
  })

  it('should parse scoped npm package', () => {
    const purl = createTestPurl('npm', 'cli', {
      namespace: '@angular',
      version: '15.0.0'
    })
    expect(purl.namespace).toBe('@angular')
    expect(purl.toString()).toBe('pkg:npm/%40angular/cli@15.0.0')
  })

  it('should reject npm name with whitespace', () => {
    expect(() => createTestPurl('npm', 'invalid name')).toThrow(PurlError)
  })

  it('should handle qualifiers', () => {
    const purl = createTestPurl('npm', 'package', {
      qualifiers: { arch: 'x64', os: 'linux' }
    })
    expect(purl.qualifiers).toEqual({ arch: 'x64', os: 'linux' })
  })

  it('should handle subpath', () => {
    const purl = createTestPurl('npm', 'package', {
      subpath: 'dist/index.js'
    })
    expect(purl.subpath).toBe('dist/index.js')
  })
})
```

### socket-registry Example: NPM Package Test

```typescript
import { describe, expect, it } from 'vitest'
import { setupNpmPackageTest } from '../utils/npm-package-helper.mts'
import { expectFunction, expectString } from '../utils/assertion-helpers.mts'

const { module: assert, pkgPath, skip, eco, sockRegPkgName } =
  await setupNpmPackageTest(__filename)

describe(`${eco} > ${sockRegPkgName}`, { skip }, () => {
  it('should have correct package structure', () => {
    expectString(pkgPath)
    expect(assert).toBeDefined()
  })

  it('should export strictEqual function', () => {
    expectFunction(assert.strictEqual)
  })

  it('should export deepEqual function', () => {
    expectFunction(assert.deepEqual)
  })

  it('strictEqual should work correctly', () => {
    assert.strictEqual(1, 1)
    expect(() => assert.strictEqual(1, 2)).toThrow()
  })

  it('deepEqual should work correctly', () => {
    assert.deepEqual({ a: 1 }, { a: 1 })
    expect(() => assert.deepEqual({ a: 1 }, { a: 2 })).toThrow()
  })
})
```

### socket-registry Example: Cross-Platform Path Test

```typescript
import { describe, expect, it } from 'vitest'
import { itOnWindows, itOnUnix, expectNormalizedPath } from '../utils/platform-test-helpers.mts'
import { runWithTempDir } from '../utils/temp-file-helper.mts'
import path from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'

describe('Path handling', () => {
  it('should normalize paths cross-platform', () => {
    expectNormalizedPath('C:\\Users\\test', '/c/Users/test')
    expectNormalizedPath('/usr/local/bin', '/usr/local/bin')
  })

  itOnWindows('should handle Windows drive letters', () => {
    expect(path.isAbsolute('C:\\Windows')).toBe(true)
    expect(path.sep).toBe('\\')
  })

  itOnUnix('should handle Unix absolute paths', () => {
    expect(path.isAbsolute('/usr/local')).toBe(true)
    expect(path.sep).toBe('/')
  })

  it('should work with temp directories', async () => {
    await runWithTempDir(async (tmpDir) => {
      const testFile = path.join(tmpDir, 'test.txt')
      writeFileSync(testFile, 'content')
      const content = readFileSync(testFile, 'utf8')
      expect(content).toBe('content')
    }, 'path-test-')
  })
})
```

---

## Quick Reference: Which Helper to Use

### For HTTP/API Testing (socket-sdk-js)
- `setupTestClient()` - Standard pattern, use for 90% of tests
- `setupTestEnvironment()` - Custom client configuration needed
- `createTestClient()` - Unit tests without HTTP calls

### For Parser/Validation Testing (socket-packageurl-js)
- `createTestPurl()` - Always use instead of `new PackageURL(...)`
- `createTestFunction()` - Test function creation

### For File System Testing (socket-registry)
- `runWithTempDir()` - Preferred, automatic cleanup
- `withTempDir()` - Manual cleanup control
- `withTempFile()` - Single temp file
- `withTempFiles()` - Multiple temp files

### For Platform Testing (socket-registry)
- `itOnWindows()` - Windows-only test
- `itOnUnix()` - Unix-only test
- `expectNormalizedPath()` - Cross-platform path comparison
- `platform` object - Platform detection

### For NPM Package Testing (socket-registry)
- `setupNpmPackageTest()` - Always use for NPM package tests

### For Assertions (socket-registry)
- `expectString/Number/Boolean/Function()` - Type checks
- `expectFrozen/Sealed()` - Object state
- `expectHasProperties()` - Multiple property checks
- `expectDefined/Truthy/Falsy()` - Value checks

---

## Summary

**Key Principles:**
1. Use project-specific helpers to reduce boilerplate
2. Test both success and error paths
3. Use descriptive names for files, describes, and its
4. Clean up resources (HTTP mocks, temp files)
5. Follow project-specific coverage requirements
6. Prefer specific assertions over generic ones
7. Cross-platform awareness for path handling

**Helper Usage:**
- socket-sdk-js: Focus on `setupTestClient()` for HTTP mocking
- socket-packageurl-js: Focus on `createTestPurl()` for clean test data
- socket-registry: Use all helpers extensively for comprehensive testing

**Documentation:**
- socket-sdk-js: `CLAUDE.md` Testing section
- socket-packageurl-js: `CLAUDE.md` Testing section
- socket-registry: `CLAUDE.md` Testing section + `test/utils/TEST_HELPERS_README.md`
