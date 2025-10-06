# Script Organization Pattern

This document describes the script organization pattern used in this project, which can be applied to other Socket projects for better maintainability and customization.

## Overview

Instead of using inline shell commands in `package.json` scripts, we extract complex orchestration logic into Node.js `.mjs` files in the `scripts/` directory. This provides:

- **Better customization**: Add flags, conditional logic, and complex workflows
- **Improved maintainability**: Easier to read, test, and modify
- **Cross-platform compatibility**: Consistent behavior across Windows, macOS, and Linux
- **Better error handling**: Proper exit codes and error messages
- **Reusable utilities**: Shared functionality across scripts

## Directory Structure

```
scripts/
├── utils/
│   ├── run-command.mjs        # Command execution utilities
│   ├── path-helpers.mjs       # Path manipulation utilities
│   └── ...                    # Other shared utilities
├── build.mjs                  # Build orchestration
├── clean.mjs                  # Clean artifacts
├── check.mjs                  # Run quality checks
├── lint-fix.mjs               # Auto-fix linting issues
├── coverage.mjs               # Coverage collection
├── generate-sdk.mjs           # SDK generation (project-specific)
├── test.mjs                   # Test runner
└── test-with-build.mjs        # Test with conditional build
```

## Core Utilities

### `scripts/utils/run-command.mjs`

Provides utilities for running shell commands:

- `runCommand(command, args, options)` - Run a command asynchronously
- `runCommandSync(command, args, options)` - Run a command synchronously
- `runCommandQuiet(command, args, options)` - Run with output capture
- `runPnpmScript(scriptName, extraArgs, options)` - Run pnpm scripts
- `runSequence(commands)` - Run commands in sequence
- `runParallel(commands)` - Run commands in parallel

**Example:**
```javascript
import { runSequence } from './utils/run-command.mjs';

await runSequence([
  { command: 'pnpm', args: ['run', 'clean'] },
  { command: 'rollup', args: ['-c', 'rollup.config.mjs'] }
]);
```

### `scripts/utils/path-helpers.mjs`

Provides path utilities:

- `getDirname(importMetaUrl)` - Get directory from `import.meta.url`
- `getRootPath(importMetaUrl)` - Get project root from script location

## Main Scripts

### `build.mjs`

Orchestrates the build process with optional flags:

- `--src-only`: Build source code only
- `--types-only`: Build TypeScript declarations only
- Default: Build both source and types

**package.json:**
```json
{
  "scripts": {
    "build": "node scripts/build.mjs",
    "build:dist": "node scripts/build.mjs",
    "build:dist:src": "node scripts/build.mjs --src-only",
    "build:dist:types": "node scripts/build.mjs --types-only"
  }
}
```

### `clean.mjs`

Cleans build artifacts with granular control:

- `--cache`: Clean cache directories only
- `--coverage`: Clean coverage reports only
- `--dist`: Clean dist directory only
- `--dist-types`: Clean dist/types only
- `--declarations`: Clean declaration files only
- `--node-modules`: Clean node_modules
- `--all`: Clean everything (default)

**package.json:**
```json
{
  "scripts": {
    "clean": "node scripts/clean.mjs",
    "clean:cache": "node scripts/clean.mjs --cache",
    "clean:coverage": "node scripts/clean.mjs --coverage",
    "clean:dist": "node scripts/clean.mjs --dist"
  }
}
```

### `check.mjs`

Runs quality checks in parallel:

- TypeScript type checking
- ESLint linting

**package.json:**
```json
{
  "scripts": {
    "check": "node scripts/check.mjs"
  }
}
```

### `lint-fix.mjs`

Runs all linters with auto-fix in sequence:

1. oxlint - Fast Rust-based linter
2. biome - Fast formatter
3. eslint - Final linting pass

Suppresses output to avoid clutter.

**package.json:**
```json
{
  "scripts": {
    "fix": "node scripts/lint-fix.mjs",
    "lint:fix": "node scripts/lint-fix.mjs"
  }
}
```

### `coverage.mjs`

Collects code and type coverage:

- `--code-only`: Collect code coverage only
- `--type-only`: Collect type coverage only
- `--percent`: Show coverage percentage only
- Default: Collect both code and type coverage

**package.json:**
```json
{
  "scripts": {
    "coverage": "node scripts/coverage.mjs",
    "coverage:test": "node scripts/coverage.mjs --code-only",
    "coverage:percent": "node scripts/coverage.mjs --percent"
  }
}
```

## Benefits

### Before (Inline Scripts)

```json
{
  "scripts": {
    "build:dist": "pnpm run build:dist:src && pnpm run build:dist:types",
    "build:dist:src": "pnpm run clean:dist && rollup -c .config/rollup.dist.config.mjs",
    "clean": "run-s -c clean:*",
    "clean:cache": "del-cli '**/.cache'",
    "clean:coverage": "del-cli '.type-coverage' 'coverage'",
    "lint:fix": "run-s -c lint:fix:*",
    "lint:fix:oxlint": "oxlint ... | dev-null",
    "lint:fix:biome": "biome ... | dev-null",
    "lint:fix:eslint": "eslint ... | dev-null"
  }
}
```

**Issues:**
- Hard to add conditional logic
- Limited error handling
- Verbose and hard to read
- Difficult to test
- Platform-specific issues (shell differences)

### After (Node.js Scripts)

```json
{
  "scripts": {
    "build": "node scripts/build.mjs",
    "build:dist:src": "node scripts/build.mjs --src-only",
    "build:dist:types": "node scripts/build.mjs --types-only",
    "clean": "node scripts/clean.mjs",
    "clean:cache": "node scripts/clean.mjs --cache",
    "fix": "node scripts/lint-fix.mjs"
  }
}
```

**Benefits:**
- Easy to add flags and conditional logic
- Proper error handling and logging
- Cross-platform compatible
- Testable and maintainable
- Better documentation with JSDoc

## Applying This Pattern to Other Projects

### Step 1: Create Utilities

Copy `scripts/utils/` directory to your project:

```bash
cp -r socket-sdk-js/scripts/utils your-project/scripts/
```

### Step 2: Identify Complex Scripts

Look for scripts in `package.json` that:

- Chain multiple commands (`&&`, `||`, `;`)
- Use tools like `run-s`, `run-p`
- Have complex flags or options
- Redirect output (`|`, `>`)
- Are difficult to read or maintain

### Step 3: Extract Scripts

Create `.mjs` files for each complex script:

1. **Create the script file**: `scripts/your-script.mjs`
2. **Add fileoverview JSDoc**: Describe what the script does
3. **Import utilities**: Use `run-command.mjs` helpers
4. **Implement logic**: Use command runners for orchestration
5. **Handle errors**: Proper exit codes and logging
6. **Add CLI flags**: Use `parseArgs` for options

### Step 4: Update package.json

Replace inline scripts with calls to `.mjs` files:

```json
{
  "scripts": {
    "build": "node scripts/build.mjs",
    "clean": "node scripts/clean.mjs",
    "test": "node scripts/test.mjs"
  }
}
```

### Step 5: Test

Test each script to ensure it works correctly:

```bash
pnpm run build
pnpm run clean
pnpm run test
```

## Best Practices

1. **Use meaningful flags**: `--src-only`, `--types-only`, not `-s`, `-t`
2. **Add JSDoc comments**: Document parameters and return values
3. **Handle errors gracefully**: Set proper exit codes
4. **Log progress**: Use `logger` from `@socketsecurity/registry`
5. **Keep scripts focused**: One responsibility per script
6. **Make scripts composable**: Allow scripts to call other scripts
7. **Avoid shell: true**: Pass args as arrays to avoid security issues
8. **Test edge cases**: Missing files, wrong flags, etc.

## Common Patterns

### Conditional Execution

```javascript
if (condition) {
  await runCommand('command', ['arg1', 'arg2']);
}
```

### Sequential with Early Exit

```javascript
const exitCode = await runSequence([
  { command: 'cmd1', args: [] },
  { command: 'cmd2', args: [] }
]);

if (exitCode !== 0) {
  process.exitCode = exitCode;
  return;
}
```

### Parallel Execution

```javascript
const exitCodes = await runParallel([
  { command: 'cmd1', args: [] },
  { command: 'cmd2', args: [] }
]);

const failed = exitCodes.some(code => code !== 0);
```

### Captured Output

```javascript
const result = await runCommandQuiet('command', ['arg']);
if (result.exitCode !== 0) {
  logger.error('Command failed:', result.stderr);
}
```

## Migration Checklist

- [ ] Copy `scripts/utils/` to your project
- [ ] Identify complex scripts in `package.json`
- [ ] Create `.mjs` files for each complex script
- [ ] Update `package.json` to reference new scripts
- [ ] Test all scripts
- [ ] Update CI/CD if needed
- [ ] Document project-specific scripts

## References

- `scripts/build.mjs` - Build orchestration example
- `scripts/clean.mjs` - Clean with options example
- `scripts/lint-fix.mjs` - Sequential linter example
- `scripts/check.mjs` - Parallel execution example
- `scripts/utils/run-command.mjs` - Core utilities
