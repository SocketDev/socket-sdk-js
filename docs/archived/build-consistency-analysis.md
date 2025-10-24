# Build System Consistency Analysis

## Current State

### Project Build Configurations

#### socket-cli
- **Pattern**: Base config + dist config (2 files)
- **Location**: `.config/rollup.base.config.mjs` + `.config/rollup.dist.config.mjs`
- **Complexity**: HIGH - Many custom plugins, transforms, and bundling logic
- **Babel**: Uses `@babel/plugin-transform-runtime` + `@babel/preset-typescript`
- **Features**: Custom socketModifyPlugin, purgePolyfills, complex manualChunks

#### socket-registry/registry
- **Pattern**: Single dist config (1 file)
- **Location**: `.config/rollup.dist.config.mjs` + custom `scripts/rollup/build-source.mjs`
- **Complexity**: MEDIUM - Self-contained, uses fast-glob for inputs
- **Babel**: Uses `@babel/plugin-transform-runtime` + `@babel/preset-typescript`
- **Features**: Replace plugin for node: prefixes, builds all TS files automatically

#### socket-sdk-js (just migrated)
- **Pattern**: Base config + dist config (2 files)
- **Location**: `.config/rollup.base.config.mjs` + `.config/rollup.dist.config.mjs`
- **Complexity**: LOW - Minimal, clean setup
- **Babel**: Uses `@babel/plugin-transform-runtime` + `@babel/preset-typescript`
- **Features**: Basic setup, no special plugins

#### socket-packageurl-js (just migrated)
- **Pattern**: Base config + dist config (2 files)
- **Location**: `.config/rollup.base.config.mjs` + `.config/rollup.dist.config.mjs`
- **Complexity**: LOW - Minimal, clean setup
- **Babel**: Uses `@babel/plugin-transform-runtime` + `@babel/preset-typescript`
- **Features**: preserveModules for individual files, treeshake disabled

## Problems

### 1. **Inconsistent Patterns**
- socket-registry uses single file + custom script
- Others use base + dist pattern
- No code sharing between projects

### 2. **Code Duplication**
- `rollup.base.config.mjs` duplicated across socket-cli, socket-sdk-js, socket-packageurl-js
- `babel.config.js` duplicated across ALL projects
- Similar plugin configurations repeated

### 3. **Unnecessary Complexity**
- socket-cli has many project-specific transforms that obscure the core build logic
- socket-registry custom scripts add indirection
- Base configs contain logic that could be simplified

### 4. **Build Scripts**
- socket-registry: Custom Node scripts
- socket-cli: Rollup CLI
- socket-sdk-js: Rollup CLI
- socket-packageurl-js: Rollup CLI

## KISS Solution

### Proposed Standard Pattern

**Create ONE shared base config in socket-registry that all projects can import**

```
socket-registry/
  .config/
    rollup.shared.base.config.mjs  ← NEW: Shared base config
    babel.shared.config.js         ← NEW: Shared Babel config
```

**Each project has minimal dist config**

```
socket-cli/
  .config/
    rollup.dist.config.mjs  ← Imports shared base, adds project-specific logic

socket-registry/registry/
  .config/
    rollup.dist.config.mjs  ← Imports shared base

socket-sdk-js/
  .config/
    rollup.dist.config.mjs  ← Imports shared base

socket-packageurl-js/
  .config/
    rollup.dist.config.mjs  ← Imports shared base
```

### Benefits

1. **Single source of truth** - One base config to maintain
2. **Consistency** - All projects use same Babel/Rollup setup
3. **Simplicity** - Project configs only contain project-specific logic
4. **Maintainability** - Updates to shared config benefit all projects
5. **Clarity** - Clear separation: shared vs project-specific

### Implementation Plan

1. **Create shared configs** in socket-registry
   - `rollup.shared.base.config.mjs` - Core Rollup setup
   - `babel.shared.config.js` - Standard Babel preset

2. **Update socket-cli** - Import shared base, keep only custom transforms
3. **Update socket-registry** - Simplify to use shared base
4. **Update socket-sdk-js** - Replace local base with shared import
5. **Update socket-packageurl-js** - Replace local base with shared import

6. **Test all builds** - Ensure output is identical

### Shared Base Config Features

**Core setup (everyone needs):**
- Node.js built-in externalization
- Node resolve plugin
- JSON plugin
- CommonJS plugin
- Babel plugin with runtime helpers
- TypeScript preset
- Warning suppression (INVALID_ANNOTATION, THIS_IS_UNDEFINED)

**Configurable (via options):**
- Additional external packages
- Custom plugins
- Treeshaking behavior
- Entry points

### Example Usage

```js
// socket-sdk-js/.config/rollup.dist.config.mjs
import createBaseConfig from '../../../socket-registry/.config/rollup.shared.base.config.mjs'

export default async () => {
  return createBaseConfig({
    input: {
      index: './src/index.ts',
      testing: './src/testing.ts'
    },
    external: ['@socketsecurity/registry'],
    output: {
      dir: 'dist',
      format: 'cjs'
    }
  })
}
```

## Conclusion

By centralizing the build configuration in socket-registry and having each project import and extend it, we achieve:

- **Consistency** across all Socket projects
- **Simplicity** - KISS principle applied
- **Maintainability** - One place to update core build logic
- **Flexibility** - Projects can still add custom transforms when needed

This is the Socket way: shared infrastructure, clear patterns, minimal duplication.
