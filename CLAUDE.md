# CLAUDE.md

🚨 **MANDATORY**: Act as principal-level engineer with deep expertise in TypeScript, Node.js, and SDK development.

## 📚 SHARED STANDARDS

**See canonical reference:** `../socket-registry/CLAUDE.md`

For all shared Socket standards (git workflow, testing, code style, imports, sorting, error handling, cross-platform, CI, etc.), refer to socket-registry/CLAUDE.md.

**Git Workflow Reminder**: When user says "commit changes" → create actual commits, use small atomic commits, follow all CLAUDE.md rules (NO AI attribution).

---

## 📝 EMOJI & OUTPUT STYLE

**Terminal Symbols** (based on `@socketsecurity/lib/logger` LOG_SYMBOLS):
- ✓ Success/checkmark - MUST be green (NOT ✅)
- ✗ Error/failure - MUST be red (NOT ❌)
- ⚠ Warning/caution - MUST be yellow (NOT ⚠️)
- ℹ Info - MUST be blue (NOT ℹ️)

**Color Requirements**:
```javascript
colors.green(`✓ ${msg}`)   // Success
colors.red(`✗ ${msg}`)     // Error
colors.yellow(`⚠ ${msg}`)  // Warning
colors.blue(`ℹ ${msg}`)    // Info
```

**Allowed Emojis** (use sparingly):
- 📦 Packages
- 💡 Ideas/tips
- 🚀 Launch/deploy/excitement
- 🎉 Major success/celebration

**General Philosophy**:
- Prefer colored text-based symbols (✓✗⚠ℹ) for maximum terminal compatibility
- Always color-code symbols: green=success, red=error, yellow=warning, blue=info
- Use emojis sparingly for emphasis and delight
- Avoid emoji overload - less is more
- When in doubt, use plain text

---

## 🏗️ SDK-SPECIFIC

### Architecture
Socket SDK for JavaScript/TypeScript - Programmatic access to Socket.dev security analysis

**Core Structure**:
- **Entry**: `src/index.ts`
- **SDK Class**: `src/socket-sdk-class.ts` - All API methods
- **HTTP Client**: `src/http-client.ts` - Request/response handling
- **Types**: `src/types.ts` - TypeScript definitions
- **Utils**: `src/utils.ts` - Shared utilities
- **Constants**: `src/constants.ts`

**Features**: Full TypeScript support, API client, package analysis, security scanning, org/repo management, SBOM support, batch operations, file uploads

### Commands
- **Build**: `pnpm build` (production build)
- **Watch**: `pnpm build --watch` (dev mode with 68% faster incremental builds)
- **Test**: `pnpm test`
- **Test runner**: `pnpm run test:run` (glob support)
- **Type check**: `pnpm tsc`
- **Lint**: `pnpm check:lint`
- **Check all**: `pnpm check`
- **Coverage**: `pnpm run test:unit:coverage`, `pnpm run coverage:percent`

**Development tip:** Use `pnpm build --watch` for 68% faster rebuilds (9ms vs 27ms). See `docs/INCREMENTAL_BUILDS.md` for details.

### SDK-Specific Patterns

#### Logger Standardization
All `logger.error()` and `logger.log()` calls include empty string:
- ✅ `logger.error('')`, `logger.log('')`
- ❌ `logger.error()`, `logger.log()`

#### File Structure
- **Extensions**: `.mts` for TypeScript modules
- **Module headers**: 🚨 MANDATORY `@fileoverview` headers
- **"use strict"**: ❌ FORBIDDEN in .mjs/.mts (ES modules are strict)

#### TypeScript Patterns
- **Semicolons**: Use semicolons (unlike other Socket projects)
- **Type safety**: ❌ FORBIDDEN `any`; use `unknown` or specific
- **Type imports**: Always `import type`

#### API Method Organization
Documentation organized alphabetically within functional categories

#### Comprehensive Sorting (MANDATORY)
- **Type properties**: Required first, then optional; alphabetical within groups
- **Class members**: 1) Private properties, 2) Private methods, 3) Public methods (all alphabetical)
- **Object properties**: Alphabetical in literals (except semantic ordering)
- **Destructuring**: Alphabetical (`const { apiKey, baseUrl, timeout }`)

### Testing

#### Test Structure
- **Directories**: `test/` - Test files, `test/utils/` - Shared utilities
- **Naming**: Descriptive names
  - ✅ `socket-sdk-upload-manifest.test.mts`, `describe('SocketSdk - Upload Manifest')`
  - ❌ `test1.test.mts`, `describe('tests')`
- **Consolidated files**: `socket-sdk-api-methods.coverage.test.mts` - Comprehensive API method tests

#### Test Helpers (`test/utils/environment.mts`)

**setupTestClient(token?, options?)** - Combined nock setup + client creation (RECOMMENDED)
```typescript
import { setupTestClient } from './utils/environment.mts'

describe('My tests', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  it('should work', async () => {
    const client = getClient()
    // ... test code
  })
})
```

**setupTestEnvironment()** - Just nock setup (for custom client creation)
```typescript
import { setupTestEnvironment, createTestClient } from './utils/environment.mts'

describe('My tests', () => {
  setupTestEnvironment()

  it('should work', async () => {
    const client = createTestClient('custom-token')
    // ... test code
  })
})
```

**createTestClient(token?, options?)** - Just client creation (no nock setup)
```typescript
const client = createTestClient('test-token', { retries: 0 })
```

**isCoverageMode** - Flag for coverage detection
```typescript
if (isCoverageMode) {
  // Skip tests that don't work well in coverage mode
}
```

#### Running Tests
- **All tests**: `pnpm test`
- **Specific file**: `pnpm run test:run <file>` (glob support)
- **Coverage**: `pnpm run cover` or `pnpm run test:unit:coverage`
- **Coverage percentage**: `pnpm run coverage:percent`

#### Best Practices
- **Use setupTestClient()**: Combines nock setup and client creation in one call
- **Use getClient() pattern**: Access client instance returned by setupTestClient()
- **Mock HTTP with nock**: All HTTP requests must be mocked
- **Auto cleanup**: Nock mocks cleaned automatically in beforeEach/afterEach
- **Test both paths**: Success + error paths for all methods
- **Cross-platform**: Test path handling on Windows and Unix
- **Follow patterns**: See `test/getapi-sendapi-methods.test.mts` for examples

### CI Testing
- **🚨 MANDATORY**: `SocketDev/socket-registry/.github/workflows/ci.yml@<SHA>` with full SHA
- **Format**: `@662bbcab1b7533e24ba8e3446cffd8a7e5f7617e # main`
- **Custom runner**: `scripts/test.mjs` with glob expansion
- **Memory**: Auto heap size (CI: 8GB, local: 4GB)
- **Docs**: `docs/CI_TESTING.md`, `socket-registry/docs/CI_TESTING_TOOLS.md`

### Changelog Management
**🚨 MANDATORY**: When creating changelog entries for version bumps:
- **Check OpenAPI updates**: Analyze `types/api.d.ts` changes
  ```bash
  git diff v{prev}..HEAD -- types/
  ```
- **Document user-facing changes**:
  - New endpoints (e.g., `/openapi.json`)
  - Updated parameter descriptions/behavior
  - New type categories/enum values (e.g., 'dual' threat type)
  - Breaking changes to API contracts
- **Focus**: User impact only, not internal infrastructure
- **Rationale**: OpenAPI changes directly impact SDK users

### Debugging
- **CI vs Local**: CI uses published npm packages, not local
- **Package detection**: Use `existsSync()` not `fs.access()`
- **Test failures**: Check unused nock mocks, ensure cleanup

### SDK Notes
- Windows compatibility important - test path handling
- Use utilities from @socketsecurity/registry where available
- Maintain consistency with surrounding code
