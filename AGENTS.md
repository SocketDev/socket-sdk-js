# Socket SDK for JavaScript

The SDK provides a TypeScript client for the Socket API.

## Development

- Install dependencies with `pnpm install --frozen-lockfile`.
- Build with `pnpm run build`.
- Run tests with `pnpm test`.
- Run checks with `pnpm run check`.
- Generate API contracts with `pnpm run generate-sdk`.

## Conventions

- TypeScript source files use `.mts` and include an `@file` header.
- Use the SDK HTTP client helpers; do not call `fetch()` directly.
- Use `unknown` or a specific type instead of `any`.
- Keep tests under `test/`, mirroring source paths where practical.
- Keep platform-sensitive path behavior covered on Windows.
