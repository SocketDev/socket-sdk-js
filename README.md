# @socketsecurity/sdk

<a href="https://socket.dev/npm/package/@socketsecurity/sdk"><img src="https://socket.dev/api/badge/npm/package/@socketsecurity/sdk" alt="Socket Badge" height="20"></a>
![Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen)

[![Follow @SocketSecurity](https://img.shields.io/twitter/follow/SocketSecurity?style=social)](https://twitter.com/SocketSecurity)
[![Follow @socket.dev on Bluesky](https://img.shields.io/badge/Follow-@socket.dev-1DA1F2?style=social&logo=bluesky)](https://bsky.app/profile/socket.dev)

JavaScript SDK for the [Socket.dev](https://socket.dev/) API — package scoring, quota management, batch lookups, dependency analysis.

## Why this repo exists

`@socketsecurity/sdk` is the canonical JavaScript/TypeScript client for the Socket.dev API. It exists so any Node app — your build pipeline, your registry tooling, your custom security gate — can call Socket's package-scoring and analysis endpoints without hand-rolling auth, retries, and response shapes. The SDK is consumed by Socket's own CLI, MCP server, and third-party integrations.

## Install

```sh
pnpm add @socketsecurity/sdk
```

## Usage

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key', {
  retries: 3, // Retry failed requests up to 3 times
  retryDelay: 1000, // Start with 1s delay, exponential backoff
  timeout: 30000, // 30 second timeout
})

// Check your quota
const quota = await client.getQuota()
if (quota.success) {
  console.log(`Available quota: ${quota.data.quota} units`)
}

// Analyze a package
const result = await client.getScoreByNpmPackage('express', '4.18.0')
if (result.success) {
  console.log(`Dependency Score: ${result.data.depscore}`)
}

// Batch analyze multiple packages
const batchResult = await client.batchPackageFetch({
  components: [
    { purl: 'pkg:npm/express@4.18.0' },
    { purl: 'pkg:npm/react@18.0.0' },
  ],
})
```

## Development

<details>
<summary>Contributor commands</summary>

```sh
pnpm install
pnpm run build
pnpm test
pnpm run check
```

### Documentation map

| Guide                                              | Description                         |
| -------------------------------------------------- | ----------------------------------- |
| **[API Reference](./docs/api.md)**                 | Complete API method documentation   |
| **[Quota Management](./docs/quota-management.md)** | Cost tiers (0/10/100) and utilities |

</details>

## License

MIT
