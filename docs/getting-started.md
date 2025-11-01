# Getting Started with Socket SDK Development

Welcome to the Socket SDK for JavaScript! This guide will help you set up your development environment and start contributing to the SDK.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/SocketDev/socket-sdk-js.git
cd socket-sdk-js

# Install dependencies
pnpm install

# Build the SDK
pnpm run build

# Run tests
pnpm test

# Run checks (lint + type check)
pnpm run check
```

You're ready to develop!

## Prerequisites

### Required

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 18.0.0+ (20, 22, 24 recommended) | Runtime environment |
| **pnpm** | 10.16.0+ | Package manager |
| **Socket API Key** | - | Integration testing ([Get yours](https://socket.dev/dashboard)) |

### Recommended

| Tool | Version | Purpose |
|------|---------|---------|
| **Git** | 2.0+ | Version control |
| **VSCode** | Latest | IDE with extension support |

### Installation

```bash
# Install pnpm
npm install -g pnpm

# Or via Homebrew (macOS)
brew install pnpm

# Verify installation
pnpm --version
```

## Repository Structure

```
socket-sdk-js/
├── docs/                   # Documentation
│   ├── api-reference.md    # Complete API reference
│   ├── usage-examples.md   # Usage examples
│   ├── quota-management.md # Quota costs and utilities
│   ├── when-to-use-what.md # Method selection guide
│   └── dev/                # Developer documentation
│       ├── testing.md      # Testing guide & utilities
│       ├── ci-testing.md   # CI/CD testing setup
│       └── scripts.md      # Script organization
├── src/                    # TypeScript source code
│   ├── socket-sdk-class.ts # Main SDK class (40+ methods)
│   ├── http-client.ts      # HTTP request/response handling
│   ├── types.ts            # Type definitions
│   └── utils.ts            # Utilities
├── test/                   # Test files (24 test files)
│   └── utils/              # Test helpers
├── types/                  # Generated TypeScript types
│   └── api.d.ts            # Auto-generated from OpenAPI (543KB)
├── dist/                   # Compiled output
├── scripts/                # Build and dev scripts
├── .config/                # Configuration files
├── CLAUDE.md               # SDK-specific guidelines
├── README.md               # SDK documentation
└── package.json            # Dependencies and scripts
```

## Development Workflow

### 1. Initial Setup

```bash
# Clone and install
git clone https://github.com/SocketDev/socket-sdk-js.git
cd socket-sdk-js
pnpm install
```

### 2. Set Up Environment

Create `.env.local` for testing:
```bash
# Get your API key from https://socket.dev/dashboard
SOCKET_API_KEY=your_api_key_here
```

**Important:** Never commit `.env.local` (it's gitignored).

### 3. Build the SDK

```bash
# Full build
pnpm run build

# Watch mode (68% faster incremental builds: 9ms vs 27ms)
pnpm run build --watch
```

**Build output:**
- `dist/index.mjs` - Main ESM bundle
- `dist/testing.mjs` - Testing utilities
- `dist/*.d.ts` - TypeScript declarations

### 4. Run Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm run cover

# Run specific test
pnpm test socket-sdk-api-methods.coverage.test.mts
```

**Coverage requirement:** ≥99% (strictly enforced)

### 5. Verify Changes

```bash
# Run all checks (lint + type check)
pnpm run check

# Auto-fix issues
pnpm run fix

# Type check only
pnpm run type
```

## Command Reference

Quick reference for common development commands:

| Command | Purpose | Notes |
|---------|---------|-------|
| `pnpm install` | Install dependencies | Run after cloning or `package.json` changes |
| `pnpm run build` | Build SDK | Outputs to `dist/` |
| `pnpm run build --watch` | Watch mode | 68% faster incremental builds (9ms vs 27ms) |
| `pnpm test` | Run all tests | Must maintain ≥99% coverage |
| `pnpm run test:run <file>` | Run specific test | Supports glob patterns |
| `pnpm run cover` | Test with coverage | Shows detailed coverage report |
| `pnpm run coverage:percent` | Coverage percentage | Quick coverage check |
| `pnpm run check` | Lint + type check | Run before commits |
| `pnpm run fix` | Auto-fix lint issues | Uses Biome formatter |
| `pnpm run type` | Type check only | Uses TypeScript compiler |
| `pnpm run generate-sdk` | Update API types | Fetches latest OpenAPI spec |
| `pnpm run check-ci` | CI lint checks | Full CI validation |
| `pnpm run test-ci` | CI test run | All test files |

## Common Development Tasks

### Adding a New API Method

**1. Update types** (auto-generated from OpenAPI):
```bash
pnpm run generate-sdk
```

This updates `types/api.d.ts` with latest API specs.

**2. Add method to `src/socket-sdk-class.ts`:**

```typescript
/**
 * Get package security score.
 *
 * @throws {PurlError} When package URL is invalid
 */
async getScoreByNpmPackage(
  package_: string,
  version: string
): Promise<Result<ScoreResponse>> {
  const path = `/v0/npm/${package_}/${version}/score`
  return this.#getRequest<ScoreResponse>(path)
}
```

**3. Export from `src/index.ts`** (if new type):
```typescript
export type { ScoreResponse } from './types.js'
```

**4. Write tests** in `test/`:
```typescript
import { describe, it, expect } from 'vitest'
import { setupTestClient } from './utils/environment.mts'

describe('getScoreByNpmPackage', () => {
  const client = setupTestClient()

  it('should return package score', async () => {
    const result = await client.getScoreByNpmPackage('express', '4.18.0')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.score).toBeGreaterThanOrEqual(0)
      expect(result.data.score).toBeLessThanOrEqual(100)
    }
  })
})
```

**5. Run tests and coverage:**
```bash
pnpm test
pnpm run cover  # Must maintain ≥99%
```

### Updating API Types

Types are generated from OpenAPI specification:

```bash
# Regenerate types from latest OpenAPI spec
pnpm run generate-sdk
```

**What it does:**
1. Fetches latest OpenAPI spec
2. Generates `types/api.d.ts` (543KB)
3. Creates helper types in `types/api-helpers.d.ts`

**Manual edits to generated types are NOT preserved.**

### Writing Tests

**Use test helpers** from `test/utils/`:

```typescript
import { setupTestClient, createTestClient } from './utils/environment.mts'
import { mockSuccessResponse } from './utils/mock-helpers.mts'
import { expectString, expectNumber } from './utils/assertions.mts'

describe('My Feature', () => {
  // Reuses client across tests (faster)
  const client = setupTestClient()

  it('should work', async () => {
    const result = await client.someMethod()
    expect(result.success).toBe(true)
  })
})
```

**HTTP mocking with nock:**
```typescript
import nock from 'nock'

nock('https://api.socket.dev')
  .get('/v0/npm/express/4.18.0/score')
  .reply(200, { score: 95 })
```

See [dev/testing.md](./dev/testing.md) for complete guide.

### Running CI Checks Locally

```bash
# Run full CI checks
pnpm run check-ci  # Lint + type check (all files)
pnpm run test-ci   # Tests (all files)
```

**CI matrix:**
- Node versions: 20, 22, 24
- OS: Ubuntu, Windows

## Testing Guide

### Test Structure

```
test/
├── socket-sdk-api-methods.coverage.test.mts   # All API methods coverage
├── socket-sdk-batch.test.mts                  # Batch operations
├── socket-sdk-error-handling.test.mts         # Error scenarios
├── socket-sdk-retry.test.mts                  # Retry logic
├── http-client-*.test.mts                     # HTTP client tests
├── quota-utils.test.mts                       # Quota utilities
└── utils/                                     # Test helpers
    ├── environment.mts       # Test client setup
    ├── mock-helpers.mts      # HTTP mocking
    ├── assertions.mts        # Custom assertions
    └── fixtures.mts          # Test data
```

### Test Patterns

**Basic test:**
```typescript
it('should handle success response', async () => {
  const client = setupTestClient()
  const result = await client.getQuota()

  expect(result.success).toBe(true)
  if (result.success) {
    expectNumber(result.data.quota)
  }
})
```

**Error handling test:**
```typescript
it('should handle API error', async () => {
  nock('https://api.socket.dev')
    .get('/v0/quota')
    .reply(401, { error: 'Unauthorized' })

  const result = await client.getQuota()
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.message).toContain('Unauthorized')
  }
})
```

**Isolated tests** (some tests run in separate processes):
```typescript
// Defined in .config/isolated-tests.json
// Used for tests that modify global state
```

## Code Style

**SDK uses semicolons** (differs from socket-registry):
```typescript
const client = new SocketSdk('api-key');  // ✓ With semicolon
const result = await client.getQuota();   // ✓ With semicolon
```

**Other style rules:**
- `@fileoverview` headers on all files (MANDATORY)
- Type imports: `import type { Foo } from './types.js'`
- Node.js imports: `import path from 'node:path'` (with `node:` prefix)
- Alphabetical sorting (imports, exports, properties)
- No `any` type (use `unknown`)

**Logger calls:**
```typescript
logger.error('');  // Always include empty string parameter
```

See [CLAUDE.md](../CLAUDE.md) for complete standards.

## Project Standards

**Read CLAUDE.md** - Essential reading! Contains:
- SDK-specific code style
- Testing patterns
- Error handling
- Documentation requirements
- Git workflow

**Key highlights:**

**Commit messages:**
```
feat(api): add getScoreByNpmPackage method

- Implement package score retrieval
- Add comprehensive tests
- Update API reference documentation
```

**Pre-commit hooks:**
- Linting (auto-fix where possible)
- Type checking
- Tests (if needed)

## Troubleshooting

### Build Issues

**Problem:** Build fails with esbuild error

**Solution:**
```bash
pnpm run clean
rm -rf node_modules/.cache
pnpm run build
```

### Test Issues

**Problem:** Tests fail with "SOCKET_API_KEY not set"

**Solution:**
```bash
# Create .env.local with your API key
echo "SOCKET_API_KEY=your_key_here" > .env.local
pnpm test
```

**Problem:** HTTP mocking issues with nock

**Solution:**
```typescript
// Ensure nock scope is consumed
nock.cleanAll()  // Clear after tests
```

**Problem:** Memory issues during tests

**Solution:** Tests use threads pool for speed, forks for isolation. Check `.config/isolated-tests.json` for isolated tests.

### Type Generation Issues

**Problem:** Types out of sync with API

**Solution:**
```bash
pnpm run generate-sdk
pnpm run build
pnpm test
```

**Problem:** Type errors after OpenAPI update

**Solution:** Update method signatures to match new types in `types/api.d.ts`.

### Coverage Issues

**Problem:** Coverage below 99%

**Solution:**
```bash
pnpm run cover  # See uncovered lines
# Add tests for uncovered code
pnpm test
```

## Documentation

### Updating Documentation

**API Reference** (`docs/api-reference.md`):
- Update when adding/changing methods
- Include method signature, parameters, return type
- Add usage examples
- Document errors thrown

**Usage Examples** (`docs/usage-examples.md`):
- Real-world scenarios
- Copy-paste ready code
- Common use cases

**Quota Management** (`docs/quota-management.md`):
- Update quota costs (0/10/100 units)
- Document cost calculations
- Update quota utilities

### Testing Documentation

**Testing Guide** (`docs/dev/testing.md`):
- Documents testing utilities from `@socketsecurity/sdk/testing`
- Mock factories and fixtures
- Type guards for responses

## Advanced Topics

### Custom HTTP Client

Override HTTP behavior:
```typescript
const client = new SocketSdk('api-key', {
  baseUrl: 'https://api.custom.com',  // Custom endpoint
  timeout: 60000,                     // 60s timeout
  retries: 5,                         // Retry 5 times
  retryDelay: 2000,                   // Start with 2s delay
  cache: { ttl: 300000 }              // Cache for 5min
})
```

### Batch Operations

Efficient bulk analysis:
```typescript
const packages = Array.from({ length: 100 }, (_, i) => ({
  purl: `pkg:npm/package-${i}@1.0.0`
}))

for await (const batch of client.batchPackageStream({ components: packages })) {
  console.log(`Processed ${batch.data.length} packages`)
}
```

### Quota Management

Check costs before operations:
```typescript
import { getQuotaCost, hasQuotaForMethods } from '@socketsecurity/sdk'

// Check method cost
const cost = getQuotaCost('batchPackageFetch')  // 100 units

// Check if you have quota
const quota = await client.getQuota()
if (hasQuotaForMethods(quota.data.quota, ['batchPackageFetch'], { count: 5 })) {
  // Proceed with operations
}
```

See [quota-management.md](./quota-management.md) for details.

## Next Steps

1. **Read the documentation:**
   - [api-reference.md](./api-reference.md) - All API methods
   - [usage-examples.md](./usage-examples.md) - Real-world examples
   - [quota-management.md](./quota-management.md) - Cost management
   - [dev/testing.md](./dev/testing.md) - Testing utilities
   - [CLAUDE.md](../CLAUDE.md) - Project standards

2. **Explore the codebase:**
   - `src/socket-sdk-class.ts` - Main SDK implementation
   - `src/http-client.ts` - HTTP layer
   - `test/` - Comprehensive test suite

3. **Pick a task:**
   - Browse open issues on GitHub
   - Add a new API method
   - Improve documentation
   - Add test coverage
   - Fix a bug

4. **Join the community:**
   - Follow [@SocketSecurity](https://twitter.com/SocketSecurity) on Twitter
   - Follow [@socket.dev](https://bsky.app/profile/socket.dev) on Bluesky

## Quick Reference

### Essential Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm run build` | Build SDK |
| `pnpm run build --watch` | Watch mode (fast!) |
| `pnpm test` | Run tests |
| `pnpm run cover` | Test coverage (≥99%) |
| `pnpm run check` | Lint + type check |
| `pnpm run fix` | Auto-fix issues |
| `pnpm run generate-sdk` | Update API types |
| `pnpm run clean` | Clean build artifacts |

### Key Files

| What | Where |
|------|-------|
| Main SDK class | `src/socket-sdk-class.ts` |
| HTTP client | `src/http-client.ts` |
| Type definitions | `src/types.ts`, `types/api.d.ts` |
| Tests | `test/*.test.mts` |
| Test helpers | `test/utils/` |
| API docs | `docs/api-reference.md` |
| Examples | `docs/usage-examples.md` |
| Standards | `CLAUDE.md` |

### Help Resources

- **Main README**: [../README.md](../README.md)
- **API Reference**: [api-reference.md](./api-reference.md)
- **Usage Examples**: [usage-examples.md](./usage-examples.md)
- **Quota Management**: [quota-management.md](./quota-management.md)
- **Testing Guide**: [dev/testing.md](./dev/testing.md)
- **Project Standards**: [../CLAUDE.md](../CLAUDE.md)
- **Official API Docs**: https://docs.socket.dev/reference

---

**Welcome to the Socket SDK!** We're excited to have you contributing to better software supply chain security.
