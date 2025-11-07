# Getting Started

Start using the Socket.dev SDK.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Git
- Socket.dev API key (for integration tests)

## Quick Start

### Clone & Setup

```bash
git clone https://github.com/SocketDev/socket-sdk-js.git
cd socket-sdk-js
pnpm install
pnpm test
```

Expected: ✓ 95% test coverage, ✓ 100% type coverage

### Project Structure

```
socket-sdk-js/
├── src/                  # Source code
│   ├── api/              # API client implementation
│   ├── types/            # TypeScript types
│   ├── utils/            # Helper utilities
│   └── index.ts          # Main SDK exports
│
├── test/                 # Tests
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
│
├── scripts/              # Build scripts
└── docs/                 # Documentation
    ├── api-reference.md  # Complete API docs
    ├── usage-examples.md # Code samples
    ├── when-to-use-what.md
    ├── quota-management.md
    └── dev/              # Developer docs
        └── testing.md
```

### Essential Commands

```bash
# Development
pnpm run dev         # Watch mode
pnpm build           # Production build

# Testing
pnpm test            # Run tests
pnpm run cover       # With coverage

# Quality
pnpm run check       # Type check + lint
pnpm run fix         # Auto-fix issues
```

## API Key Setup

For integration tests:

```bash
export SOCKET_API_KEY=your-api-key-here
```

Get your API key at [socket.dev/settings/api-keys](https://socket.dev/settings/api-keys)

## Development Workflow

1. Branch: `git checkout -b feature/my-change`
2. Implement changes in `src/`
3. Test: `pnpm test`
4. Verify: `pnpm run fix && pnpm test`
5. Update docs if needed
6. Commit with conventional commits
7. Submit pull request

## Key Concepts

### API Versioning

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

const sdk = new SocketSdk('your-api-key')
```

### Rate Limiting

Check API quotas before large operations. See [quota-management.md](./quota-management.md)

### Type Safety

Full TypeScript support:

```typescript
import type { PackageMetadata } from '@socketsecurity/sdk'

const metadata: PackageMetadata = await sdk.getPackage('npm', 'lodash')
```

### Error Handling

```typescript
const result = await sdk.getPackage('npm', 'nonexistent')

if (!result.success) {
  if (result.status === 404) {
    // Handle not found
  }
}
```

## Testing

Unit tests:

```typescript
import { describe, it, expect } from 'vitest'
import { parsePurl } from '../../../src/utils/parse-purl'

describe('parsePurl', () => {
  it('parses npm purl', () => {
    expect(parsePurl('pkg:npm/lodash@4.17.21')).toEqual({
      ecosystem: 'npm',
      name: 'lodash',
      version: '4.17.21'
    })
  })
})
```

Integration tests (requires API key):

```typescript
import { SocketSdk } from '../../src'

const sdk = new SocketSdk(process.env.SOCKET_API_KEY!)

it('fetches package metadata', async () => {
  const data = await sdk.getPackage('npm', 'lodash')
  expect(data.name).toBe('lodash')
})
```

## Additional Resources

- [API Reference](./api-reference.md)
- [Usage Examples](./usage-examples.md)
- [When to Use What](./when-to-use-what.md)
- [Quota Management](./quota-management.md)

## License

MIT
