Run the quality-scan skill and fix all issues found. Repeat until zero issues remain or 5 iterations complete.

## Process

1. Run quality-scan skill
2. If issues found: fix ALL of them
3. Run quality-scan again
4. Repeat until:
   - Zero issues found (success), OR
   - 5 iterations completed (stop)
5. Commit all fixes with message: "fix: resolve quality scan issues (iteration N)"

## Rules

- Fix every issue, not just "easy" ones
- Do not skip architectural fixes
- Run tests after fixes to verify nothing broke
- Track iteration count and report progress

## Outstanding Architectural Issue (Requires Design Review)

### Checkpoint Cache Invalidation (High Severity)

**Issue**: Source package changes don't invalidate checkpoints properly.

**Root Cause**: Cache keys are computed AFTER `prepareExternalSources()` syncs source packages to additions/. Since cache keys hash files in additions/ (which are now synced), they match the checkpoint even though source packages changed.

**Scenario**:
1. Developer modifies `packages/binject/src/socketsecurity/binject/file.c`
2. Runs `pnpm --filter node-smol-builder clean && pnpm build`
3. `prepareExternalSources()` syncs binject → additions/source-patched/src/socketsecurity/binject/
4. Cache key computed from additions/ files matches old checkpoint
5. Build restores stale checkpoint, skips recompilation
6. **Result**: Binary contains old binject code

**Impact**: Silent build incorrectness when modifying source packages

**Proposed Solutions** (require architectural review):
- Option 1: Include source package mtimes in cache key metadata
- Option 2: Make `prepareExternalSources()` idempotent, always re-sync

**Files Affected**:
- packages/node-smol-builder/scripts/common/shared/build.mjs (collectBuildSourceFiles)
- packages/node-smol-builder/scripts/common/shared/checkpoints.mjs (cache key generation)

**Status**: Documented for architectural review and future implementation
