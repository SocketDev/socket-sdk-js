# v3.0 Implementation Status

This document tracks the progress of the v3.0 SDK refactor.

## ✅ Completed

### Phase 1: Type System ✓
- [x] Created `src/types-strict.ts` with non-optional required fields
- [x] Defined all major strict result types:
  - `FullScanListResult`, `FullScanResult`, `FullScanItem`
  - `OrganizationsResult`, `OrganizationItem`
  - `RepositoriesListResult`, `RepositoryItem`
  - `LegacyScanListResult`, `LegacyScanItem`
  - `DeleteResult`, `StrictErrorResult`
- [x] Created options types: `ListFullScansOptions`, `CreateFullScanOptions`, etc.
- [x] Exported all strict types from `src/index.ts`

### Phase 2: Method Refactoring (Partial) ✓
Completed methods with new names and strict types:

**Full Scans:**
- [x] `listFullScans()` (was `getOrgFullScanList`)
- [x] `createFullScan()` (was `createOrgFullScan`)
- [x] `getFullScan()` (was `getOrgFullScanBuffered`)
- [x] `deleteFullScan()` (was `deleteOrgFullScan`)

**Organizations:**
- [x] `listOrganizations()` (was `getOrganizations`)

### Phase 3: Documentation ✓
- [x] Created comprehensive `docs/MIGRATION_V3.md`
  - Complete method rename mappings
  - Type system changes with examples
  - Before/after comparisons
  - Migration patterns
- [x] Created `docs/WHEN_TO_USE_WHAT.md`
  - Decision trees
  - Modern vs legacy comparison
  - Common patterns
  - Method reference by category
- [x] Added detailed JSDoc to all updated methods
  - Examples with code blocks
  - API endpoint URLs
  - Quota costs
  - Required scopes

### Phase 5: Release Prep ✓
- [x] Updated `package.json` to v3.0.0
- [x] Created comprehensive CHANGELOG entry
- [x] Documented all breaking changes
- [x] Listed all new types and features

## 🔄 In Progress / TODO

### Phase 2: Remaining Method Refactoring

**Full Scans (still need updating):**
- [ ] `streamFullScan()` (was `streamOrgFullScan`)
- [ ] `getFullScanMetadata()` (was `getOrgFullScanMetadata`)

**Repositories (need updating):**
- [ ] `listRepositories()` (was `getOrgRepoList`)
- [ ] `getRepository()` (was `getOrgRepo`)
- [ ] `createRepository()` (was `createOrgRepo`)
- [ ] `updateRepository()` (was `updateOrgRepo`)
- [ ] `deleteRepository()` (was `deleteOrgRepo`)
- [ ] `listRepositoryLabels()` (was `getOrgRepoLabelList`)
- [ ] `getRepositoryLabel()` (was `getOrgRepoLabel`)
- [ ] `createRepositoryLabel()` (was `createOrgRepoLabel`)
- [ ] `updateRepositoryLabel()` (was `updateOrgRepoLabel`)
- [ ] `deleteRepositoryLabel()` (was `deleteOrgRepoLabel`)

**Legacy Scans (need updating):**
- [ ] `listScans()` (was `getScanList`)
- [ ] `getScan()` (keep same name, update docs)
- [ ] `createScan()` (was `createScanFromFilepaths`)
- [ ] `deleteScan()` (was `deleteReport`)

**Other methods needing updates:**
- [ ] All diff scan methods
- [ ] All repository analytics methods
- [ ] All settings methods
- [ ] All API token methods
- [ ] All patch methods
- [ ] All triage methods
- [ ] All policy methods
- [ ] All SBOM export methods
- [ ] All dependency methods

### Phase 4: Test Updates

**Critical Tests to Update:**
- [ ] Update `test/socket-sdk-api-methods.coverage.test.mts`
  - Change all method calls to new names
  - Update assertions for strict types
- [ ] Update `test/socket-sdk-validation.test.mts`
  - Verify new method signatures
  - Test options type changes
- [ ] Update `test/socket-sdk-batch.test.mts`
  - If any renamed methods are used
- [ ] Update `test/quota-utils.test.mts`
  - Update method name references

**New Tests Needed:**
- [ ] Runtime validation tests for strict types
- [ ] Test that required fields are actually present
- [ ] Test flattened options structures
- [ ] Integration tests for migration patterns

### Phase 4: Type Validation

**Optional additions:**
- [ ] Add runtime type guards for strict types
- [ ] Add validation that API responses match strict schemas
- [ ] Create helper to validate FullScanItem fields
- [ ] Create helper to validate OrganizationItem fields

## 📊 Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Type System | ✅ Complete | 100% |
| Phase 2: Method Refactoring | 🔄 Partial | ~15% (5/40+ methods) |
| Phase 3: Documentation | ✅ Complete | 100% |
| Phase 4: Tests | ❌ Not Started | 0% |
| Phase 5: Release Prep | ✅ Complete | 100% |
| **Overall** | 🔄 **In Progress** | **~35%** |

## 🎯 Recommended Next Steps

### High Priority (Required for v3.0 release)

1. **Complete method refactoring** (Priority: CRITICAL)
   - Finish all full scan methods
   - Update all repository methods
   - Update legacy scan methods
   - Follow the pattern established in completed methods

2. **Update test suite** (Priority: CRITICAL)
   - Update all test files to use new method names
   - Fix any broken assertions
   - Ensure tests pass

3. **Type checking** (Priority: HIGH)
   - Run `pnpm tsc` to check for type errors
   - Fix any compilation issues
   - Ensure strict types compile correctly

### Medium Priority (Nice to have)

4. **Add runtime validation** (Priority: MEDIUM)
   - Optional but recommended
   - Catch API schema mismatches early
   - Better error messages

5. **Update README** (Priority: MEDIUM)
   - Add v3.0 highlights
   - Update code examples
   - Link to migration guide

### Low Priority (Post-release)

6. **Create migration tools** (Priority: LOW)
   - Codemod script for automated migration
   - AST transformation for method renames
   - Helper to detect v2.x usage

## 🚀 Release Checklist

Before publishing v3.0.0:

- [ ] All methods refactored and documented
- [ ] All tests updated and passing
- [ ] `pnpm build` succeeds
- [ ] `pnpm check` passes (lint, type-check)
- [ ] `pnpm test` passes all tests
- [ ] Manual smoke testing of key methods
- [ ] README updated with v3 examples
- [ ] Migration guide reviewed
- [ ] Tag release: `git tag v3.0.0`
- [ ] Push to GitHub: `git push origin main --tags`
- [ ] Publish to npm: `npm publish`

## 📝 Notes

### Why Partial Implementation?

The v3.0 refactor involves updating 40+ SDK methods and their corresponding tests. The work completed so far demonstrates the pattern and establishes:

1. ✅ **Foundation:** Strict type system with better DX
2. ✅ **Examples:** 5 key methods refactored as reference
3. ✅ **Documentation:** Complete migration guides for users
4. ✅ **Release prep:** Version bumped, changelog ready

### Completing the Implementation

To finish v3.0, systematically apply the same pattern to remaining methods:

```typescript
// Pattern established:
async newMethodName(
  params: Type,
  options?: OptionsType
): Promise<StrictResultType | StrictErrorResult> {
  try {
    const data = await this.#executeWithRetry(/* ... */)
    return {
      cause: undefined,
      data: data as StrictType,
      error: undefined,
      status: 200,
      success: true,
    }
  } catch (e) {
    const errorResult = await this.#handleApiError<'operation'>(e)
    return {
      cause: errorResult.cause,
      data: undefined,
      error: errorResult.error,
      status: errorResult.status,
      success: false,
    }
  }
}
```

### Time Estimate

Remaining work (realistic estimates):
- Method refactoring: ~8-10 hours (35+ methods)
- Test updates: ~4-6 hours
- Type checking fixes: ~2-3 hours
- Manual testing: ~1-2 hours
- **Total: ~15-21 hours**

### Current State

The SDK is in a **transition state**:
- ✅ Core infrastructure complete
- ✅ Pattern established
- ✅ Documentation ready
- 🔄 Partial method coverage
- ❌ Tests not yet updated

**Can release as v3.0.0-beta.1** for early testing, or complete remaining work for v3.0.0 stable.

## 🤝 Contributing

If continuing this work:

1. Follow the established pattern from completed methods
2. Update tests as you rename methods
3. Run `pnpm build && pnpm test` frequently
4. Commit in logical groups (e.g., "Update repository methods")
5. Reference this document for tracking

## 📚 References

- Migration Guide: `docs/MIGRATION_V3.md`
- Usage Guide: `docs/WHEN_TO_USE_WHAT.md`
- Strict Types: `src/types-strict.ts`
- Changelog: `CHANGELOG.md`
