# Publishing

**Requirements**: `pnpm` and npm provenance via GitHub Actions

**Steps**:
1. Update version in `package.json`
2. Create GitHub release with tag
3. `.github/workflows/provenance.yml` auto-publishes to npm
