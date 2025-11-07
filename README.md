# @socketsecurity/sdk

[![Socket Badge](https://socket.dev/api/badge/npm/package/@socketsecurity/sdk)](https://socket.dev/npm/package/@socketsecurity/sdk)
[![CI](https://github.com/SocketDev/socket-sdk-js/actions/workflows/ci.yml/badge.svg)](https://github.com/SocketDev/socket-sdk-js/actions/workflows/ci.yml)
![Test Coverage](https://img.shields.io/badge/test--coverage-75%25-yellow)
![Type Coverage](https://img.shields.io/badge/type--coverage-99.58%25-brightgreen)

[![Follow @SocketSecurity](https://img.shields.io/twitter/follow/SocketSecurity?style=social)](https://twitter.com/SocketSecurity)
[![Follow @socket.dev on Bluesky](https://img.shields.io/badge/Follow-@socket.dev-1DA1F2?style=social&logo=bluesky)](https://bsky.app/profile/socket.dev)

JavaScript SDK for [Socket.dev](https://socket.dev/) API.

## Install

```bash
pnpm add @socketsecurity/sdk
```

## Usage

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk('your-api-key', {
  retries: 3,        // Retry failed requests up to 3 times
  retryDelay: 1000,  // Start with 1s delay, exponential backoff
  timeout: 30000,    // 30 second timeout
})

// Check your quota
const quota = await client.getQuota()
if (quota.success) {
  console.log(`Available quota: ${quota.data.quota} units`)
}

// Analyze a package
const result = await client.getScoreByNpmPackage('express', '4.18.0')
if (result.success) {
  console.log(`Security Score: ${result.data.score}/100`)
}

// Batch analyze multiple packages
const batchResult = await client.batchPackageFetch({
  components: [
    { purl: 'pkg:npm/express@4.18.0' },
    { purl: 'pkg:npm/react@18.0.0' }
  ]
})
```

## Documentation

| Guide | Description |
|-------|-------------|
| **[Getting Started](./docs/getting-started.md)** | Quick start for contributors (5 min setup) |
| **[API Reference](./docs/api-reference.md)** | Complete API method documentation |
| **[Usage Examples](./docs/usage-examples.md)** | Real-world patterns and code samples |
| **[Quota Management](./docs/quota-management.md)** | Cost tiers (0/10/100) and utilities |
| **[Testing Guide](./docs/dev/testing.md)** | Test helpers, fixtures, and patterns |
| **[Method Reference](./docs/when-to-use-what.md)** | Quick method selection guide |

## Examples

See **[usage-examples.md](./docs/usage-examples.md)** for complete examples including:
- Package security analysis
- Batch operations
- Full scans with SBOM
- Policy management
- Quota planning

## License

MIT
