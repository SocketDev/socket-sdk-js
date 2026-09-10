# OpenAPI contracts

The SDK records both public API contracts:

| API | Snapshot          | Export                             |
| --- | ----------------- | ---------------------------------- |
| v0  | `openapi.json`    | `@socketsecurity/sdk/types/api`    |
| v1  | `openapi-v1.json` | `@socketsecurity/sdk/types/api-v1` |

The v0 schema names operations. The v1 schema describes operations through path keys.

```ts
import type { paths } from '@socketsecurity/sdk/types/api-v1'
import type { OpReturnType } from '@socketsecurity/sdk/types/api-helpers'

type VersionHistory = OpReturnType<
  paths['/v1/orgs/{org_slug}/purl/versions/{purl}']['get']
>
```

`OpReturnType` combines all successful response bodies, including NDJSON and binary responses.
A response without content contributes `undefined`.
`OpErrorType` combines the declared 4xx and 5xx response bodies.
The transport still determines whether a response contains JSON, NDJSON, or bytes.

Run `pnpm run generate-sdk` to download both schemas and regenerate their artifacts.
The generator validates both inputs and renders all artifacts before writing files.
External schema references must be bundled into the input document.

Run `pnpm run generate-sdk --offline` to regenerate from the recorded snapshots.
Run `pnpm run check:api-contracts` to verify local artifacts without network access or file changes.
Use `--v0-source PATH` and `--v1-source PATH` to read local upstream snapshots.
The generator records no source paths in its artifacts.

Run `pnpm run build` followed by `pnpm run check:package-artifact` to verify the published entry points and declaration imports.
The artifact check compiles a consumer from the package tarball with NodeNext resolution and library checks enabled.

The shared contract registry declares the generated file set.
The synchronization workflow validates both versions before opening or updating its pull request.
The workflow stages only declared artifacts on a branch from the checked-out default branch commit.

The PURL error schema permits an omitted `retryable` field.
The generator normalizes that field because non-retryable backend errors can omit it.
Multipart declarations retain named metadata types and allow those values in their index signature alongside file bytes.
