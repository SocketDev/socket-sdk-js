# CLAUDE.md

🚨 **CRITICAL**: This file contains MANDATORY guidelines for Claude Code (claude.ai/code). You MUST follow these guidelines EXACTLY as specified. Act as a principal-level software engineer with deep expertise in TypeScript, Node.js, and SDK development.

## 📝 CLAUDE.MD EVOLUTION

### Pattern Recognition & Documentation
- **🚨 MANDATORY**: If the user repeatedly tells you to change or do something in multiple conversations, ask if it should be added to CLAUDE.md
- **Examples of candidates**: Repeated code style corrections, consistent testing patterns, frequent workflow changes, recurring error fixes
- **Question format**: "I notice you've mentioned [pattern] multiple times. Should I add this as a guideline to CLAUDE.md for consistency across projects?"
- **Update trigger**: If the same instruction comes up 2+ times in different contexts, proactively suggest adding it to documentation

## 🎯 YOUR ROLE & MINDSET

You are a **Principal Software Engineer** responsible for:
- Writing production-quality, maintainable code
- Making architectural decisions with long-term impact in mind
- Ensuring code follows established patterns and conventions
- Mentoring through code examples and best practices
- Prioritizing system reliability, performance, and developer experience
- Taking ownership of technical decisions and their consequences

**Principal Engineer Mindset**:
- Act with authority and expertise of a principal-level software engineer
- Make decisions that prioritize long-term maintainability over short-term convenience
- Anticipate edge cases and potential issues before they occur
- Write code that other senior engineers would be proud to review
- Take ownership of technical decisions and their consequences

## 🛡️ ABSOLUTE RULES (NEVER BREAK THESE)

- 🚨 **NEVER** create files unless absolutely necessary for the goal
- 🚨 **ALWAYS** prefer editing existing files over creating new ones
- 🚨 **FORBIDDEN** to proactively create documentation files (*.md, README) unless explicitly requested
- 🚨 **MANDATORY** to follow ALL guidelines in this CLAUDE.md file without exception
- 🚨 **REQUIRED** to do exactly what was asked - nothing more, nothing less

## 📚 LEARNING & KNOWLEDGE SHARING

### Self-Learning Protocol
Claude Code should periodically scan and learn from CLAUDE.md files across Socket repositories:
- `socket-cli/CLAUDE.md`
- `socket-packageurl-js/CLAUDE.md`
- `socket-registry/CLAUDE.md`
- `socket-sdk-js/CLAUDE.md`

When working in any Socket repository, check for updates and patterns in other claude.md files to ensure consistency across the ecosystem.

### Cross-Project Learning
- When discovering generally applicable patterns or guidelines, update CLAUDE.md files in other socket- projects
- Examples: c8 comment formatting, error handling patterns, code style rules, test organization patterns
- This ensures consistency across the Socket ecosystem

### Recent Learnings Applied
- **Test Organization**: Modular test files improve maintainability (learned from splitting main.test.mts)
- **Logger Standardization**: All `logger.error()` and `logger.log()` calls should include empty string parameters: `logger.error('')`
- **Error Message Consistency**: Use consistent error message patterns across all Socket projects
- **TypeScript Strict Mode**: All projects should use strict TypeScript configuration
- **Import Organization**: Separate type imports from runtime imports for better tree-shaking
- **Documentation Organization**: API method documentation should be organized alphabetically within functional categories for better discoverability and maintainability

## 🏗️ PROJECT ARCHITECTURE

### Socket SDK for JavaScript/TypeScript
This is the Socket SDK for JavaScript/TypeScript, providing programmatic access to Socket.dev's security analysis capabilities.

### Core Structure
- **Main entry**: `src/index.ts` - SDK entry point with main exports
- **SDK Class**: `src/socket-sdk-class.ts` - Main SDK class with all API methods
- **HTTP Client**: `src/http-client.ts` - HTTP request/response handling
- **Types**: `src/types.ts` - TypeScript type definitions
- **Utils**: `src/utils.ts` - Shared utilities
- **Constants**: `src/constants.ts` - Application constants
- **Scripts**: `scripts/` - Build and development scripts
- **Registry**: Uses `@socketsecurity/registry` for core functionality

### Key Features
- Full TypeScript support with comprehensive type definitions
- API client for Socket.dev platform
- Package analysis and security scanning
- Organization and repository management
- SBOM (Software Bill of Materials) support
- High-performance data processing optimized for security analysis
- Batch operations for package analysis
- File upload capabilities with multipart form data

## ⚡ COMMANDS & SCRIPTS

### Development Commands
- **Build**: `pnpm build`
- **Test**: `pnpm test` (runs all tests)
- **Type check**: `pnpm tsc`
- **Lint**: `pnpm check:lint`
- **Check all**: `pnpm check` (lint + typecheck)
- **Coverage**: `pnpm run test:unit:coverage`
- **Coverage percentage**: `pnpm run coverage:percent`
- **Type coverage**: `pnpm run coverage:type`

### Testing Best Practices - CRITICAL: NO -- FOR FILE PATHS
- **🚨 NEVER USE `--` BEFORE TEST FILE PATHS** - This runs ALL tests, not just your specified files!
- **Always build before testing**: Ensure dist files are up to date
- **Test single file**: ✅ CORRECT: `pnpm test path/to/file.test.ts`
  - ❌ WRONG: `pnpm test -- path/to/file.test.ts` (runs ALL tests!)
- **Test with pattern**: `pnpm test -t "pattern"`
- **Update snapshots**: `pnpm test -u`
- **Coverage report**: `pnpm run test:unit:coverage`
- **Timeout for long tests**: Use `timeout` command or specify in test file

### Test Organization (New Learning)
- **Modular test files**: Split large test files by functionality (e.g., `main.test.mts` → `socket-sdk-basic.test.mts`, `socket-sdk-organization.test.mts`, etc.)
- **Test file naming**: Use descriptive names that reflect the module being tested
- **Test structure**: Group tests by logical functionality, not just by class methods
- **Shared setup**: Use common beforeEach/afterEach patterns across test files
- **Mock management**: Clean up mocks properly to prevent test interference

### Test Naming Standards (Critical for Coverage)
- **File names**: Use descriptive, specific names that clearly indicate what's being tested
  - ✅ CORRECT: `socket-sdk-upload-manifest.test.mts`, `http-client-functions.test.mts`
  - ❌ WRONG: `test1.test.mts`, `misc.test.mts`, `utils.test.mts`
- **Describe blocks**: Use clear, contextual descriptions that explain the feature area
  - ✅ CORRECT: `describe('SocketSdk - Upload Manifest Files', ...)`, `describe('HTTP Client - Module Selection', ...)`
  - ❌ WRONG: `describe('tests', ...)`, `describe('functions', ...)`
- **Test descriptions**: Write meaningful descriptions that explain the specific behavior being tested
  - ✅ CORRECT: `it('should handle API errors during upload', ...)`, `it('should return https module for secure HTTPS URLs', ...)`
  - ❌ WRONG: `it('works', ...)`, `it('test case 1', ...)`, `it('handles errors', ...)`
- **Coverage-focused testing**: When writing tests to improve coverage, ensure they test meaningful scenarios, not just execute code paths
- **Edge case documentation**: Clearly describe edge cases and error conditions in test names

## 🔒 SECURITY & SAFETY

### File Operations (SECURITY CRITICAL)
- **Script usage only**: Use `trash` package ONLY in scripts, build files, and utilities - NOT in `/src/` files
- **Import and use `trash` package**: `import { trash } from 'trash'` then `await trash(paths)` (scripts only)
- **Source code deletion**: In `/src/` files, use `fs.rm()` with proper error handling when deletion is required
- **Script deletion operations**: Use `await trash()` for scripts, build processes, and development utilities
- **Array optimization**: `trash` accepts arrays - collect paths and pass as array
- **Async requirement**: Always `await trash()` - it's an async operation
- **NO rmSync**: 🚨 ABSOLUTELY FORBIDDEN - NEVER use `fs.rmSync()` or `rm -rf` commands
- **Examples**:
  - ❌ CATASTROPHIC: `rm -rf directory` (permanent deletion - DATA LOSS RISK)
  - ❌ REPOSITORY DESTROYER: `rm -rf "$(pwd)"` (deletes entire repository)
  - ❌ FORBIDDEN: `fs.rmSync(tmpDir, { recursive: true, force: true })` (dangerous)
  - ✅ SCRIPTS: `await trash([tmpDir])` (recoverable deletion in build scripts)
  - ✅ SOURCE CODE: `await fs.rm(tmpDir, { recursive: true, force: true })` (when needed in /src/)

### Cross-Platform Compatibility - CRITICAL: Windows and POSIX
- **🚨 MANDATORY**: Tests and functionality MUST work on both POSIX (macOS/Linux) and Windows systems
- **Path handling**: ALWAYS use `path.join()`, `path.resolve()`, `path.sep` for file paths
  - ❌ WRONG: `'/usr/local/bin/npm'` (hard-coded POSIX path)
  - ✅ CORRECT: `path.join(path.sep, 'usr', 'local', 'bin', 'npm')` (cross-platform)
  - ❌ WRONG: `'/project/package-lock.json'` (hard-coded forward slashes)
  - ✅ CORRECT: `path.join('project', 'package-lock.json')` (uses correct separator)
- **Temp directories**: Use `os.tmpdir()` for temporary file paths in tests
  - ❌ WRONG: `'/tmp/test-project'` (POSIX-specific)
  - ✅ CORRECT: `path.join(os.tmpdir(), 'test-project')` (cross-platform)
  - **Unique temp dirs**: Use `fs.mkdtemp()` or `fs.mkdtempSync()` for collision-free directories
  - ✅ PREFERRED: `await fs.mkdtemp(path.join(os.tmpdir(), 'socket-test-'))` (async)
  - ✅ ACCEPTABLE: `fs.mkdtempSync(path.join(os.tmpdir(), 'socket-test-'))` (sync)
- **Path separators**: Never hard-code `/` or `\` in paths
  - Use `path.sep` when you need the separator character
  - Use `path.join()` to construct paths correctly
- **File URLs**: Use `pathToFileURL()` and `fileURLToPath()` from `node:url` when working with file:// URLs
  - ❌ WRONG: `path.dirname(new URL(import.meta.url).pathname)` (Windows path doubling)
  - ✅ CORRECT: `path.dirname(fileURLToPath(import.meta.url))` (cross-platform)
- **Line endings**: Be aware of CRLF (Windows) vs LF (Unix) differences when processing text files
- **Shell commands**: Consider platform differences in shell commands and utilities

## 📦 PACKAGE MANAGEMENT

### pnpm Configuration
- **Package Manager**: This project uses pnpm (v10.16.0+)
- **Install dependencies**: `pnpm install`
- **Add dependency**: `pnpm add <package> --save-exact`
- **Add dev dependency**: `pnpm add -D <package> --save-exact`
- **Update dependencies**: `pnpm update`
- **Script execution**: Always use `pnpm run <script>` for package.json scripts to distinguish from built-in pnpm commands
  - ✅ CORRECT: `pnpm run build`, `pnpm run test`, `pnpm run check`
  - ❌ AVOID: `pnpm build`, `pnpm test` (unclear if built-in or script)
- **README installation examples**: 🚨 MANDATORY - All package installation examples in README.md files MUST use `pnpm install` instead of `npm install`
  - ✅ CORRECT: `pnpm install @socketsecurity/sdk`
  - ❌ WRONG: `npm install @socketsecurity/sdk`
  - **Rationale**: Maintain consistency with project's chosen package manager across all documentation
- **Add to workspace root**: Use `-w` flag when adding packages to workspace root
- **🚨 MANDATORY**: Always add dependencies with exact versions using `--save-exact` flag to ensure reproducible builds
- **Dependency validation**: All dependencies MUST be pinned to exact versions without range specifiers like `^` or `~`
- **Dynamic imports**: Only use dynamic imports for test mocking (e.g., `vi.importActual` in Vitest). Avoid runtime dynamic imports in production code

## 🎨 CODE STYLE (MANDATORY)

### File Organization
- **File extensions**: Use `.mts` for TypeScript files
- **Module headers**: 🚨 MANDATORY - All JavaScript/TypeScript modules MUST have `@fileoverview` headers
  - **Format**: Use `/** @fileoverview Brief description of module purpose. */` at the top of each file
  - **Placement**: Must be the very first content in the file, before imports or other code
  - **Content**: Provide a concise, clear description of what the module does and its primary purpose
  - **Examples**:
    - ✅ CORRECT: `/** @fileoverview Socket SDK client for security analysis and vulnerability detection. */`
    - ✅ CORRECT: `/** @fileoverview API response types and interfaces for Socket security endpoints. */`
    - ❌ FORBIDDEN: Missing @fileoverview header entirely
    - ❌ FORBIDDEN: Placing @fileoverview after imports or other code
- **Import order**: Node.js built-ins first, then third-party packages, then local imports
- **Import grouping**: Group imports by source (Node.js, external packages, local modules)
- **Node.js module imports**: 🚨 MANDATORY - Always use `node:` prefix for Node.js built-in modules
  - ✅ CORRECT: `import { readFile } from 'node:fs'`, `import path from 'node:path'`
  - ❌ FORBIDDEN: `import { readFile } from 'fs'`, `import path from 'path'`
- **Type imports**: 🚨 ALWAYS use separate `import type` statements for TypeScript types, NEVER mix runtime imports with type imports in the same statement
  - ✅ CORRECT: `import { readPackageJson } from '@socketsecurity/registry/lib/packages'` followed by `import type { PackageJson } from '@socketsecurity/registry/lib/packages'`
  - ❌ FORBIDDEN: `import { readPackageJson, type PackageJson } from '@socketsecurity/registry/lib/packages'`

### Naming Conventions
- **Constants**: Use `UPPER_SNAKE_CASE` for constants
- **Files**: Use kebab-case for filenames
- **Variables**: Use camelCase for variables and functions
- **Types/Interfaces**: Use PascalCase for types and interfaces

### Critical Code Patterns
- **Type definitions**: 🚨 ALWAYS use `import type` for better tree-shaking
- **Error handling**: 🚨 REQUIRED - Use proper error types and handle errors gracefully
- **Array destructuring**: Use object notation `{ 0: key, 1: data }` instead of array destructuring when appropriate
- **Dynamic imports**: 🚨 FORBIDDEN - Never use dynamic imports (`await import()`). Always use static imports at the top of the file
- **Sorting**: 🚨 MANDATORY - Always sort lists, exports, and items in documentation headers alphabetically/alphanumerically for consistency
- **"use strict" directives**: 🚨 FORBIDDEN in .mjs and .mts files - ES modules are automatically in strict mode, adding 'use strict' is redundant and should be avoided

### Comment Standards
- **Comment formatting**: 🚨 MANDATORY - ALL comments MUST follow these rules:
  - **Periods required**: Every comment MUST end with a period, except ESLint disable comments and URLs which are directives/references
  - **Sentence structure**: Comments should be complete sentences with proper capitalization and grammar
  - **Placement**: Place comments on their own line above the code they describe, not trailing to the right of code
  - **Style**: Use fewer hyphens/dashes and prefer commas, colons, or semicolons for better readability
  - **Examples**:
    - ✅ CORRECT: `// This function validates user input.`
    - ✅ CORRECT: `/* This is a multi-line comment that explains the complex logic below. */`
    - ✅ CORRECT: `// eslint-disable-next-line no-await-in-loop` (directive, no period)
    - ✅ CORRECT: `// See https://example.com/docs` (URL reference, no period)
    - ✅ CORRECT: `// c8 ignore start - Reason for ignoring.` (explanation has period)
    - ❌ WRONG: `// this validates input` (no period, not capitalized)
    - ❌ WRONG: `const x = 5 // some value` (trailing comment)

### Additional Code Patterns
- **Await in loops**: When using `await` inside for-loops, add `// eslint-disable-next-line no-await-in-loop` when sequential processing is intentional
- **If statement returns**: Never use single-line return if statements; always use proper block syntax with braces
- **Existence checks**: Perform simple existence checks first before complex operations
- **Destructuring order**: Sort destructured properties alphabetically in const declarations
- **Function ordering**: Place functions in alphabetical order, with private functions first, then exported functions
- **Object mappings**: Use objects with `__proto__: null` for static string-to-string mappings to prevent prototype pollution
- **Mapping constants**: Move static mapping objects outside functions as module-level constants with descriptive UPPER_SNAKE_CASE names
- **Array length checks**: Use `!array.length` instead of `array.length === 0`. For `array.length > 0`, use `!!array.length` when function must return boolean, or `array.length` when used in conditional contexts
- **Catch parameter naming**: Use `catch (e)` instead of `catch (error)` for consistency
- **Number formatting**: 🚨 REQUIRED - Use underscore separators (e.g., `20_000`) for large numeric literals. 🚨 FORBIDDEN - Do NOT modify number values inside strings
- **Node.js fs imports**: 🚨 MANDATORY pattern - `import { someSyncThing, promises as fs } from 'node:fs'`
- **Process spawning**: 🚨 FORBIDDEN to use Node.js built-in `child_process.spawn` - MUST use `spawn` from `@socketsecurity/registry/lib/spawn`
- **List formatting**: Use `-` for bullet points in text output, not `•` or other Unicode characters, for better terminal compatibility
- **For...of loop type annotations**: 🚨 FORBIDDEN - Never use type annotations in for...of loop variable declarations. TypeScript cannot parse `for await (const chunk: Buffer of stream)` - use `for await (const chunk of stream)` instead and let TypeScript infer the type

### 🏗️ Function Options Pattern (MANDATORY)
- **🚨 REQUIRED**: ALL functions accepting options MUST follow this exact pattern:
  ```typescript
  function foo(a: SomeA, b: SomeB, options?: SomeOptions | undefined): FooResult {
    const opts = { __proto__: null, ...options } as SomeOptions
    // OR for destructuring with defaults:
    const { someOption = 'someDefaultValue' } = { __proto__: null, ...options } as SomeOptions
    // ... rest of function
  }
  ```
- **Key requirements**:
  - Options parameter MUST be optional with `?` and explicitly typed as `| undefined`
  - MUST use `{ __proto__: null, ...options }` pattern to prevent prototype pollution
  - MUST use `as SomeOptions` type assertion after spreading
  - Use destructuring form when you need defaults for individual options
  - Use direct assignment form when passing entire options object to other functions
- **Examples**:
  - ✅ CORRECT: `const opts = { __proto__: null, ...options } as SomeOptions`
  - ✅ CORRECT: `const { timeout = 5000, retries = 3 } = { __proto__: null, ...options } as SomeOptions`
  - ❌ FORBIDDEN: `const opts = { ...options }` (vulnerable to prototype pollution)
  - ❌ FORBIDDEN: `const opts = options || {}` (doesn't handle null prototype)
  - ❌ FORBIDDEN: `const opts = Object.assign({}, options)` (inconsistent pattern)

### Formatting Rules
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings preferred
- **Semicolons**: Use semicolons
- **Variables**: Use camelCase for variables and functions
- **Linting**: Uses ESLint with TypeScript support
- **Line length**: Target 80 character line width where practical

## 🧪 TESTING STANDARDS

### Vitest Memory Optimization (CRITICAL)
- **Pool configuration**: Use `pool: 'forks'` with `singleFork: true`, `maxForks: 1`, `isolate: true`
- **Memory limits**: Set `NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=512"` in `.env.test`
- **Timeout settings**: Use `testTimeout: 60000, hookTimeout: 60000` for stability
- **Thread limits**: Use `singleThread: true, maxThreads: 1` to prevent RegExp compiler exhaustion
- **Test cleanup**: 🚨 MANDATORY - Use `await trash([paths])` in test scripts/utilities only. For cleanup within `/src/` test files, use `fs.rm()` with proper error handling

### Test Coverage Requirements
- All `c8 ignore` comments MUST include a reason why the code is being ignored
- All c8 ignore comments MUST end with periods for consistency
- Format: `// c8 ignore start - Reason for ignoring.`
- Example: `// c8 ignore start - Internal helper functions not exported.`
- This helps maintain clarity about why certain code paths aren't tested

### Test Organization Best Practices
- **Modular structure**: Split large test files by functionality
- **Descriptive naming**: Use clear, descriptive test file names
- **Test directory structure**: 🚨 MANDATORY - Standardize test directory organization across all Socket projects:
  ```
  test/
  ├── unit/                   # Unit tests
  ├── integration/           # Integration tests (if applicable)
  ├── fixtures/              # Test fixtures and data files
  └── utils/                 # Test utilities and helpers
  ```
- **Test fixtures**: Store reusable test data, mock responses, and sample files in `test/fixtures/` directory
  - **Organization**: Group fixtures by test category or functionality
  - **File formats**: Support JSON, text, binary files as needed for comprehensive testing
  - **Naming**: Use descriptive names that clearly indicate the fixture's purpose
- **Test utilities organization**: 🚨 MANDATORY - Organize test utilities in `test/utils/` directory
  - **Directory structure**: Create `test/utils/` subdirectory for reusable test utilities
  - **Modular utilities**: Split utilities by purpose into focused modules:
    - `environment.mts` - Test environment setup and cleanup (nock, error handling)
    - `fixtures.mts` - Test data configurations and mock objects
    - `mock-helpers.mts` - Mock setup and configuration utilities
    - `constants.mts` - Test constants and configuration values
  - **Import paths**: Update all test file imports to reference specific utility modules
  - **Cross-project consistency**: Apply this pattern across all Socket projects for standardization
  - **Examples**:
    - ✅ CORRECT: `import { setupTestEnvironment } from './utils/environment.mts'`
    - ✅ CORRECT: `import { TEST_PACKAGE_CONFIGS } from './utils/fixtures.mts'`
    - ❌ OLD PATTERN: `import { setupTestEnvironment } from './test-utils.mts'`
- **Proper mocking**: Clean up HTTP mocks (nock) properly to prevent test interference
- **Error scenarios**: Test both success and error paths for all API methods
- **Edge cases**: Include tests for Unicode, empty responses, malformed data
- **Cross-platform**: Ensure tests work on both Windows and POSIX systems

## 🔧 GIT & WORKFLOW

### Git Commit Guidelines
- **🚨 FORBIDDEN**: NEVER add Claude co-authorship or Claude signatures to commits
- **🚨 FORBIDDEN**: Do NOT include "Generated with Claude Code" or similar AI attribution in commit messages
- **Commit messages**: Should be written as if by a human developer, focusing on the what and why of changes
- **Professional commits**: Write clear, concise commit messages that describe the actual changes made
- **Commit without tests**: `git commit --no-verify` (skips pre-commit hooks including tests)

### Git Workflow Rules
- **DO NOT commit automatically** - let the user review changes first
- Use `--no-verify` flag only when explicitly requested
- Always provide clear, descriptive commit messages

## 📝 CHANGELOG MANAGEMENT

When updating the changelog (`CHANGELOG.md`):
- Version headers should be formatted as markdown links to GitHub releases
- Use the format: `## [version](https://github.com/SocketDev/socket-sdk-js/releases/tag/vversion) - date`
- Example: `## [1.6.1](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.6.1) - 2025-01-15`
- This allows users to click version numbers to view the corresponding GitHub release

### Keep a Changelog Compliance
Follow the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format:
- Use standard sections: Added, Changed, Fixed, Removed (Security if applicable)
- Maintain chronological order with latest version first
- Include release dates in YYYY-MM-DD format
- Make entries human-readable, not machine diffs
- Focus on notable changes that impact users

## 🔍 DEBUGGING & TROUBLESHOOTING

### Common Issues
- **CI vs Local Differences**: CI uses published packages from npm registry, not local versions. Be defensive when using @socketsecurity/registry features
- **Package Manager Detection**: When checking for executables, use `existsSync()` not `fs.access()` for consistency
- **Test Failures**: Check for unused nock mocks and ensure proper cleanup
- **TypeScript Issues**: Verify import/export patterns and type definitions
- **Path Issues**: Always use cross-platform path handling

### Logger Standardization (New Learning)
- **Consistent logger calls**: All `logger.error()` and `logger.log()` calls should include empty string parameters
  - ✅ CORRECT: `logger.error('')`, `logger.log('')`
  - ❌ WRONG: `logger.error()`, `logger.log()`
- **Cross-project consistency**: Apply this pattern across all Socket projects

## 📊 QUALITY STANDARDS

### Code Quality Requirements
- Code MUST pass all existing lints and type checks
- Changes MUST maintain backward compatibility unless explicitly breaking changes are requested
- All patterns MUST follow established codebase conventions
- Error handling MUST be robust and user-friendly
- Performance considerations MUST be evaluated for any changes

### Error Handling Standards
- **Input validation**: Validate inputs and throw descriptive errors
- **Error messages**: Write clear, actionable error messages
- **Error propagation**: Let errors bubble up appropriately
- **Logging**: Use appropriate logging levels for errors
- **Graceful degradation**: Provide fallback behavior when optional dependencies aren't available

## 🚀 PROJECT-SPECIFIC NOTES

### Socket SDK Specifics
- The project is an SDK providing programmatic access to Socket.dev's security features
- Be careful with file operations - prefer moving to trash over permanent deletion in scripts
- Windows compatibility is important - test path handling carefully
- Always run lint and typecheck before committing
- Use existing utilities from @socketsecurity/registry where available
- Follow existing patterns in the codebase
- Don't add comments unless specifically requested
- Maintain consistency with surrounding code

### Recent Improvements Made
- ✅ Split monolithic test file into modular test files by functionality
- ✅ Fixed all TypeScript compilation errors
- ✅ Standardized logger calls across the project
- ✅ Improved test organization and maintainability
- ✅ Enhanced error handling patterns
- ✅ Updated cross-platform compatibility measures

## 📋 Recurring Patterns & Instructions

These are patterns and instructions that should be consistently applied across all Socket projects:

### 🏗️ Mandatory Code Patterns
1. **Options Parameter Pattern**: Use `{ __proto__: null, ...options } as SomeOptions` for all functions accepting options
2. **Reflect.apply Pattern**: Use `const { apply: ReflectApply } = Reflect` and `ReflectApply(fn, thisArg, [])` instead of `.call()` for method invocation
3. **Object Mappings**: Use `{ __proto__: null, ...mapping }` for static string-to-string mappings to prevent prototype pollution
4. **Import Separation**: ALWAYS separate type imports (`import type`) from runtime imports
5. **Node.js Imports**: ALWAYS use `node:` prefix for Node.js built-in modules

### 🧪 Test Patterns & Cleanup
1. **Remove Duplicate Tests**: Eliminate tests that verify the same functionality across multiple files
2. **Centralize Test Data**: Use shared test fixtures instead of hardcoded values repeated across projects
3. **Focus Test Scope**: Each project should test its specific functionality, not dependencies' core features

### 🔄 Cross-Project Consistency
These patterns should be enforced across all Socket repositories:
- `socket-cli`
- `socket-packageurl-js`
- `socket-registry`
- `socket-sdk-js`

When working in any Socket repository, check CLAUDE.md files in other Socket projects for consistency and apply these patterns universally.

---

This CLAUDE.md file serves as the authoritative guide for development practices across all Socket projects. When patterns or guidelines are discovered that apply broadly, they should be propagated to other Socket project CLAUDE.md files to maintain ecosystem consistency.