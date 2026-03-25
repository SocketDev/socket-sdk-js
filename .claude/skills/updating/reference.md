# updating Reference Documentation

## Table of Contents

1. [How the Update Script Works](#how-the-update-script-works)
2. [Files Changed After Update](#files-changed-after-update)
3. [Validation Commands](#validation-commands)
4. [Troubleshooting](#troubleshooting)

---

## How the Update Script Works

`pnpm run update` runs `scripts/update.mjs` which performs:

```bash
# 1. Run taze recursively with write mode
pnpm exec taze -r -w

# 2. Force-update Socket scoped packages (bypasses taze maturity period)
pnpm update @socketsecurity/* @socketregistry/* @socketbin/* --latest -r

# 3. pnpm install runs automatically to reconcile lockfile
```

### Repo Structure

- **Single package** (not a monorepo, no `packages/` directory)
- Has both `dependencies` and `devDependencies` (published package)
- Runtime deps: `@socketregistry/packageurl-js`, `@socketsecurity/lib`, `form-data`
- Dependencies pinned to exact versions in `package.json`

---

## Files Changed After Update

- `package.json` - Dependency version pins (both deps and devDeps)
- `pnpm-lock.yaml` - Lock file

---

## Validation Commands

```bash
# Fix lint issues
pnpm run fix --all

# Run all checks (lint + type check)
pnpm run check --all

# Run tests
pnpm test
```

---

## Troubleshooting

### taze Fails to Detect Updates

**Cause:** taze has a maturity period for new releases.
**Solution:** Socket packages are force-updated separately via `pnpm update --latest`.

### Lock File Conflicts

**Solution:**
```bash
rm pnpm-lock.yaml
pnpm install
```

### SDK Regeneration

If `@socketsecurity/lib` is updated, the generated SDK types may need
regeneration via `pnpm run generate-sdk`. Check if API types in `types/`
are still valid after updating.
