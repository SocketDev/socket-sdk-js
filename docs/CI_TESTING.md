# CI Testing Guide

## Overview

This project uses a comprehensive CI testing solution inspired by socket-registry's testing infrastructure. The solution provides:

- **Multi-platform testing**: Linux, Windows, and macOS support
- **Multi-version Node.js matrix**: Test across Node.js 20, 22, and 24
- **Flexible configuration**: Customizable test scripts, timeouts, and artifact uploads
- **Memory optimization**: Configured heap sizes for CI and local environments
- **Cross-platform compatibility**: Handles Windows and POSIX path differences

## Workflow Structure

### Reusable Test Workflow

Located at `.github/workflows/_reusable-test.yml`, this workflow provides a flexible testing foundation that can be customized per project.

**Key Features:**
- Matrix testing across Node.js versions and operating systems
- Configurable setup scripts for build steps
- Artifact upload support for coverage reports
- Debug mode for verbose logging
- Timeout protection for long-running tests

### Main Test Workflow

Located at `.github/workflows/test.yml`, this workflow calls the reusable workflow with project-specific configuration:

```yaml
jobs:
  test:
    uses: ./.github/workflows/_reusable-test.yml
    with:
      setup-script: 'pnpm run build'
      node-versions: '[20, 22, 24]'
      os-versions: '["ubuntu-latest", "windows-latest"]'
      test-script: 'pnpm run test-ci'
      timeout-minutes: 10
      upload-artifacts: false
```

## Configuration Options

### Input Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `node-versions` | Array of Node.js versions to test | `[20, 22, 24]` |
| `os-versions` | Array of operating systems | `["ubuntu-latest", "windows-latest"]` |
| `test-script` | Test command to execute | `pnpm run test-ci` |
| `setup-script` | Pre-test setup command | `''` |
| `timeout-minutes` | Job timeout in minutes | `10` |
| `upload-artifacts` | Upload test artifacts | `false` |
| `fail-fast` | Cancel all jobs if one fails | `true` |
| `max-parallel` | Maximum parallel jobs | `4` |
| `continue-on-error` | Continue on job failure | `false` |

### Matrix Configuration

**Excluding specific combinations:**
```yaml
matrix-exclude: '[{"node-version": 20, "os": "windows-latest"}]'
```

**Adding custom combinations:**
```yaml
matrix-include: '[{"node-version": "25-nightly", "os": "ubuntu-latest"}]'
```

## Test Scripts

### Custom Test Runner

The `scripts/test.mjs` runner provides:
- **Force flag support**: `--force` to run all tests
- **Glob pattern expansion**: `test/**/*.test.mts`
- **Memory optimization**: Automatic heap size configuration
- **Cross-platform support**: Windows `.cmd` handling

**Usage:**
```bash
# Run all tests
pnpm run test:run

# Run with force flag
node scripts/test.mjs --force

# Run specific pattern
node scripts/test.mjs test/unit/*.test.mts
```

### Test Utilities

Located at `scripts/utils/tests.mjs`, provides:
- CLI argument parsing
- Test filtering based on environment
- Force flag detection
- CI detection

## Memory Configuration

The test runner automatically configures Node.js memory settings:

- **CI environments**: 8GB heap size (`--max-old-space-size=8192`)
- **Local development**: 4GB heap size (`--max-old-space-size=4096`)
- **Semi-space**: 512MB for improved GC performance

These settings are defined in:
1. `scripts/test.mjs` (for custom runner)
2. `.env.test` (for vitest direct execution)
3. `vitest.config.mts` (pool configuration)

## Cross-Platform Compatibility

### Path Handling

All path operations use cross-platform utilities:
- `path.join()` for path construction
- `path.sep` for separator character
- `os.tmpdir()` for temporary directories

### Platform Detection

```javascript
const WIN32 = process.platform === 'win32'
const vitestCmd = WIN32 ? 'vitest.cmd' : 'vitest'
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CI` | Detect CI environment |
| `FORCE_TEST` | Force all tests to run |
| `PRE_COMMIT` | Detect pre-commit hook |
| `NODE_OPTIONS` | Node.js runtime options |
| `DEBUG` | Enable debug logging |

## Artifact Management

When `upload-artifacts: true`:
- Coverage reports uploaded to GitHub Actions
- Test results preserved for debugging
- Artifacts named: `test-results-{os}-node-{version}`
- Default retention: 7 days

## Best Practices

### 1. Use Reusable Workflow

Always use the reusable workflow for consistency:
```yaml
uses: ./.github/workflows/_reusable-test.yml
```

### 2. Configure Timeouts

Set appropriate timeouts for your test suite:
```yaml
timeout-minutes: 10  # Adjust based on suite size
```

### 3. Platform-Specific Tests

Use matrix exclude for platform-specific issues:
```yaml
matrix-exclude: '[{"node-version": 24, "os": "windows-latest"}]'
```

### 4. Memory Optimization

For large test suites, consider:
- Sequential test execution (configured in `vitest.config.mts`)
- Single fork mode to prevent memory leaks
- Isolated test environments

### 5. Debug Mode

Enable debug mode for troubleshooting:
```yaml
debug: '1'
```

## Local Testing

### Run Full Test Suite
```bash
pnpm test
```

### Run with Coverage
```bash
pnpm run test:unit:coverage
```

### Get Coverage Percentage
```bash
pnpm run coverage:percent
```

### Custom Test Runner
```bash
pnpm run test:run
```

## Troubleshooting

### Out of Memory Errors

1. Check `NODE_OPTIONS` in `.env.test`
2. Verify vitest pool configuration
3. Consider reducing `max-parallel` in workflow

### Windows-Specific Issues

1. Ensure paths use `path.join()`
2. Check for `.cmd` file handling
3. Verify shell: true for Windows spawns

### Test Timeouts

1. Increase `timeout-minutes` in workflow
2. Check `testTimeout` in `vitest.config.mts`
3. Review individual test timeouts

### Coverage Gaps

1. Run `pnpm run coverage:percent` locally
2. Check `vitest.config.mts` coverage thresholds
3. Review `c8 ignore` comments for justification

## Integration with socket-registry

This testing solution is aligned with socket-registry patterns:
- Reusable workflow structure
- Memory optimization strategies
- Cross-platform compatibility
- Test coordination utilities

For consistency across Socket projects, follow the patterns established in socket-registry and documented here.

## Future Enhancements

Potential improvements:
- Coverage thresholds in CI
- Parallel test execution strategies
- Test result comparison across runs
- Performance benchmarking integration
- Automated test generation from coverage gaps
