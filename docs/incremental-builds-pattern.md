# Incremental Builds Pattern

Copy-paste pattern for adding esbuild incremental builds to Socket repos for **68% faster rebuilds**.

## Benefits

- ⚡ 68% faster rebuilds (9ms vs 27ms)
- 🔄 Automatic caching in watch mode
- 💾 In-memory module graph
- 🚀 Zero configuration
- ✅ Production builds unchanged

## Implementation

### Step 1: Update Build Script

```javascript
// Add context import
import { build, context } from 'esbuild'
```

### Step 2: Replace Watch Function

```javascript
async function watchBuild(options = {}) {
  const { quiet = false, verbose = false } = options

  if (!quiet) logger.step('Starting watch mode with incremental builds')

  try {
    const logLevel = quiet ? 'silent' : verbose ? 'debug' : 'warning'

    // Extract watch option (not valid for context())
    const { watch: _watchOpts, ...contextConfig } = watchConfig

    // Create context for incremental builds
    const ctx = await context({
      ...contextConfig,
      logLevel,
      plugins: [
        ...(contextConfig.plugins || []),
        {
          name: 'rebuild-logger',
          setup(build) {
            build.onEnd((result) => {
              if (result.errors.length > 0) {
                if (!quiet) logger.error('Rebuild failed')
              } else {
                if (!quiet) logger.success('Rebuild succeeded')
              }
            })
          }
        }
      ]
    })

    // Enable watch mode
    await ctx.watch()

    // Cleanup on exit
    process.on('SIGINT', async () => {
      await ctx.dispose()
      process.exitCode = 0
      throw new Error('Watch mode interrupted')
    })

    // Wait indefinitely
    await new Promise(() => {})
  } catch (error) {
    if (!quiet) logger.error('Watch mode failed:', error)
    return 1
  }
}
```

### Step 3: Update Help Text

```javascript
console.log('  --watch      Watch mode with incremental builds (68% faster rebuilds)')
```

### Step 4: Update CLAUDE.md

```markdown
### Commands
- **Watch**: `pnpm build --watch` (dev mode with 68% faster incremental builds)

**Tip:** Use `pnpm build --watch` for 68% faster rebuilds.
```

## Testing

```bash
# Start watch mode
pnpm build --watch

# Trigger rebuilds in another terminal
touch src/index.ts

# Should see rebuild under 10ms
```

## Key Points

**What Changes:**
- ✅ Watch mode uses context API
- ❌ Production builds unchanged

**Common Pitfalls:**
```javascript
// ❌ Wrong - don't pass watch to context()
const ctx = await context({ ...config, watch: { onRebuild: ... } })

// ✅ Right - extract watch first
const { watch: _watchOpts, ...contextConfig } = watchConfig
const ctx = await context(contextConfig)
await ctx.watch()
```

## Performance Validation

```bash
# Start watch and trigger 5 rebuilds
for i in {1..5}; do touch src/index.ts; sleep 1; done
```

**Expected:**
- First: ~26ms
- Next 4: ~9ms each

## Migration Checklist

- [ ] Import `context` from esbuild
- [ ] Replace watch function
- [ ] Extract `watch` property from config
- [ ] Add rebuild logger plugin
- [ ] Update help text
- [ ] Update CLAUDE.md
- [ ] Test and verify rebuild times

## Reference

- Implementation: `socket-sdk-js/scripts/build.mjs`
- Config: `socket-sdk-js/.config/esbuild.config.mjs`
- Docs: `socket-sdk-js/docs/incremental-builds.md`
