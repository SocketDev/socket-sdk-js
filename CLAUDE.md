# CLAUDE.md

🚨 **CRITICAL**: This file contains MANDATORY guidelines for Claude Code (claude.ai/code). You MUST follow these guidelines EXACTLY as specified. Act as a principal-level software engineer with deep expertise in TypeScript, Node.js, and SDK development.

## 📚 Learning & Knowledge Sharing

### Self-Learning Protocol
Claude Code should periodically scan and learn from CLAUDE.md files across Socket repositories:
- `socket-cli/CLAUDE.md`
- `socket-packageurl-js/CLAUDE.md`
- `socket-registry/CLAUDE.md`
- `socket-sdk-js/CLAUDE.md`

When working in any Socket repository, check for updates and patterns in other claude.md files to ensure consistency across the ecosystem.

### Cross-Project Learning
- When discovering generally applicable patterns or guidelines, update CLAUDE.md files in other socket- projects
- Examples: c8 comment formatting, error handling patterns, code style rules
- This ensures consistency across the Socket ecosystem

## 🎯 Your Role
You are a **Principal Software Engineer** responsible for:
- Writing production-quality, maintainable code
- Making architectural decisions with long-term impact in mind
- Ensuring code follows established patterns and conventions
- Mentoring through code examples and best practices
- Prioritizing system reliability, performance, and developer experience
- Taking ownership of technical decisions and their consequences

## Commands

### Development Commands
- **Build**: `pnpm build`
- **Test**: `pnpm test` (runs all tests)
- **Type check**: `pnpm tsc`
- **Lint**: `pnpm check:lint`
- **Check all**: `pnpm check` (lint + typecheck)
- **Coverage**: `pnpm test:coverage`
- **Get coverage percentage**: `pnpm run get-coverage-percentage`
- **Get type coverage**: `pnpm run get-type-coverage`

### Testing Best Practices - CRITICAL: NO -- FOR FILE PATHS
- **🚨 NEVER USE `--` BEFORE TEST FILE PATHS** - This runs ALL tests, not just your specified files!
- **Always build before testing**: Ensure dist files are up to date
- **Test single file**: ✅ CORRECT: `pnpm test path/to/file.test.ts`
  - ❌ WRONG: `pnpm test -- path/to/file.test.ts` (runs ALL tests!)
- **Test with pattern**: `pnpm test -t "pattern"`
- **Update snapshots**: `pnpm test -u`
- **Coverage report**: `pnpm test:coverage`
- **Timeout for long tests**: Use `timeout` command or specify in test file

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
- **Path separators**: Never hard-code `/` or `\` in paths
  - Use `path.sep` when you need the separator character
  - Use `path.join()` to construct paths correctly
- **File URLs**: Use `pathToFileURL()` and `fileURLToPath()` from `node:url` when working with file:// URLs
- **Line endings**: Be aware of CRLF (Windows) vs LF (Unix) differences when processing text files
- **Shell commands**: Consider platform differences in shell commands and utilities

### Git Commit Guidelines
- **🚨 FORBIDDEN**: NEVER add Claude co-authorship or Claude signatures to commits
- **🚨 FORBIDDEN**: Do NOT include "Generated with Claude Code" or similar AI attribution in commit messages
- **Commit messages**: Should be written as if by a human developer, focusing on the what and why of changes
- **Professional commits**: Write clear, concise commit messages that describe the actual changes made
- **Commit without tests**: `git commit --no-verify` (skips pre-commit hooks including tests)

### Package Management
- **Package Manager**: This project uses pnpm
- **Install dependencies**: `pnpm install`
- **Add dependency**: `pnpm add <package> --save-exact`
- **Add dev dependency**: `pnpm add -D <package> --save-exact`
- **Update dependencies**: `pnpm update`
- **Add to workspace root**: Use `-w` flag when adding packages to workspace root
- **🚨 MANDATORY**: Always add dependencies with exact versions using `--save-exact` flag to ensure reproducible builds
- **Dynamic imports**: Only use dynamic imports for test mocking (e.g., `vi.importActual` in Vitest). Avoid runtime dynamic imports in production code

## Important Project-Specific Rules

### 1. File Deletion Safety
- **Use `trash` package in scripts**, NOT in SDK/lib code
- SDK/lib should use native fs operations for performance
- Scripts should use trash for safety (files go to system trash/recycle bin)
- `trash` accepts arrays - optimize by collecting paths and passing as array

### 2. Testing
- Always run lint and typecheck before committing:
  - `pnpm run check:lint`
  - `pnpm run check:tsc` or `pnpm tsc`
- Run tests with: `pnpm test`
- Pre-commit hooks will run automatically

### 3. Git Workflow
- **DO NOT commit automatically** - let the user review changes first
- Use `--no-verify` flag only when explicitly requested
- Always provide clear, descriptive commit messages

### 4. Code Style
- Follow existing patterns in the codebase
- Don't add comments unless specifically requested
- Maintain consistency with surrounding code
- Use existing utilities from @socketsecurity/registry where available

### 5. Error Handling
- Scripts should use trash for safer deletion
- Provide fallback behavior when optional dependencies aren't available
- Use try-catch blocks for resilient code

## Architecture

This is the Socket SDK for JavaScript/TypeScript, providing programmatic access to Socket.dev's security analysis capabilities.

### Core Structure
- **Main entry**: `src/index.ts` - SDK entry point with main exports
- **API client**: `src/api/` - API client implementation
- **Types**: `src/types/` - TypeScript type definitions
- **Utils**: `src/utils/` - Shared utilities
- **Scripts**: `scripts/` - Build and development scripts
- **Registry**: Uses `@socketsecurity/registry` for core functionality

### Key Features
- Full TypeScript support with comprehensive type definitions
- API client for Socket.dev platform
- Package analysis and security scanning
- Organization and repository management
- SBOM (Software Bill of Materials) support

## 🔧 Code Style (MANDATORY)

### 📁 File Organization
- **File extensions**: Use `.ts` for TypeScript files, `.mts` for module scripts
- **Import order**: Node.js built-ins first, then third-party packages, then local imports
- **Import grouping**: Group imports by source (Node.js, external packages, local modules)
- **Type imports**: 🚨 ALWAYS use separate `import type` statements for TypeScript types, NEVER mix runtime imports with type imports in the same statement
  - ✅ CORRECT: `import { readPackageJson } from '@socketsecurity/registry/lib/packages'` followed by `import type { PackageJson } from '@socketsecurity/registry/lib/packages'`
  - ❌ FORBIDDEN: `import { readPackageJson, type PackageJson } from '@socketsecurity/registry/lib/packages'`

### Naming Conventions
- **Constants**: Use `UPPER_SNAKE_CASE` for constants
- **Files**: Use kebab-case for filenames
- **Variables**: Use camelCase for variables and functions
- **Types/Interfaces**: Use PascalCase for types and interfaces

### 🏗️ Code Structure (CRITICAL PATTERNS)
- **Type definitions**: 🚨 ALWAYS use `import type` for better tree-shaking
- **Error handling**: 🚨 REQUIRED - Use proper error types and handle errors gracefully
- **Array destructuring**: Use object notation `{ 0: key, 1: data }` instead of array destructuring when appropriate
- **Dynamic imports**: 🚨 FORBIDDEN - Never use dynamic imports (`await import()`). Always use static imports at the top of the file
- **Sorting**: 🚨 MANDATORY - Always sort lists, exports, and items in documentation headers alphabetically/alphanumerically for consistency
- **Comment formatting**: 🚨 MANDATORY - ALL comments MUST follow these rules:
  - **Periods required**: Every comment MUST end with a period, except ESLint disable comments and URLs which are directives/references. This includes single-line, multi-line, inline, and c8 ignore comments.
  - **Sentence structure**: Comments should be complete sentences with proper capitalization and grammar.
  - **Placement**: Place comments on their own line above the code they describe, not trailing to the right of code.
  - **Style**: Use fewer hyphens/dashes and prefer commas, colons, or semicolons for better readability.
  - **Examples**:
    - ✅ CORRECT: `// This function validates user input.`
    - ✅ CORRECT: `/* This is a multi-line comment that explains the complex logic below. */`
    - ✅ CORRECT: `// eslint-disable-next-line no-await-in-loop` (directive, no period)
    - ✅ CORRECT: `// See https://example.com/docs` (URL reference, no period)
    - ✅ CORRECT: `// c8 ignore start - Reason for ignoring.` (explanation has period)
    - ❌ WRONG: `// this validates input` (no period, not capitalized)
    - ❌ WRONG: `const x = 5 // some value` (trailing comment)
- **Await in loops**: When using `await` inside for-loops, add `// eslint-disable-next-line no-await-in-loop` when sequential processing is intentional
- **If statement returns**: Never use single-line return if statements; always use proper block syntax with braces
- **Existence checks**: Perform simple existence checks first before complex operations
- **Destructuring order**: Sort destructured properties alphabetically in const declarations
- **Function ordering**: Place functions in alphabetical order, with private functions first, then exported functions
- **Object mappings**: Use objects with `__proto__: null` for static string-to-string mappings to prevent prototype pollution
- **Array length checks**: Use `!array.length` instead of `array.length === 0`
- **Catch parameter naming**: Use `catch (e)` instead of `catch (error)` for consistency
- **Number formatting**: 🚨 REQUIRED - Use underscore separators (e.g., `20_000`) for large numeric literals. 🚨 FORBIDDEN - Do NOT modify number values inside strings
- **Node.js fs imports**: 🚨 MANDATORY pattern - `import { someSyncThing, promises as fs } from 'node:fs'`
- **Process spawning**: 🚨 FORBIDDEN to use Node.js built-in `child_process.spawn` - MUST use `spawn` from `@socketsecurity/registry/lib/spawn`
- **Object mappings**: Use objects with `__proto__: null` (not `undefined`) for static string-to-string mappings and lookup tables to prevent prototype pollution; use `Map` for dynamic collections that will be mutated
- **Mapping constants**: Move static mapping objects outside functions as module-level constants with descriptive UPPER_SNAKE_CASE names
- **List formatting**: Use `-` for bullet points in text output, not `•` or other Unicode characters, for better terminal compatibility
- **If statement returns**: Never use single-line return if statements; always use proper block syntax with braces

### Error Handling
- **Input validation**: Validate inputs and throw descriptive errors
- **Error messages**: Write clear, actionable error messages
- **Error propagation**: Let errors bubble up appropriately
- **Logging**: Use appropriate logging levels for errors

### 🗑️ Safe File Operations (SECURITY CRITICAL)
- **File deletion**: 🚨 ABSOLUTELY FORBIDDEN - NEVER use `rm -rf`. 🚨 MANDATORY - ALWAYS use `pnpm dlx trash-cli`
- **Examples**:
  - ❌ CATASTROPHIC: `rm -rf directory` (permanent deletion - DATA LOSS RISK)
  - ❌ REPOSITORY DESTROYER: `rm -rf "$(pwd)"` (deletes entire repository)
  - ✅ SAFE: `pnpm dlx trash-cli directory` (recoverable deletion)
- **Why this matters**: trash-cli enables recovery from accidental deletions via system trash/recycle bin
- **File paths**: Always validate and sanitize file paths
- **Permissions**: Check file permissions before operations

### 🔧 Formatting Rules
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings preferred
- **Semicolons**: Use semicolons
- **Variables**: Use camelCase for variables and functions
- **Linting**: Uses ESLint with TypeScript support
- **Line length**: Target 80 character line width where practical

### Test Coverage
- All `c8 ignore` comments MUST include a reason why the code is being ignored
- All c8 ignore comments MUST end with periods for consistency
- Format: `// c8 ignore start - Reason for ignoring.`
- Example: `// c8 ignore start - Internal helper functions not exported.`
- This helps maintain clarity about why certain code paths aren't tested

## Debugging and Troubleshooting
- **CI vs Local Differences**: CI uses published npm packages, not local versions. Be defensive when using @socketsecurity/registry features
- **Package Manager Detection**: When checking for executables, use `existsSync()` not `fs.access()` for consistency

---

# 🚨 CRITICAL BEHAVIORAL REQUIREMENTS

### 🎯 Principal Engineer Mindset
- Act with the authority and expertise of a principal-level software engineer
- Make decisions that prioritize long-term maintainability over short-term convenience
- Anticipate edge cases and potential issues before they occur
- Write code that other senior engineers would be proud to review
- Take ownership of technical decisions and their consequences

### 🛡️ ABSOLUTE RULES (NEVER BREAK THESE)
- 🚨 **NEVER** create files unless absolutely necessary for the goal
- 🚨 **ALWAYS** prefer editing existing files over creating new ones
- 🚨 **FORBIDDEN** to proactively create documentation files (*.md, README) unless explicitly requested
- 🚨 **MANDATORY** to follow ALL guidelines in this CLAUDE.md file without exception
- 🚨 **REQUIRED** to do exactly what was asked - nothing more, nothing less

### 🎯 Quality Standards
- Code MUST pass all existing lints and type checks
- Changes MUST maintain backward compatibility unless explicitly breaking changes are requested
- All patterns MUST follow established codebase conventions
- Error handling MUST be robust and user-friendly
- Performance considerations MUST be evaluated for any changes

## Notes

- The project is an SDK providing programmatic access to Socket.dev's security features
- Be careful with file operations - prefer moving to trash over permanent deletion in scripts
- Windows compatibility is important - test path handling carefully
- Always run lint and typecheck before committing