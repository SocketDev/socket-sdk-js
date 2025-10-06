# CLAUDE.md

🚨 **MANDATORY**: Act as principal-level engineer with deep expertise in TypeScript, Node.js, and SDK development.

## 📚 SHARED STANDARDS

**See canonical reference:** `../socket-registry/CLAUDE.md`

For all shared Socket standards (git workflow, testing, code style, imports, sorting, error handling, cross-platform, CI, etc.), refer to socket-registry/CLAUDE.md.

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
- **Build**: `pnpm build`
- **Test**: `pnpm test`
- **Test runner**: `pnpm run test:run` (glob support)
- **Type check**: `pnpm tsc`
- **Lint**: `pnpm check:lint`
- **Check all**: `pnpm check`
- **Coverage**: `pnpm run test:unit:coverage`, `pnpm run coverage:percent`

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
- **Structure**: `test/unit/`, `test/integration/`, `test/fixtures/`, `test/utils/`
- **Utils**: `environment.mts`, `fixtures.mts`, `mock-helpers.mts`, `constants.mts`
- **Naming**: Descriptive names
  - ✅ `socket-sdk-upload-manifest.test.mts`, `describe('SocketSdk - Upload Manifest')`
  - ❌ `test1.test.mts`, `describe('tests')`
- **Best practices**: Clean HTTP mocks (nock), test success + error paths, cross-platform

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
