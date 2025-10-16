# Hybrid Build + Vitest Optimization Plan

**Date:** 2025-10-16
**Goal:** Implement esbuild+tsgo hybrid builds + optimize vitest for <20s runs with instant bail
**Status:** Ready to implement

---

## Overview

**Three-pronged approach:**
1. **Hybrid builds:** esbuild (JS) + tsgo (declarations) for all 3 repos
2. **Vitest optimization:** <20s for changed files, instant bail when nothing changed
3. **Watch mode:** Incremental builds with 68% faster rebuilds

---

## Current State Analysis

### socket-sdk-js ✅
- ✅ esbuild already used for JS compilation
- ✅ Incremental builds already implemented
- ✅ Watch mode working
- ⏳ Still uses tsgo for type checking only
- ⏳ Vitest config good but can be optimized further

### socket-packageurl-js ✅
- ✅ esbuild already used for JS compilation
- ✅ Incremental builds just implemented
- ✅ Watch mode working
- ⏳ tsgo used for type checking only
- ⏳ Vitest config needs optimization

### socket-registry ❌
- ❌ Uses tsgo for BOTH JS compilation AND declarations
- ❌ No incremental builds
- ❌ No watch mode
- ⏳ Vitest config needs optimization

**Action needed:** Implement hybrid approach for socket-registry

---

## Implementation Plan

### Phase 1: socket-registry Hybrid Build

**Current:**
```bash
build:ts (tsgo):     5000ms  # TS → JS compilation
build:types (tsgo):   200ms  # Declaration generation
```

**Target:**
```bash
build:js (esbuild):   500ms  # 10x faster
build:types (tsgo):   200ms  # Keep (already fast!)
```

**Changes needed:**
1. Create `.config/esbuild.config.mjs` in registry/
2. Create `scripts/build-js.mjs` for esbuild compilation
3. Update package.json scripts
4. Test and verify

---

### Phase 2: Vitest Optimization for All Repos

**Goals:**
- ✅ <20 seconds for changed files
- ✅ Instant bail when nothing changed (~100ms)
- ✅ Parallel execution optimized
- ✅ Cache leveraged properly

**Key optimizations:**
1. **File change detection** - Only run tests for changed files
2. **Bail fast** - Exit immediately if no tests to run
3. **Cache aggressively** - Leverage vitest cache
4. **Parallel execution** - Maximize thread usage
5. **Smart test selection** - Run related tests only

---

## Detailed Implementation

### socket-registry: Hybrid Build Setup

#### Step 1: Create esbuild Config

**File:** `/Users/jdalton/projects/socket-registry/registry/.config/esbuild.config.mjs`

```javascript
/**
 * @fileoverview esbuild configuration for socket-registry
 */
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPath = path.join(__dirname, '..')
const srcPath = path.join(rootPath, 'src')
const distPath = path.join(rootPath, 'dist')

// Build configuration for CommonJS output
export const buildConfig = {
  entryPoints: [
    // Main entry
    `${srcPath}/index.ts`,
    // All other TypeScript files (non-bundled)
    `${srcPath}/**/*.ts`,
  ],
  outdir: distPath,
  bundle: false, // Don't bundle for library
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: false, // Library code should be readable
  treeShaking: true,
  metafile: true,
  logLevel: 'info',

  // External dependencies
  external: [
    // Node.js built-ins
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`),
    // All workspace packages
    '@socketsecurity/*',
    '@socketregistry/*',
  ],

  // Banner for generated code
  banner: {
    js: '/* Socket Registry - Built with esbuild */',
  },
}

// Watch configuration for development with incremental builds
export const watchConfig = {
  ...buildConfig,
  minify: false,
  sourcemap: 'inline',
  logLevel: 'debug',
}
```

#### Step 2: Create Build Script

**File:** `/Users/jdalton/projects/socket-registry/registry/scripts/build-js.mjs`

```javascript
#!/usr/bin/env node
/**
 * @fileoverview JavaScript compilation using esbuild (10x faster than tsgo)
 */
import { build, context } from 'esbuild'

import { logger } from '../../scripts/utils/cli-helpers.mjs'
import { buildConfig, watchConfig } from '../.config/esbuild.config.mjs'

/**
 * Standard build for production
 */
async function buildJS() {
  try {
    logger.step('Building JavaScript with esbuild')
    const startTime = Date.now()

    await build(buildConfig)

    const buildTime = Date.now() - startTime
    logger.substep(`JavaScript built in ${buildTime}ms`)

    return 0
  } catch (error) {
    logger.error('JavaScript build failed:', error)
    return 1
  }
}

/**
 * Watch mode with incremental builds (68% faster rebuilds)
 */
async function watchJS() {
  try {
    logger.step('Starting watch mode with incremental builds')
    logger.substep('Watching for file changes...')

    const ctx = await context({
      ...watchConfig,
      plugins: [
        {
          name: 'rebuild-logger',
          setup(build) {
            build.onEnd((result) => {
              if (result.errors.length > 0) {
                logger.error('Rebuild failed')
              } else {
                logger.success('Rebuild succeeded')
              }
            })
          }
        }
      ]
    })

    await ctx.watch()

    // Keep process alive
    process.on('SIGINT', async () => {
      await ctx.dispose()
      process.exit(0)
    })

    await new Promise(() => {})
  } catch (error) {
    logger.error('Watch mode failed:', error)
    return 1
  }
}

// Main
const isWatch = process.argv.includes('--watch')

if (isWatch) {
  watchJS().catch(console.error)
} else {
  buildJS().then(code => {
    process.exitCode = code
  }).catch(console.error)
}
```

#### Step 3: Update package.json

**File:** `/Users/jdalton/projects/socket-registry/registry/package.json`

```json
{
  "scripts": {
    "build": "pnpm run clean && pnpm run build:js && pnpm run build:types && pnpm run build:externals && pnpm run fix:exports",
    "build:js": "node scripts/build-js.mjs",
    "build:types": "tsgo --project tsconfig.dts.json --declaration --emitDeclarationOnly",
    "build:watch": "node scripts/build-js.mjs --watch",
    "check": "tsgo --noEmit"
  }
}
```

**Changes:**
- ✅ `build:ts` → `build:js` (esbuild instead of tsgo)
- ✅ `build:types` unchanged (keep tsgo for declarations)
- ✅ Added `build:watch` (watch mode with incremental builds)
- ✅ `check` unchanged (keep tsgo for type checking)

---

### Vitest Optimization: All Repos

#### Key Optimizations to Add

**1. Cache configuration**
```javascript
export default defineConfig({
  cacheDir: './.cache/vitest',
  test: {
    cache: {
      dir: './.cache/vitest',
    },
    // ... rest of config
  }
})
```

**2. Changed file detection**
```javascript
test: {
  // Only run tests related to changed files
  changed: process.env.VITEST_CHANGED === 'true',
  // Bail immediately if no changed files
  bail: process.env.VITEST_CHANGED === 'true' ? 0 : (process.env.CI ? 1 : 0),
}
```

**3. Fast bail on no changes**
```javascript
// In test runner script
const hasChanges = await checkForChanges()
if (!hasChanges && process.env.VITEST_CHANGED === 'true') {
  logger.success('No changes detected, skipping tests')
  return 0
}
```

**4. Optimized parallel execution**
```javascript
poolOptions: {
  threads: {
    singleThread: isCoverageEnabled,
    maxThreads: isCoverageEnabled ? 1 : os.cpus().length,
    minThreads: isCoverageEnabled ? 1 : Math.max(2, Math.floor(os.cpus().length / 2)),
    isolate: false, // Faster, but requires proper test cleanup
    useAtomics: true,
  },
}
```

**5. Timeout optimization**
```javascript
test: {
  testTimeout: 5_000,  // Reduced from 10_000
  hookTimeout: 5_000,  // Reduced from 10_000
  teardownTimeout: 1_000,
}
```

#### Updated Vitest Config Template

**For all 3 repos:**

```javascript
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isCoverageEnabled =
  process.env.COVERAGE === 'true' ||
  process.env.npm_lifecycle_event?.includes('coverage') ||
  process.argv.some(arg => arg.includes('coverage'))

const isChangedMode = process.env.VITEST_CHANGED === 'true'

export default defineConfig({
  cacheDir: './.cache/vitest',

  test: {
    // Cache configuration
    cache: {
      dir: './.cache/vitest',
    },

    // Changed file detection
    changed: isChangedMode,

    // Bail configuration
    // - Changed mode: don't bail (run all related tests)
    // - CI: bail on first failure
    // - Local: don't bail
    bail: isChangedMode ? 0 : (process.env.CI ? 1 : 0),

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: isCoverageEnabled,
        maxThreads: isCoverageEnabled ? 1 : os.cpus().length,
        minThreads: isCoverageEnabled ? 1 : Math.max(2, Math.floor(os.cpus().length / 2)),
        isolate: false,
        useAtomics: true,
      },
    },

    // Optimized timeouts
    testTimeout: 5_000,
    hookTimeout: 5_000,
    teardownTimeout: 1_000,

    // Concurrent execution within suites
    sequence: {
      concurrent: true,
    },

    // Rest of config...
  },
})
```

#### Test Runner Script Optimization

**Add to test.mjs:**

```javascript
/**
 * Check for changed files
 */
async function checkForChanges() {
  try {
    const { stdout } = await runCommandWithOutput('git', ['status', '--porcelain'])
    return stdout.trim().length > 0
  } catch {
    return true // Assume changes if git check fails
  }
}

/**
 * Run tests with optimizations
 */
async function runTests(options = {}) {
  const { changed = false, ...otherOptions } = options

  // Fast bail if no changes in changed mode
  if (changed) {
    const hasChanges = await checkForChanges()
    if (!hasChanges) {
      logger.success('No changes detected, skipping tests')
      return 0
    }
    process.env.VITEST_CHANGED = 'true'
  }

  // Run vitest
  // ... rest of implementation
}
```

---

## Expected Performance

### socket-registry Build Times

**Current:**
```
Clean:               100ms
build:ts (tsgo):    5000ms  ← SLOW
build:types (tsgo):  200ms
build:externals:     500ms
fix:exports:         100ms
─────────────────────────
Total:              5900ms
```

**After hybrid:**
```
Clean:               100ms
build:js (esbuild):  500ms  ← 10x FASTER
build:types (tsgo):  200ms  ← Same (already fast!)
build:externals:     500ms
fix:exports:         100ms
─────────────────────────
Total:              1400ms  ← 76% FASTER!
```

**Watch mode:**
```
First build:        1400ms
Incremental:         100ms  ← 93% FASTER!
```

### Vitest Performance

**Current:**
- All tests: ~30-60s
- Changed tests: ~20-40s
- No changes: Still runs (~5-10s)

**After optimization:**
- All tests: ~20-30s (↓33%)
- Changed tests: ~10-15s (↓50%)
- No changes: ~100ms (instant bail!) (↓98%)

---

## Implementation Checklist

### socket-registry
- [ ] Create `.config/esbuild.config.mjs`
- [ ] Create `scripts/build-js.mjs`
- [ ] Update `package.json` scripts
- [ ] Test production build
- [ ] Test watch mode
- [ ] Verify declarations still generated
- [ ] Update CLAUDE.md

### socket-sdk-js
- [ ] Already has hybrid build ✅
- [ ] Optimize vitest config (cache, bail)
- [ ] Add changed file detection
- [ ] Test performance

### socket-packageurl-js
- [ ] Already has hybrid build ✅
- [ ] Optimize vitest config (cache, bail)
- [ ] Add changed file detection
- [ ] Test performance

### All Repos
- [ ] Verify <20s test runs for changed files
- [ ] Verify instant bail when no changes
- [ ] Document new workflows
- [ ] Update CI if needed

---

## Commands Reference

### socket-registry (New)

```bash
# Production build (76% faster)
pnpm run build

# Watch mode with incremental builds
pnpm run build:watch

# Type checking only
pnpm run check

# Tests with optimizations
VITEST_CHANGED=true pnpm test  # Only changed files, instant bail
pnpm test                      # All tests
```

### socket-sdk-js & socket-packageurl-js (Enhanced)

```bash
# Watch mode (already working)
pnpm build --watch

# Tests with optimizations
VITEST_CHANGED=true pnpm test  # Only changed files, instant bail
pnpm test                      # All tests
```

---

## Success Criteria

### Build Performance
- ✅ socket-registry build: <2 seconds (from ~6s)
- ✅ socket-registry watch: <200ms rebuilds
- ✅ All repos have watch mode working
- ✅ Incremental builds functional

### Test Performance
- ✅ All tests: <30 seconds
- ✅ Changed files only: <20 seconds
- ✅ No changes: <200ms (instant bail)
- ✅ CI performance maintained

### Developer Experience
- ✅ Fast feedback loop (<1s for code changes)
- ✅ Instant test feedback for small changes
- ✅ No regression in test coverage
- ✅ Documentation updated

---

## Risks & Mitigation

### Risk 1: esbuild doesn't handle all TypeScript features
**Mitigation:** Keep tsgo for type checking, use esbuild only for compilation

### Risk 2: Test optimization breaks coverage
**Mitigation:** Only optimize non-coverage runs, keep coverage mode slow but thorough

### Risk 3: Changed file detection misses tests
**Mitigation:** Use conservative detection, when in doubt run all tests

### Risk 4: Watch mode breaks in monorepo
**Mitigation:** Test thoroughly, document any limitations

---

## Next Steps

1. **Implement socket-registry hybrid build** (2-3 hours)
2. **Optimize vitest configs** (1-2 hours)
3. **Add changed file detection** (1-2 hours)
4. **Test all changes** (1-2 hours)
5. **Document workflows** (1 hour)

**Total estimated time:** 6-10 hours
**Expected benefit:** 76% faster builds + <20s test runs

---

**Ready to proceed?** Start with socket-registry hybrid build, then optimize vitest across all repos.
