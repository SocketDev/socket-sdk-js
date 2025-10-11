#!/bin/bash

# Clean rebase script - consolidates v2.0 commits into ~15 logical commits

echo "Creating clean v2.0 branch with consolidated commits..."

# Create a new branch from the last release
git checkout -b v2.0-clean v1.11.2

# Apply consolidated changes in logical groups
echo ""
echo "This script will guide you through applying consolidated commits."
echo "Each step will create one consolidated commit."
echo ""

# 1. Documentation improvements
echo "Step 1/11: Applying documentation improvements..."
git cherry-pick --no-commit 8a48458 ea6365a 4f66f44 e2e0d7c 2>/dev/null
git commit -m "docs: improve documentation structure and tone

- Simplify documentation language and remove marketing content
- Reorganize documentation structure for better clarity
- Add clarification that commit changes means creating actual commits
- Fix missing script references and documentation links" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 2. Build and configuration updates
echo "Step 2/11: Applying build and configuration updates..."
git cherry-pick --no-commit e6f4b7b 0d0b154 a68313d e701098 af81a42 82296d2 556faf7 b46a3e6 8bdfe11 94a8273 191b8e8 53d2129 f8b8184 2>/dev/null
git commit -m "build: update configuration and build system

- Standardize coverage configuration across the project
- Remove unused build configs and dependencies (oxlint, knip)
- Migrate config files to .config directory
- Update eslint config and restore coverage to 99%+" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 3. Dependencies
echo "Step 3/11: Applying dependency updates..."
git cherry-pick --no-commit f22c82d 1045efe 2>/dev/null
git commit -m "deps: update and clean up dependencies

- Add del package for clean script functionality
- Replace yargs-parser with registry parseArgs helper" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 4. Test improvements
echo "Step 4/11: Applying test improvements..."
git cherry-pick --no-commit cc53fd0 8e940dc d75277d a79bd10 0af51f4 9e2043f ec1cd58 0fd0a8f 7aacaae 4b056ad 9c80207 12e09a2 72689ff 2>/dev/null
git commit -m "test: improve test infrastructure and coverage

- Add shared error test helpers for common patterns
- Update tests to match new API types and behaviors
- Increase timeouts for network-related tests
- Add coverage for various edge cases
- Align test infrastructure with socket-registry conventions" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 5. Script tooling
echo "Step 5/11: Applying script tooling improvements..."
git cherry-pick --no-commit 01ac05b ad4bf4e 9fd9c8f e805bd2 d508f36 eae7dd1 2f26bcd a04348c 0c43e02 a1852bc 3e635ed e7e8c43 72fedcf b0b79a0 2334f64 245c9ef 1e737cc 045fb87 742d65a ad80f60 2>/dev/null
git commit -m "refactor: enhance script tooling and utilities

- Complete overhaul of claude.mjs with enhanced operations
- Update bump, fix, update, and publish scripts
- Convert async IIFE to main().catch pattern
- Add lint-affected script for smart linting
- Fix various script utilities and paths" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 6. API token validation
echo "Step 6/11: Applying API token validation..."
git cherry-pick --no-commit cc53fd0 2>/dev/null
git commit -m "feat: add API token validation" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 7. HTTP client enhancements
echo "Step 7/11: Applying HTTP client enhancements..."
git cherry-pick --no-commit 5074f6c 8e357dc 3399d38 d800553 9e8de97 2>/dev/null
git commit -m "feat: add HTTP client enhancements

- Add default HTTP timeout for API requests
- Add response size limits to HTTP client
- Implement 429 rate limit handling with Retry-After header support
- Add resilient defaults and stream size limits" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 8. OpenAPI updates
echo "Step 8/11: Applying OpenAPI type updates..."
git cherry-pick --no-commit c4ef0db 7eb9d1d 2>/dev/null
git commit -m "feat: update OpenAPI types and SDK methods

- Update OpenAPI type definitions with latest API schema
- Update source code to align with new API types" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 9. File reorganization
echo "Step 9/11: Applying file structure reorganization..."
git cherry-pick --no-commit e70e487 6c94ac3 2>/dev/null
git commit -m "refactor: reorganize file structure and requirements

- Move requirements.json to data/sdk-method-requirements.json
- Update quota-utils to use new requirements path" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 10. Bug fixes
echo "Step 10/11: Applying various bug fixes..."
git cherry-pick --no-commit bd43e38 c3970d8 fe1def1 1541d4f 5c9836c 99491e4 2>/dev/null
git commit -m "fix: various bug fixes and improvements

- Remove custom retry delay logic from onRetry callback
- Clean up lint and test scripts
- Add c8 ignore comments for hard-to-test code
- Various minor fixes and improvements" 2>/dev/null || echo "Skipped (conflicts or already applied)"

# 11. ESM migration
echo "Step 11/11: Applying ESM migration..."
git cherry-pick --no-commit 5755c81 ac6f430 2>/dev/null
git commit -m "feat: migrate to ESM and bump to v2.0.0

- Convert project to ESM module type
- Update all build configurations for ESM
- Bump version to 2.0.0
- Lower coverage thresholds to 99%" 2>/dev/null || echo "Skipped (conflicts or already applied)"

echo ""
echo "Consolidation attempt complete!"
echo ""
echo "Final commit count:"
git log --oneline v1.11.2..HEAD | wc -l
echo ""
echo "To see the new history: git log --oneline v1.11.2..HEAD"
echo "To switch branches:"
echo "  - Keep clean version: git branch -D v2.0 && git branch -m v2.0"
echo "  - Restore original: git checkout v2.0"