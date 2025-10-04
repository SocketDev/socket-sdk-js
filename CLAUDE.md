# CLAUDE.md

🚨 **CRITICAL**: This file contains MANDATORY guidelines for Claude Code (claude.ai/code). You MUST follow these guidelines EXACTLY as specified. Act as a principal-level software engineer with deep expertise in TypeScript, Node.js, and SDK development.

## 📚 SHARED STANDARDS

**This project follows Socket's unified development standards.** For comprehensive guidelines on:
- Code style (imports, sorting, __proto__ patterns, comments)
- Git workflow (GitHub Actions, CI, commit messages)
- Error handling standards and message patterns
- Cross-platform compatibility
- Testing best practices (Vitest memory optimization)
- Dependency alignment
- Changelog management

**See the canonical reference:** `socket-registry/CLAUDE.md` (in sibling repository)

This file contains **Socket SDK-specific** rules and patterns. When in doubt, consult socket-registry/CLAUDE.md first.

## 🎯 YOUR ROLE

You are a **Principal Software Engineer** responsible for production-quality code, architectural decisions, and system reliability.

## 🔍 PRE-ACTION PROTOCOL

- **🚨 MANDATORY**: Before ANY action, review both this file AND socket-registry/CLAUDE.md
- Check before you act - ensure approach follows established patterns
- No exceptions for code changes, commits, documentation, testing, file operations

## 🛡️ ABSOLUTE RULES

- 🚨 **NEVER** create files unless absolutely necessary
- 🚨 **ALWAYS** prefer editing existing files
- 🚨 **FORBIDDEN** to proactively create documentation files unless explicitly requested
- 🚨 **REQUIRED** to do exactly what was asked - nothing more, nothing less

## 🏗️ PROJECT ARCHITECTURE

### Socket SDK for JavaScript/TypeScript
Programmatic access to Socket.dev's security analysis capabilities.

### Core Structure
- **Main entry**: `src/index.ts` - SDK entry point
- **SDK Class**: `src/socket-sdk-class.ts` - Main SDK class with all API methods
- **HTTP Client**: `src/http-client.ts` - HTTP request/response handling
- **Types**: `src/types.ts` - TypeScript type definitions
- **Utils**: `src/utils.ts` - Shared utilities
- **Constants**: `src/constants.ts` - Application constants

### Key Features
- Full TypeScript support with comprehensive type definitions
- API client for Socket.dev platform
- Package analysis and security scanning
- Organization and repository management
- SBOM support
- High-performance data processing
- Batch operations for package analysis
- File upload capabilities with multipart form data

## ⚡ COMMANDS

### Development Commands
- **Build**: `pnpm build`
- **Test**: `pnpm test`
- **Test runner**: `pnpm run test:run` (custom test runner with glob support)
- **Type check**: `pnpm tsc`
- **Lint**: `pnpm check:lint`
- **Check all**: `pnpm check`
- **Coverage**: `pnpm run test:unit:coverage`
- **Coverage percentage**: `pnpm run coverage:percent`

### Testing Best Practices
- **🚨 NEVER USE `--` BEFORE TEST FILE PATHS** - Runs ALL tests!
- **Always build before testing**: Ensure dist files are up to date
- **Test single file**: ✅ CORRECT: `pnpm test path/to/file.test.ts`
  - ❌ WRONG: `pnpm test -- path/to/file.test.ts`
- **Update snapshots**: `pnpm test -u`

### Test Naming Standards (Critical for Coverage)
- **File names**: Use descriptive, specific names
  - ✅ CORRECT: `socket-sdk-upload-manifest.test.mts`, `http-client-functions.test.mts`
  - ❌ WRONG: `test1.test.mts`, `misc.test.mts`
- **Describe blocks**: Use clear, contextual descriptions
  - ✅ CORRECT: `describe('SocketSdk - Upload Manifest Files', ...)`
  - ❌ WRONG: `describe('tests', ...)`
- **Test descriptions**: Write meaningful descriptions
  - ✅ CORRECT: `it('should handle API errors during upload', ...)`
  - ❌ WRONG: `it('works', ...)`

### CI Testing Infrastructure
- **🚨 MANDATORY**: Use `SocketDev/socket-registry/.github/workflows/ci.yml@<SHA>` with full commit SHA (not @main)
- **🚨 CRITICAL**: GitHub Actions require full-length commit SHAs. Format: `@662bbcab1b7533e24ba8e3446cffd8a7e5f7617e # main`
- **Reusable workflows**: Socket-registry provides centralized, reusable workflows for lint/type-check/test/coverage
- **Matrix testing**: Test across Node.js versions (20, 22, 24) and platforms
- **Custom test runner**: `scripts/test.mjs` provides glob expansion
- **Memory configuration**: Automatic heap size adjustment for CI (8GB) vs local (4GB)
- **Documentation**: See `docs/CI_TESTING.md` and `socket-registry/docs/CI_TESTING_TOOLS.md`

## 🔒 SECURITY & SAFETY

### File Operations (SECURITY CRITICAL)
- **Script usage only**: Use `trash` package ONLY in scripts/build files - NOT in `/src/`
- **Source code deletion**: In `/src/`, use `fs.rm()` with proper error handling
- **Script deletion**: Use `await trash(paths)` for scripts and utilities
- **NO rmSync**: 🚨 ABSOLUTELY FORBIDDEN - NEVER use `fs.rmSync()` or `rm -rf`

## 🎨 SDK-SPECIFIC CODE PATTERNS

### Logger Standardization
- **Consistent logger calls**: All `logger.error()` and `logger.log()` calls should include empty string parameters
  - ✅ CORRECT: `logger.error('')`, `logger.log('')`
  - ❌ WRONG: `logger.error()`, `logger.log()`

### File Structure
- **File extensions**: `.mts` for TypeScript module files
- **Naming**: kebab-case for filenames
- **Module headers**: 🚨 MANDATORY - All modules MUST have `@fileoverview` headers
- **"use strict"**: 🚨 FORBIDDEN in .mjs/.mts files - ES modules are automatically strict

### API Method Organization
- **Documentation**: API method documentation should be organized alphabetically within functional categories for better discoverability

### TypeScript Patterns
- **Semicolons**: Use semicolons (unlike other Socket projects that omit them)
- **Type safety**: 🚨 FORBIDDEN - Avoid `any` type; prefer `unknown` or specific types
- **Type imports**: Always use `import type` for better tree-shaking
- **Null-prototype objects**:
  - ✅ CORRECT: `{ __proto__: null, key: 'value' }` (object literal with properties)
  - ✅ CORRECT: `{ __proto__: null, ...options }` (spread pattern)
  - ✅ CORRECT: `const obj = Object.create(null)` (empty object, populate separately)
  - ❌ WRONG: `const obj = { __proto__: null }` (empty object literal - use `Object.create(null)` instead)
  - **Rationale**: Use `Object.create(null)` only for empty null-prototype objects; object literals with `__proto__: null` are fine when they have properties

### Comprehensive Sorting Standards (MANDATORY)
All code elements MUST be sorted:

#### Type Property Sorting
- Required properties first, then optional properties
- Within each group: Sort alphabetically/alphanumerically

#### Class Member Sorting
1. Private properties (alphabetically)
2. Private methods (alphabetically)
3. Public methods (alphabetically)

#### Object Property Sorting
- Sort object properties alphabetically in literals
- Exception: Preserve order when semantically meaningful

#### Destructuring Property Sorting
- ✅ CORRECT: `const { apiKey, baseUrl, timeout } = config`
- ❌ WRONG: `const { timeout, apiKey, baseUrl } = config`

## 🧪 TESTING STANDARDS

### Test Organization
- **Modular structure**: Split large test files by functionality
- **Descriptive naming**: Use clear test file names
- **Test directory structure**: 🚨 MANDATORY
  ```
  test/
  ├── unit/                   # Unit tests
  ├── integration/           # Integration tests
  ├── fixtures/              # Test fixtures
  └── utils/                 # Test utilities
      ├── environment.mts    # Test environment setup
      ├── fixtures.mts       # Test data configurations
      ├── mock-helpers.mts   # Mock setup utilities
      └── constants.mts      # Test constants
  ```

### Test Utilities Organization
- **Modular utilities**: Split utilities by purpose into focused modules
- ✅ CORRECT: `import { setupTestEnvironment } from './utils/environment.mts'`
- ❌ OLD PATTERN: `import { setupTestEnvironment } from './test-utils.mts'`

### Test Best Practices
- **Proper mocking**: Clean up HTTP mocks (nock) properly
- **Error scenarios**: Test both success and error paths
- **Edge cases**: Include tests for Unicode, empty responses, malformed data
- **Cross-platform**: Ensure tests work on Windows and POSIX

## 🔧 GIT WORKFLOW

### Commit Messages
- **🚨 ABSOLUTELY FORBIDDEN**: NEVER add Claude Code attribution to commit messages
  - ❌ WRONG: Adding "🤖 Generated with [Claude Code]..." or "Co-Authored-By: Claude"
  - ✅ CORRECT: Write commit messages without any AI attribution or signatures
  - **Rationale**: This is a professional project and commit messages should not contain AI tool attributions

### Pre-Commit Quality Checks
- **🚨 MANDATORY**: Always run these commands before committing:
  - `pnpm run fix` (if available) or `pnpm check:lint:fix` - Fix linting and formatting issues
  - `pnpm check` - Run all checks (lint, type-check, tests)
  - **Rationale**: Ensures code quality regardless of whether hooks run

### Commit Strategy with --no-verify
- **--no-verify usage**: Use `--no-verify` flag for commits that don't require pre-commit hooks
  - ✅ **Safe to skip hooks**: Scripts (scripts/), GitHub Actions workflows (.github/workflows/), tests (test/), documentation (*.md, docs/), configuration files
  - ❌ **Always run hooks**: SDK source code (src/), published package code, API implementations
  - **Important**: Even when using `--no-verify`, you MUST still run linting/checking commands manually first
  - **Rationale**: Pre-commit hooks run linting and type-checking which are critical for SDK source code but less critical for non-published files

### Batch Commits Strategy
- **When making many changes**: Break large changesets into small, logical commits
- **First commit with tests**: Run full test suite (hooks) for the first commit only
- **Subsequent commits with --no-verify**: Use `--no-verify` for follow-up commits
- **Example workflow**:
  1. Make all changes and ensure `pnpm run fix && pnpm run check` passes
  2. Stage and commit core changes with hooks: `git commit -m "message"`
  3. Stage and commit related changes: `git commit --no-verify -m "message"`
  4. Stage and commit cleanup: `git commit --no-verify -m "message"`
  5. Stage and commit docs: `git commit --no-verify -m "message"`
- **Rationale**: Reduces commit time while maintaining code quality through initial validation

### Git SHA Management (CRITICAL)
- **🚨 NEVER GUESS OR MAKE UP GIT SHAs**: Always retrieve the exact full SHA using `git rev-parse`
  - ✅ CORRECT: `cd /path/to/repo && git rev-parse HEAD` or `git rev-parse main`
  - ❌ WRONG: Guessing the rest of a SHA after seeing only the short version (e.g., `43a668e1`)
  - **Why this matters**: GitHub Actions workflow references require exact, full 40-character SHAs
  - **Consequences of wrong SHA**: Workflow failures with "workflow was not found" errors
- **Updating workflow SHA references**: When updating SHA references in workflow files:
  1. Get the exact full SHA: `cd repo && git rev-parse HEAD`
  2. Use the FULL 40-character SHA in sed commands
  3. Verify the SHA exists: `git show <sha> --stat`
- **Rationale**: Using incorrect SHAs breaks CI/CD pipelines and wastes debugging time

### Changelog Management
- **🚨 MANDATORY**: When creating changelog entries for version bumps:
  - **Check OpenAPI definition updates**: Always analyze `types/api.d.ts` changes
    ```bash
    git diff v{previous-version}..HEAD -- types/
    ```
  - **Document user-facing changes**: Include specific details about:
    - New endpoints added (e.g., `/openapi.json`)
    - Updated parameter descriptions and behavior
    - New type categories or enum values (e.g., 'dual' threat type)
    - Breaking changes to API contracts
  - **Focus on user impact**: Only include changes that affect SDK users, not internal infrastructure
  - **Rationale**: OpenAPI changes directly impact SDK users and must be documented for API discoverability

## 🔍 DEBUGGING

### Common Issues
- **CI vs Local**: CI uses published packages from npm, not local versions
- **Package detection**: Use `existsSync()` not `fs.access()` for consistency
- **Test failures**: Check for unused nock mocks and ensure proper cleanup

## 🚀 PROJECT-SPECIFIC NOTES

### Socket SDK Specifics
- SDK providing programmatic access to Socket.dev security features
- Be careful with file operations - prefer trash over permanent deletion in scripts
- Windows compatibility is important - test path handling carefully
- Use existing utilities from @socketsecurity/registry where available
- Follow existing patterns in the codebase
- Maintain consistency with surrounding code

### Recent Improvements
- ✅ Split monolithic test file into modular test files by functionality
- ✅ Fixed all TypeScript compilation errors
- ✅ Standardized logger calls across the project
- ✅ Improved test organization and maintainability
- ✅ Enhanced error handling patterns

## 📝 SCRATCH DOCUMENTS

### Working Documents Directory
- **Location**: `.claude/` directory (gitignored)
- **Purpose**: Store scratch documents, planning notes, analysis reports, and temporary documentation
- **🚨 CRITICAL**: NEVER commit files in `.claude/` to version control
- **Examples of scratch documents**:
  - Working notes and implementation plans
  - Analysis reports from codebase investigations
  - Temporary documentation and TODO lists
  - Any files not intended for production use

---

**For all other standards not covered here, refer to `socket-registry/CLAUDE.md` (in sibling repository)**
