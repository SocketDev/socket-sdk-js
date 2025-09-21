# Publishing a new version

This repository uses `pnpm` and npm provenance through GitHub Actions. To publish a new version:

1. Update the version in `package.json`
2. Create a release using GitHub with an appropriate tag
3. The `.github/workflows/provenance.yml` action will automatically publish it to npm
