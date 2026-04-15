# @socketsecurity/lib

[![Socket Badge](https://socket.dev/api/badge/npm/package/@socketsecurity/lib)](https://socket.dev/npm/package/@socketsecurity/lib)
[![CI](https://github.com/SocketDev/socket-lib/actions/workflows/ci.yml/badge.svg)](https://github.com/SocketDev/socket-lib/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/badge/coverage-81%25-brightgreen)

[![Follow @SocketSecurity](https://img.shields.io/twitter/follow/SocketSecurity?style=social)](https://twitter.com/SocketSecurity)
[![Follow @socket.dev on Bluesky](https://img.shields.io/badge/Follow-@socket.dev-1DA1F2?style=social&logo=bluesky)](https://bsky.app/profile/socket.dev)

Core infrastructure library for [Socket.dev](https://socket.dev/) security tools. Provides utilities for file system operations, process spawning, HTTP requests, environment detection, logging, spinners, and more.

## Prerequisites

**Node.js 22 or higher** is required.

## Install

```bash
# Using pnpm (recommended)
pnpm add @socketsecurity/lib

# Using npm
npm install @socketsecurity/lib

# Using yarn
yarn add @socketsecurity/lib
```

## Quick Start

```typescript
import { Spinner } from '@socketsecurity/lib/spinner'
import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { readJson } from '@socketsecurity/lib/fs'

const logger = getDefaultLogger()
const spinner = Spinner({ text: 'Loading package.json...' })

spinner.start()
const pkg = await readJson('./package.json')
spinner.successAndStop('Loaded successfully')

logger.success(`Package: ${pkg.name}@${pkg.version}`)
```

## Documentation

- [Getting Started](./docs/getting-started.md) - Prerequisites, installation, and first examples
- [Visual Effects](./docs/visual-effects.md) - Spinners, loggers, themes, and progress indicators
- [File System](./docs/file-system.md) - File operations, globs, paths, and safe deletion
- [HTTP Utilities](./docs/http-utilities.md) - Making requests, downloading files, and retry logic
- [Process Utilities](./docs/process-utilities.md) - Spawning processes, IPC, and locks
- [Package Management](./docs/package-management.md) - npm/pnpm/yarn detection and operations
- [Environment](./docs/environment.md) - CI detection, env getters, and platform checks
- [Constants](./docs/constants.md) - Node versions, npm URLs, and platform values
- [Examples](./docs/examples.md) - Real-world usage patterns
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

## What's Inside

### Visual Effects

Spinners, colored loggers, themes, progress bars, and terminal output formatting.

- `Spinner` - Animated CLI spinners with progress tracking
- `getDefaultLogger()` - Colored console logger with symbols
- `LOG_SYMBOLS` - Colored terminal symbols (✓, ✗, ⚠, ℹ, →)
- `setTheme()` - Customize colors across the library

### File System

Cross-platform file operations with safe deletion and convenient wrappers.

- `readFileUtf8()`, `readFileBinary()` - Read files as text or binary
- `readJson()`, `writeJson()` - Parse and format JSON files
- `safeDelete()` - Protected deletion with safety checks
- `findUp()`, `findUpSync()` - Traverse up to find files
- `safeMkdir()` - Create directories without EEXIST errors
- `validateFiles()` - Check file readability (useful for Yarn PnP, pnpm)

### HTTP Utilities

Native Node.js HTTP/HTTPS requests with retry logic and redirects.

- `httpJson()` - Fetch and parse JSON from APIs
- `httpText()` - Fetch text/HTML content
- `httpDownload()` - Download files with progress callbacks
- `httpRequest()` - Full control over requests and responses
- Automatic redirects, exponential backoff retries, timeout support

### Process Management

Spawn child processes safely with cross-platform support.

- `spawn()` - Promise-based process spawning with output capture
- `spawnSync()` - Synchronous version for blocking operations
- Array-based arguments prevent command injection
- Automatic Windows `.cmd`/`.bat` handling
- `ProcessLock` - Ensure only one instance runs at a time
- `setupIPC()` - Inter-process communication

### Environment Detection

Type-safe environment variable access and platform detection.

- `getCI()` - Detect CI environment
- `getNodeEnv()` - Get NODE_ENV value
- `isTest()` - Check if running tests
- `getHome()` - Home directory (Unix/Linux/macOS)
- Test rewiring with `setEnv()`, `resetEnv()`

### Package Management

Detect and work with npm, pnpm, and yarn.

- `detectPackageManager()` - Identify package manager from lock files
- Package manifest operations
- Lock file management

### Constants

Pre-defined values for Node.js, npm, and platform detection.

- `getNodeMajorVersion()` - Get current Node.js major version
- `WIN32`, `DARWIN` - Platform booleans (use `!WIN32 && !DARWIN` for Linux)
- `getAbortSignal()` - Global abort signal

### Utilities

Helpers for arrays, objects, strings, promises, sorting, and more.

- Arrays, objects, strings manipulation
- Promise utilities and queues
- Natural sorting
- Version comparison
- Error handling with causes

## Features

- **Tree-shakeable exports** - Import only what you need
- **Cross-platform** - Works on Windows, macOS, and Linux
- **TypeScript-first** - Full type safety with .d.ts files
- **Zero dependencies** (for core HTTP - uses Node.js native modules)
- **Well-tested** - 6600+ tests across 145 test files
- **Security-focused** - Safe defaults, command injection protection
- **CommonJS output** - Compatible with Node.js tooling

## Common Use Cases

### Running Shell Commands

```typescript
import { spawn } from '@socketsecurity/lib/spawn'

const result = await spawn('git', ['status'])
console.log(result.stdout)
```

### Making API Requests

```typescript
import { httpJson } from '@socketsecurity/lib/http-request'

const data = await httpJson('https://api.example.com/data')
```

### Visual Feedback

```typescript
import { Spinner } from '@socketsecurity/lib/spinner'

const spinner = Spinner({ text: 'Processing...' })
spinner.start()
// ... do work ...
spinner.successAndStop('Complete!')
```

### Safe File Deletion

```typescript
import { safeDelete } from '@socketsecurity/lib/fs'

// Protected against deleting parent directories
await safeDelete('./build')
```

## Troubleshooting

**Module not found**: Verify you're importing from the correct path:

```typescript
// Correct
import { Spinner } from '@socketsecurity/lib/spinner'

// Wrong
import { Spinner } from '@socketsecurity/lib'
```

**Node version error**: This library requires Node.js 22+. Check your version:

```bash
node --version
```

For more issues, see the [Troubleshooting Guide](./docs/troubleshooting.md).

## Development

```bash
pnpm install    # Install dependencies
pnpm build      # Build the library
pnpm test       # Run tests
pnpm run cover  # Run tests with coverage
pnpm dev        # Watch mode
pnpm run lint   # Check code style
pnpm run fix    # Fix formatting issues
```

## Contributing

Contributions are welcome! Please read the [CLAUDE.md](./CLAUDE.md) file for development guidelines and coding standards.

## License

MIT
