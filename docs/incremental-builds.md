# Incremental Builds

Socket SDK uses esbuild's context API for watch mode with **68% faster rebuilds** (9ms vs 27ms).

## Usage

```bash
# Watch mode (development)
pnpm build --watch

# Standard build (production/CI)
pnpm build
```

## Performance

| Build Type | Time | Speedup |
|------------|------|---------|
| Standard | ~27ms | baseline |
| First incremental | ~26ms | ~4% |
| Cached rebuild | **~9ms** | **68% faster** |

## How It Works

**Context API:**
- esbuild creates a persistent build context
- Module graph cached in memory
- Only changed files reprocessed

**Benefits:**
- Sub-10ms rebuilds for instant feedback
- No disk I/O for cached modules
- Lower CPU usage

## Configuration

Watch config in `.config/esbuild.config.mjs`:

```javascript
export const watchConfig = {
  ...buildConfig,
  minify: false,        // Faster dev builds
  sourcemap: 'inline',  // Better debugging
  logLevel: 'debug'     // Detailed output
}
```

## Troubleshooting

**Slow rebuilds?**
- Ensure using `pnpm build --watch` not `pnpm build`
- Check for large dependencies or circular imports
- Restart watch mode if memory grows

**High memory?**
- Restart watch mode periodically
- Expected: module graph kept in memory

## Best Practices

1. **Development**: Always use `pnpm build --watch`
2. **Keep running**: Don't restart for every change
3. **Before commit**: Run full build with `pnpm build`

## Implementation

See `scripts/build.mjs` (lines 142-198) for the implementation using esbuild's `context()` API.

For applying this pattern to other projects, see `incremental-builds-pattern.md`.
