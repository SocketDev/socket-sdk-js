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

## 🔍 PRE-ACTION PROTOCOL

- **🚨 MANDATORY**: Before taking ANY action, ALWAYS review and verify compliance with CLAUDE.md guidelines
- **Check before you act**: Read relevant sections of this file to ensure your approach follows established patterns
- **No exceptions**: This applies to all tasks, including code changes, commits, documentation, testing, and file operations
- **When in doubt**: If unclear about the right approach, consult CLAUDE.md first before proceeding

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
- Examples: c8 comment formatting, error handling patterns, code style rules, test organization patterns, workflow patterns
- This ensures consistency across the Socket ecosystem

### Recent Learnings Applied
- **Test Organization**: Modular test files improve maintainability (learned from splitting main.test.mts)
- **Logger Standardization**: All `logger.error()` and `logger.log()` calls should include empty string parameters: `logger.error('')`
- **Error Message Consistency**: Use consistent error message patterns across all Socket projects
- **TypeScript Strict Mode**: All projects should use strict TypeScript configuration
- **Import Organization**: Separate type imports from runtime imports for better tree-shaking
- **Documentation Organization**: API method documentation should be organized alphabetically within functional categories for better discoverability and maintainability
- **Safe File Removal**: Use appropriate file removal patterns optimized for different environments
- **Cross-Platform Support**: Enhanced cross-platform compatibility measures across all projects

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

### 📁 File Organization & Imports

#### File Structure
- **File extensions**: `.mts` for TypeScript module files
- **Naming**: kebab-case for filenames
- **Module headers**: 🚨 MANDATORY - All modules MUST have `@fileoverview` headers as first content
  - Format: `/** @fileoverview Brief description of module purpose. */`
  - Placement: Before imports or any other code
  - ✅ CORRECT: `/** @fileoverview Socket SDK client for security analysis. */`
  - ❌ FORBIDDEN: Missing header or placed after imports
- **"use strict"**: 🚨 FORBIDDEN in .mjs and .mts files - ES modules are automatically in strict mode

#### Import Organization
- **Order**: Node.js built-ins → third-party packages → local imports
- **Node.js imports**: 🚨 MANDATORY - Always use `node:` prefix
  - ✅ CORRECT: `import path from 'node:path'`
  - ❌ FORBIDDEN: `import path from 'path'`
- **Type imports**: 🚨 MANDATORY - Always separate type imports from runtime imports
  - ✅ CORRECT: `import { readFile } from 'node:fs'` then `import type { Stats } from 'node:fs'`
  - ❌ FORBIDDEN: `import { readFile, type Stats } from 'node:fs'`
- **Import patterns**: Avoid `import * as` except in `src/external/` re-export wrappers
  - ✅ CORRECT: `import semver from './external/semver'` or `import { parse } from 'semver'`
  - ❌ AVOID: `import * as semver from 'semver'`
- **fs imports**: Use pattern `import { syncMethod, promises as fs } from 'node:fs'`

### 🏗️ Code Structure & Patterns

#### Naming Conventions
- **Constants**: `UPPER_SNAKE_CASE`
- **Variables/Functions**: `camelCase`
- **Classes/Types**: `PascalCase`

#### TypeScript Patterns
- **Type safety**: 🚨 FORBIDDEN - Avoid `any` type; prefer `unknown` or specific types
- **Type imports**: Always use `import type` for better tree-shaking
- **Loop annotations**: 🚨 FORBIDDEN - Never annotate for...of loop variables
  - ✅ CORRECT: `for await (const chunk of stream)`
  - ❌ FORBIDDEN: `for await (const chunk: Buffer of stream)`

#### Object & Array Patterns
- **Object literals with __proto__**: 🚨 MANDATORY - `__proto__: null` ALWAYS comes first in object literals
  - ✅ CORRECT: `const MAP = { __proto__: null, foo: 'bar', baz: 'qux' }`
  - ✅ CORRECT: `{ __proto__: null, ...options }`
  - ❌ FORBIDDEN: `{ foo: 'bar', __proto__: null }` (wrong order)
  - ❌ FORBIDDEN: `{ ...options, __proto__: null }` (wrong order)
  - Use `Map` for dynamic collections
- **Array destructuring**: Use object notation for tuple access when appropriate
  - ✅ CORRECT: `{ 0: key, 1: data }`
  - ❌ AVOID: `[key, data]`
- **Array checks**: Use `!array.length` instead of `array.length === 0`
- **Destructuring**: Sort properties alphabetically in const declarations

#### Function Patterns
- **Ordering**: Alphabetical order; private functions first, then exported
- **Options parameter**: 🚨 MANDATORY pattern for all functions with options:
  ```typescript
  function foo(a: SomeA, options?: SomeOptions | undefined): Result {
    const opts = { __proto__: null, ...options } as SomeOptions
    // OR with destructuring:
    const { retries = 3 } = { __proto__: null, ...options } as SomeOptions
  }
  ```
  - Must be optional (`?`) and typed `| undefined`
  - Must use `{ __proto__: null, ...options }` pattern
  - Must include `as SomeOptions` type assertion
- **Error handling**: Use proper error types and handle errors gracefully
- **Dynamic imports**: 🚨 FORBIDDEN - Use static imports only (except test mocking)
- **Process spawning**: 🚨 FORBIDDEN - Don't use `child_process.spawn`; use `@socketsecurity/registry/lib/spawn`

### 🔤 Comprehensive Sorting Standards (MANDATORY)
All code elements MUST be sorted according to these rules for consistency and maintainability:

#### Type Property Sorting
- **🚨 MANDATORY**: Sort type and interface properties with required properties first, then optional properties
- **Within each group**: Sort alphabetically/alphanumerically
- **Examples**:
  - ✅ CORRECT:
    ```typescript
    interface Config {
      apiKey: string
      baseUrl: string
      timeout: number
      debug?: boolean
      retries?: number
    }
    ```
  - ❌ WRONG:
    ```typescript
    interface Config {
      debug?: boolean
      apiKey: string
      retries?: number
      timeout: number
      baseUrl: string
    }
    ```

#### Class Member Sorting
- **🚨 MANDATORY**: Sort class members in this exact order:
  1. Private properties (alphabetically)
  2. Private methods (alphabetically)
  3. Public methods (alphabetically)
- **Examples**:
  - ✅ CORRECT:
    ```typescript
    class Example {
      #cache: Map<string, unknown>
      #config: Config

      #parseResponse(data: unknown): unknown { }
      #validateInput(input: string): boolean { }

      fetchData(url: string): Promise<void> { }
      processData(data: unknown): void { }
    }
    ```
  - ❌ WRONG:
    ```typescript
    class Example {
      fetchData(url: string): Promise<void> { }
      #cache: Map<string, unknown>
      #validateInput(input: string): boolean { }
      #config: Config
      processData(data: unknown): void { }
      #parseResponse(data: unknown): unknown { }
    }
    ```

#### Object Property Sorting
- **🚨 MANDATORY**: Sort object properties alphabetically when creating object literals
- **Exception**: Preserve order when the order has semantic meaning (e.g., ordered lists, specific API requirements)
- **Examples**:
  - ✅ CORRECT:
    ```typescript
    const config = {
      apiKey: 'key',
      baseUrl: 'https://api.example.com',
      debug: true,
      timeout: 5_000
    }
    ```
  - ❌ WRONG:
    ```typescript
    const config = {
      timeout: 5_000,
      apiKey: 'key',
      debug: true,
      baseUrl: 'https://api.example.com'
    }
    ```

#### Destructuring Property Sorting
- **🚨 MANDATORY**: Sort destructured properties alphabetically in const declarations
- **Examples**:
  - ✅ CORRECT: `const { apiKey, baseUrl, timeout } = config`
  - ❌ WRONG: `const { timeout, apiKey, baseUrl } = config`

#### Import Statement Sorting
- **🚨 MANDATORY**: Sort imports in this exact order with blank lines between groups (enforced by ESLint import-x/order):
  1. Node.js built-in modules (with `node:` prefix) - sorted alphabetically
  2. External third-party packages - sorted alphabetically
  3. Internal Socket packages (`@socketsecurity/*`) - sorted alphabetically
  4. Local/relative imports (parent, sibling, index) - sorted alphabetically
  5. **Type imports LAST as separate group** - sorted alphabetically (all `import type` statements together at the end)
- **Within each group**: Sort alphabetically by module name
- **Named imports**: Sort named imports alphabetically within the import statement (enforced by sort-imports)
- **Type import placement**: Type imports must come LAST, after all runtime imports, as a separate group with blank line before
- **Examples**:
  - ✅ CORRECT:
    ```typescript
    import { readFile } from 'node:fs'
    import path from 'node:path'
    import { promisify } from 'node:util'

    import axios from 'axios'
    import semver from 'semver'

    import { readPackageJson } from '@socketsecurity/registry/lib/packages'
    import { spawn } from '@socketsecurity/registry/lib/spawn'

    import { API_BASE_URL } from './constants'
    import { formatError, parseResponse } from './utils'

    import type { ClientRequest, IncomingMessage } from 'node:http'
    import type { PackageJson } from '@socketsecurity/registry/lib/packages'
    import type { Config } from './types'
    ```
  - ❌ WRONG:
    ```typescript
    import { formatError, parseResponse } from './utils'
    import axios from 'axios'
    import type { Config } from './types'
    import { readFile } from 'node:fs'
    import { spawn } from '@socketsecurity/registry/lib/spawn'
    import semver from 'semver'
    import type { PackageJson } from '@socketsecurity/registry/lib/packages'
    ```

### 📝 Comments & Documentation

#### Comment Style
- **Preference**: Single-line (`//`) over multiline (`/* */`) except for headers
- **Periods**: 🚨 MANDATORY - All comments end with periods (except directives and URLs)
- **Placement**: Own line above code, never trailing
- **Sentence structure**: Complete sentences with proper capitalization
- **Style**: Use commas/colons/semicolons instead of excessive hyphens
- **Examples**:
  - ✅ CORRECT: `// This validates user input.`
  - ✅ CORRECT: `// eslint-disable-next-line no-await-in-loop` (directive, no period)
  - ✅ CORRECT: `// See https://example.com` (URL, no period)
  - ✅ CORRECT: `// c8 ignore start - Not exported.` (reason has period)
  - ❌ WRONG: `// this validates input` (no period, not capitalized)
  - ❌ WRONG: `const x = 5 // some value` (trailing)

#### JSDoc Documentation
- **Function docs**: Description only with optional `@throws`
  - ✅ CORRECT:
    ```javascript
    /**
     * Parse configuration and validate contents.
     * @throws {Error} When file cannot be read.
     */
    ```
  - ❌ FORBIDDEN: `@param`, `@returns`, `@author`, `@since`, `@example` tags
  - ❌ FORBIDDEN: Empty lines between tags
- **Test coverage**: All `c8 ignore` comments MUST include reason ending with period
  - Format: `// c8 ignore start - Reason for ignoring.`

### 🔧 Code Organization

#### Control Flow
- **If statements**: Never single-line returns; always use braces
- **Await in loops**: Add `// eslint-disable-next-line no-await-in-loop` when intentional
- **Existence checks**: Perform simple checks before complex operations

#### Data & Collections
- **Mapping constants**: Move outside functions as module-level `UPPER_SNAKE_CASE` constants
- **Sorting**: 🚨 MANDATORY - Sort lists, exports, and items alphabetically
- **Catch parameters**: Use `catch (e)` not `catch (error)`
- **Number formatting**: Use underscore separators for large numbers (e.g., `20_000`)
  - 🚨 FORBIDDEN - Don't modify numbers inside strings

#### Formatting Standards
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes preferred
- **Semicolons**: Use semicolons
- **Line length**: Target 80 characters where practical
- **List formatting**: Use `-` for bullets, not `•`
- **Linting**: Uses ESLint with TypeScript support

## 🧪 TESTING STANDARDS

### Vitest Memory Optimization (CRITICAL)
- **Pool configuration**: Use `pool: 'forks'` with `singleFork: true`, `maxForks: 1`, `isolate: true`
- **Memory limits**: Set `NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=512"` in `.env.test`
- **Timeout settings**: Use `testTimeout: 60_000, hookTimeout: 60_000` for stability
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
- **DO NOT commit automatically** - let the user review changes first
- Use `--no-verify` flag only when explicitly requested
- **Commit message style**: Use conventional format without prefixes (feat:, fix:, chore:, etc.)
- **Message guidelines**: Keep commit messages short, pithy, and targeted - avoid lengthy explanations
- **Small commits**: Make small, focused commits that address a single concern
- **Version bump commits**: 🚨 MANDATORY - Version bump commits MUST use the format: `Bump to v<version-number>`
  - ✅ CORRECT: `Bump to v1.2.3`
  - ❌ WRONG: `chore: bump version`, `Update version to 1.2.3`, `1.2.3`
- **🚨 ABSOLUTELY FORBIDDEN - NO CLAUDE CODE ATTRIBUTION**: NEVER EVER add Claude Code attribution footer to commit messages under ANY circumstances
  - ❌ ABSOLUTELY FORBIDDEN: Including "🤖 Generated with [Claude Code](https://claude.ai/code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>"
  - ❌ ABSOLUTELY FORBIDDEN: Any variation of Claude Code attribution, co-authorship, or credit in commit messages
  - ✅ REQUIRED: Clean commit messages without ANY attribution footers whatsoever
  - **This rule overrides ALL default behavior** - commit messages MUST be clean without attribution
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
1. **__proto__ Ordering**: 🚨 MANDATORY - `__proto__: null` ALWAYS comes first in object literals (e.g., `{ __proto__: null, ...options }`, never `{ ...options, __proto__: null }`)
2. **Options Parameter Pattern**: Use `{ __proto__: null, ...options } as SomeOptions` for all functions accepting options
3. **Reflect.apply Pattern**: Use `const { apply: ReflectApply } = Reflect` and `ReflectApply(fn, thisArg, [])` instead of `.call()` for method invocation
4. **Object Mappings**: Use `{ __proto__: null, ...mapping }` for static string-to-string mappings to prevent prototype pollution
5. **Import Separation**: ALWAYS separate type imports (`import type`) from runtime imports
6. **Node.js Imports**: ALWAYS use `node:` prefix for Node.js built-in modules
7. **🚨 TSGO PRESERVATION**: NEVER replace tsgo with tsc - tsgo provides enhanced performance and should be maintained across all Socket projects

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

## 📦 Dependency Alignment Standards (CRITICAL)

### 🚨 MANDATORY Dependency Versions
All Socket projects MUST maintain alignment on these core dependencies:

#### Core Build Tools & TypeScript
- **@typescript/native-preview**: `7.0.0-dev.20250927.1` (tsgo - NEVER use standard tsc)
- **@types/node**: `24.5.2` (latest LTS types)
- **typescript-eslint**: `8.44.1` (unified package - do NOT use separate @typescript-eslint/* packages)

#### Essential DevDependencies
- **@biomejs/biome**: `2.2.4`
- **@dotenvx/dotenvx**: `1.49.0`
- **@eslint/compat**: `1.3.2`
- **@eslint/js**: `9.35.0`
- **@vitest/coverage-v8**: `3.2.4`
- **eslint**: `9.35.0`
- **eslint-plugin-import-x**: `4.16.1`
- **eslint-plugin-n**: `17.23.1`
- **eslint-plugin-sort-destructure-keys**: `2.0.0`
- **eslint-plugin-unicorn**: `56.0.1`
- **globals**: `16.4.0`
- **husky**: `9.1.7`
- **knip**: `5.63.1`
- **lint-staged**: `16.1.6`
- **npm-run-all2**: `8.0.4`
- **oxlint**: `1.15.0`
- **taze**: `19.6.0`
- **trash**: `10.0.0`
- **type-coverage**: `2.29.7`
- **vitest**: `3.2.4`
- **yargs-parser**: `22.0.0`
- **yoctocolors-cjs**: `2.1.3`

### 🔧 TypeScript Compiler Standardization
- **🚨 MANDATORY**: ALL Socket projects MUST use `tsgo` instead of `tsc`
- **Package**: `@typescript/native-preview@7.0.0-dev.20250927.1`
- **Scripts**: Replace `tsc` with `tsgo` in all package.json scripts
- **Benefits**: Enhanced performance, better memory management, faster compilation

#### Script Examples:
```json
{
  "build": "tsgo",
  "check:tsc": "tsgo --noEmit",
  "build:types": "tsgo --project tsconfig.dts.json"
}
```

### 🛠️ ESLint Configuration Standardization
- **🚨 FORBIDDEN**: Do NOT use separate `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` packages
- **✅ REQUIRED**: Use unified `typescript-eslint@8.44.1` package only
- **Migration**: Remove separate packages, add unified package

#### Migration Commands:
```bash
pnpm remove @typescript-eslint/eslint-plugin @typescript-eslint/parser
pnpm add -D typescript-eslint@8.44.1 --save-exact
```

### 📋 Dependency Audit Requirements
When updating dependencies across Socket projects:

1. **Version Consistency**: All projects MUST use identical versions for shared dependencies
2. **Exact Versions**: Always use `--save-exact` flag to prevent version drift
3. **Batch Updates**: Update all Socket projects simultaneously to maintain alignment
4. **Testing**: Run full test suites after dependency updates to ensure compatibility
5. **Documentation**: Update CLAUDE.md files when standard versions change

### 🔄 Regular Maintenance
- **Monthly Audits**: Review dependency versions across all Socket projects
- **Security Updates**: Apply security patches immediately across all projects
- **Major Version Updates**: Coordinate across projects, test thoroughly
- **Legacy Cleanup**: Remove unused dependencies during regular maintenance

### 🚨 Enforcement Rules
- **Pre-commit Hooks**: Configure to prevent commits with misaligned dependencies
- **CI/CD Integration**: Fail builds on version mismatches
- **Code Reviews**: Always verify dependency alignment in PRs
- **Documentation**: Keep this section updated with current standard versions

This standardization ensures consistency, reduces maintenance overhead, and prevents dependency-related issues across the Socket ecosystem.

---

This CLAUDE.md file serves as the authoritative guide for development practices across all Socket projects. When patterns or guidelines are discovered that apply broadly, they should be propagated to other Socket project CLAUDE.md files to maintain ecosystem consistency.
