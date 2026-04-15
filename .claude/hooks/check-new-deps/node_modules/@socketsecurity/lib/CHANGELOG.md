# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.18.2](https://github.com/SocketDev/socket-lib/releases/tag/v5.18.2) - 2026-04-14

### Removed

- Remove unused `plugins/` directory and `./plugins/babel-plugin-inline-require-calls` export — no downstream consumers; socket-cli maintains its own local copies

## [5.18.1](https://github.com/SocketDev/socket-lib/releases/tag/v5.18.1) - 2026-04-14

### Changed — build

- Dedup npm-pack.js bundle via pnpm overrides: pacote 21.5.0, make-fetch-happen 15.0.5, and 7 transitive npm packages (npm-bundled, npm-normalize-package-bin, json-parse-even-better-errors, @npmcli/installed-package-contents, @npmcli/name-from-folder, @npmcli/promise-spawn, @npmcli/redact)
- npm-pack.js: 69,738 → 66,443 lines (2.59MB → 2.46MB), 22 duplicate packages removed

## [5.18.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.18.0) - 2026-04-14

### Added — dlx

- Socket Firewall API check before package downloads — resolves dependency tree via `buildIdealTree`, checks all packages against `firewall-api.socket.dev/purl` in parallel, blocks on critical/high severity alerts

### Changed — http-request

- Default `User-Agent` header updated from `socket-registry/1.0` to `socketsecurity-lib/{version}`

## [5.17.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.17.0) - 2026-04-14

### Added — paths

- `isUnixPath()` — detect MSYS/Git Bash drive letter notation (`/c/...`)

### Changed — paths

- `normalizePath()` now converts MSYS drive letters on Windows (`/c/path` → `C:/path`)
- `fromUnixPath()` now produces native Windows paths with backslashes (`/c/path` → `C:\path`), making it the true inverse of `toUnixPath()`

## [5.16.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.16.0) - 2026-04-14

### Added — paths

- `fromUnixPath()` — convert MSYS/Git Bash Unix-style paths (`/c/path`) back to native Windows format (`C:/path`), inverse of `toUnixPath` (#168)

### Fixed — dlx

- Normalize dlx directory path in `isInSocketDlx` for Windows compatibility

## [5.15.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.15.0) - 2026-04-06

### Added — http-request

- `stream` option on `HttpRequestOptions` — resolves with `HttpResponse` immediately after headers arrive, leaving `rawResponse` unconsumed for piping to files
- `headers`, `ok`, `status`, `statusText` fields on `HttpDownloadResult`

### Changed — http-request

- `httpDownload` now uses `httpRequest` with `stream: true` internally, eliminating ~120 lines of duplicated HTTP plumbing

## [5.14.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.14.0) - 2026-04-06

### Added — http-request

- `HttpResponseError` class — thrown on non-2xx when `throwOnError` is enabled, carries the full `HttpResponse`
- `throwOnError` option on `HttpRequestOptions` — non-2xx responses throw instead of resolving with `ok: false`, enabling retry of HTTP errors
- `onRetry` callback on `HttpRequestOptions` — customize retry behavior per-attempt (return `false` to stop, a `number` to override delay, `undefined` for default backoff)
- Streaming body support — `body` accepts `Readable` streams (incl. `form-data` npm package), auto-merges `getHeaders()` when present
- `parseRetryAfterHeader()` — standalone RFC 7231 §7.1.3 `Retry-After` header parser (strict integer seconds + HTTP-date formats)
- `sanitizeHeaders()` — redact sensitive headers (`authorization`, `cookie`, `set-cookie`, `proxy-authorization`, `proxy-authenticate`, `www-authenticate`) for safe logging

### Changed — http-request

- `HttpRequestOptions.body` type widened from `Buffer | string` to `Buffer | Readable | string`
- Redirect responses now drained via `res.resume()` to free sockets
- `maxResponseSize` exceeded now cleans up both response and request
- `onResponse` hooks wrapped in try/catch — user hook errors can no longer leave promises pending

## [5.13.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.13.0) - 2026-04-05

### Added — http-request

- `readIncomingResponse()` — reads and buffers a Node.js `IncomingResponse` into an `HttpResponse` (#143)
  - Useful for converting raw responses from code that bypasses `httpRequest()` (e.g. multipart form-data uploads) into the standard `HttpResponse` interface
- `IncomingResponse` type alias — disambiguates `IncomingMessage` as a client-side response
- `IncomingRequest` type alias — disambiguates `IncomingMessage` as a server-side request

### Changed — http-request

- Internal `httpRequestAttempt` callbacks now use `IncomingResponse` type
- `HttpResponse.rawResponse` type narrowed from `IncomingMessage` to `IncomingResponse`

## [5.12.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.12.0) - 2026-04-04

### Added — http-request

- Lifecycle hooks (`onRequest`/`onResponse`) on `HttpRequestOptions` (#133)
  - Fire per-attempt — retries and redirects each trigger separate hook calls
  - `HttpHooks`, `HttpHookRequestInfo`, `HttpHookResponseInfo` types exported
- `maxResponseSize` option to reject responses exceeding a byte limit
  - Works through redirects, `httpJson`, and `httpText`
- `rawResponse` property on `HttpResponse` exposing the underlying `IncomingMessage`
- `enrichErrorMessage()` exported for reusable error enrichment

### Changed — http-request

- Error messages now include HTTP method and URL for easier debugging
- `HttpResponse.headers` type changed from `Record<string, string | string[] | undefined>` to `IncomingHttpHeaders`

## [5.11.4](https://github.com/SocketDev/socket-lib/releases/tag/v5.11.4) - 2026-03-28

### Changed

- **perf**: Lazy-load heavy external sub-bundles across 7 modules (#119)
  - `sorts.ts`: Defer semver (2.5 MB via npm-pack) and fastSort until first use
  - `versions.ts`: Defer semver until first use
  - `archives.ts`: Defer adm-zip (102 KB) and tar-fs (105 KB) until extraction
  - `globs.ts`: Defer fast-glob and picomatch (260 KB via pico-pack) until glob execution
  - `fs.ts`: Defer del (260 KB via pico-pack) until safeDelete call
  - `spawn.ts`: Defer @npmcli/promise-spawn (17 KB) until async spawn
  - `strings.ts`: Defer get-east-asian-width (10 KB) until stringWidth call
- Importing lightweight exports (isObject, httpJson, localeCompare, readJsonSync, stripAnsi) no longer loads heavy externals at module init time

## [5.11.3](https://github.com/SocketDev/socket-lib/releases/tag/v5.11.3) - 2026-03-26

### Fixed

- **build**: Deduplicate shared deps across external bundles (#110)
- **quality**: Comprehensive quality scan fixes across codebase (#111)
- **releases**: Add in-memory TTL cache for GitHub API responses
- **releases**: Guard against missing assets in GitHub release response (#112)
- **process-lock**: Fix Windows path separator handling for lock directory creation (#112)

## [5.11.2](https://github.com/SocketDev/socket-lib/releases/tag/v5.11.2) - 2026-03-24

### Added

- **http-request**: Custom CA certificate support for TLS connections
  - `httpRequest`, `httpJson`, `httpText` accept `ca` option for custom certificate authorities
  - `httpDownload` accepts `ca` option, threaded through redirects and retries
  - `fetchChecksums` accepts `ca` option, passed through to underlying request
  - Enables SSL_CERT_FILE support when NODE_EXTRA_CA_CERTS is unavailable at process startup

## [5.11.1](https://github.com/SocketDev/socket-lib/releases/tag/v5.11.1) - 2026-03-24

### Added

- **dlx/binary**: Added `sha256` option to `dlxBinary()`, `downloadBinary()`, and `downloadBinaryFile()`
  - Enables SHA-256 checksum verification for binary downloads via httpDownload
  - Verification happens during download (fails early if checksum mismatches)
  - Complements existing `integrity` option (SRI sha512 format, verified post-download)

## [5.11.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.11.0) - 2026-03-23

### Added

- **http-request**: Checksum verification for secure downloads
  - `parseChecksums(text)`: Parse checksums file text into filename→hash map
    - Supports GNU style (`hash  filename`), BSD style (`SHA256 (file) = hash`), and single-space format
    - Handles Windows CRLF and Unix LF line endings
    - Returns null-prototype object to prevent prototype pollution
  - `fetchChecksums(url, options?)`: Fetch and parse checksums from URL
    - Supports `headers` and `timeout` options
  - `httpDownload` now accepts `sha256` option to verify downloaded files
    - Verification happens before atomic rename (file not saved if hash mismatches)
    - Accepts uppercase hashes (normalized to lowercase internally)

## [5.10.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.10.0) - 2026-03-14

### Changed

- **releases/socket-btm**: Refactored `downloadSocketBtmRelease()` API for caller-controlled download paths
  - Tool name moved from config object to required first parameter
  - Config object is now optional second parameter (was required)
  - Removed automatic `/${toolName}/${platformArch}` directory nesting - callers now have full control over download directory structure
  - All optional parameters in config types now explicitly typed as `| undefined`
  - Migration example:
    - Before: `downloadSocketBtmRelease({ tool: 'lief', downloadDir: 'build' })`
    - After: `downloadSocketBtmRelease('lief', { downloadDir: 'build' })`
  - Rationale: Previous automatic path nesting created unexpected directory structures (e.g., `build/downloaded/lief/darwin-arm64/lief/assets/`) making it impossible for callers to predict exact file locations

## [5.9.1](https://github.com/SocketDev/socket-lib/releases/tag/v5.9.1) - 2026-03-14

### Fixed

- **fs**: `safeDelete()` and `safeDeleteSync()` now properly implement retry logic
  - Previously `maxRetries` was incorrectly passed as `concurrency` to del (parallelism, not retries)
  - `safeDelete()` now wraps `deleteAsync()` with `pRetry()` for exponential backoff
  - `safeDeleteSync()` implements sync retry loop with `Atomics.wait()` for non-blocking sleep
  - Both use `backoffFactor: 2` (delay doubles each retry: 200ms → 400ms → 800ms by default)
  - `maxRetries` and `retryDelay` options in `RemoveOptions` now work as documented

## [5.9.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.9.0) - 2026-03-14

### Changed

- **releases/socket-btm**: `getPlatformArch()` now normalizes Windows platform to `win` instead of `win32`
  - Returns `win-x64`, `win-arm64` instead of `win32-x64`, `win32-arm64`
  - Consistent with `getBinaryAssetName()` which already uses `win` for Windows assets
  - Aligns with socket-btm and Node.js convention: use `win` for file/folder names, `win32` for platform checks (`process.platform`)
  - Added `PLATFORM_MAP` for explicit platform name mapping (darwin, linux, win32 → win)
  - Now throws `Error: Unsupported platform` for unknown platform values

## [5.8.2](https://github.com/SocketDev/socket-lib/releases/tag/v5.8.2) - 2026-03-13

### Fixed

- **http-request**: Download to temp file then atomically rename to prevent corruption
  - Downloads now write to `{destPath}.download` temp file first
  - On success, atomically renames to the destination path
  - On failure, cleans up temp file and preserves any existing file at destination
  - Prevents partial/corrupted files from CI caching causing extraction failures

## [5.8.1](https://github.com/SocketDev/socket-lib/releases/tag/v5.8.1) - 2026-03-11

### Performance

- **windows**: Add comprehensive caching for expensive PATH resolution operations
  - `getBinPath()`, `getBinPathSync()`: Cache binary path lookups
  - `findRealBin()`: Cache `all:true` lookups and use single `whichSync({ all: true })` call
  - `getVoltaBinPath()`: Cache Volta binary resolution
  - `spawn()`: Cache binary path resolution before spawning
  - `getGitPath()`: Cache git binary path
  - `getCachedRealpath()`: New helper caching `realpathSync()` calls for git operations
  - `findGitRoot()`: Cache git root directory lookups
  - `findPackageJson()`: Cache package.json path lookups
  - `readPackageJson()`: Cache parsed package.json content
  - `resolveBinaryPath()`: Cache binary path resolution with Windows extension handling
  - `NPM_BIN_PATH`, `NPM_REAL_EXEC_PATH`: Share npm path resolution to avoid duplicate `which.sync()` calls
  - `ProcessLockManager.isStale()`: Use single `statSync({ throwIfNoEntry: false })` instead of `existsSync()` + `statSync()`
  - All caches validate entries with `existsSync()` and remove stale entries automatically

## [5.8.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.8.0) - 2026-03-10

### Added

- **archives**: Added secure archive extraction utilities with support for ZIP, TAR, TAR.GZ, and TGZ formats
  - Configurable limits: `maxFileSize` (default 100MB), `maxTotalSize` (default 1GB)
  - Cross-platform path normalization
  - External dependencies: adm-zip@0.5.16, tar-fs@3.1.2 (bundled, +212KB)
  - Security features: path traversal protection, file size limits, total size limits, symlink blocking
  - Strip option to remove leading path components (like tar `--strip-components`)
  - `detectArchiveFormat()` - Detect archive type from file extension
  - `extractArchive()` - Generic extraction with auto-format detection
  - `extractTar()`, `extractTarGz()`, `extractZip()` - Format-specific extractors

- **releases/github**: Added archive extraction support for GitHub releases
  - Auto-detects format from asset filename
  - Enhanced `downloadAndExtractZip()` to use generic archive helpers
  - Supports ZIP, TAR, TAR.GZ, and TGZ assets
  - `downloadAndExtractArchive()` - Generic archive download and extraction

### Changed

- **dependencies**: Deduplicated 14 external bundle packages to single versions using pnpm overrides and patches

## [5.7.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.7.0) - 2026-02-12

### Added

- **env**: Added `isInEnv()` helper function to check if an environment variable key exists, regardless of its value
  - Returns `true` even for empty strings, `"false"`, `"0"`, etc.
  - Follows same override resolution order as `getEnvValue()` (isolated overrides → shared overrides → process.env)
  - Useful for detecting presence of environment variables independent of their value

- **dlx**: Added new exported helper functions
  - `downloadBinaryFile()` - Downloads a binary file from a URL to the dlx cache directory
  - `ensurePackageInstalled()` - Ensures an npm package is installed and cached via Arborist
  - `getBinaryCacheMetadataPath()` - Gets the file path to dlx binary cache metadata (`.dlx-metadata.json`)
  - `isBinaryCacheValid()` - Checks if a cached dlx binary is still valid based on TTL and timestamp
  - `makePackageBinsExecutable()` - Makes npm package binaries executable on Unix systems
  - `parsePackageSpec()` - Parses npm package spec strings (e.g., `pkg@1.0.0`) into name and version
  - `resolveBinaryPath()` - Resolves the absolute path to a binary within an installed package
  - `writeBinaryCacheMetadata()` - Writes dlx binary cache metadata with integrity, size, and source info

- **releases**: Added `createAssetMatcher()` utility function for GitHub release asset pattern matching
  - Creates matcher functions that test strings against glob patterns, prefix/suffix, or RegExp
  - Used for dynamic asset discovery in GitHub releases (e.g., matching platform-specific binaries)

### Changed

- **env**: Updated `getCI()` to use `isInEnv()` for more accurate CI detection
  - Now returns `true` whenever the `CI` key exists in the environment, not just when truthy
  - Matches standard CI detection behavior where the presence of the key (not its value) indicates a CI environment

### Fixed

- **github**: Fixed JSON parsing crash vulnerability by adding try-catch around `JSON.parse()` in GitHub API responses
  - Prevents crashes on malformed, incomplete, or binary responses
  - Error messages now include the response URL for better debugging

- **dlx/binary**: Fixed clock skew vulnerabilities in cache validation
  - Cache entries with future timestamps (clock skew) are now treated as expired
  - Metadata writes now use atomic write-then-rename pattern to prevent corruption
  - Added TOCTOU race protection by re-checking binary existence after metadata read

- **dlx/cache cleanup**: Fixed handling of future timestamps during cache cleanup
  - Entries with future timestamps (due to clock skew) are now properly treated as expired

- **dlx/package**: Fixed scoped package parsing bug where `@scope/package` was incorrectly parsed
  - Changed condition from `startsWith('@')` to `atIndex === 0` for more precise detection
  - Fixes installation failures for scoped packages like `@socketregistry/lib`

- **cache-with-ttl**: Added clock skew detection to TTL cache
  - Far-future `expiresAt` values (>2x TTL) are now treated as expired
  - Protects against cache poisoning from clock skew

- **packages/specs**: Fixed unconditional `.git` truncation in Git URL parsing
  - Now only removes `.git` suffix when URL actually ends with `.git`
  - Prevents incorrect truncation of URLs containing `.git` in the middle

- **releases/github**: Fixed TOCTOU race condition in binary download verification
  - Re-checks binary existence after reading version file
  - Ensures binary is re-downloaded if missing despite version file presence

- **provenance**: Fixed incorrect package name in provenance workflow
  - Changed from `@socketregistry/lib` to `@socketsecurity/lib`

## [5.6.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.6.0) - 2026-02-08

### Added

- **http-request**: Added automatic default headers for JSON and text requests
  - `httpJson()` now automatically sets `Accept: application/json` header
  - `httpJson()` automatically sets `Content-Type: application/json` when body is present
  - `httpText()` now automatically sets `Accept: text/plain` header
  - `httpText()` automatically sets `Content-Type: text/plain` when body is present
  - User-provided headers always override defaults
  - Simplifies API usage - no need to manually set common headers

### Changed

- **http-request**: Renamed HTTP helper functions to support all HTTP methods (BREAKING CHANGE)
  - `httpGetJson()` → `httpJson()` - Now supports GET, POST, PUT, DELETE, PATCH, etc.
  - `httpGetText()` → `httpText()` - Now supports all HTTP methods via `method` option
  - Functions now accept `method` parameter in options (defaults to 'GET')
  - More flexible API that matches modern fetch-style conventions
  - **Migration**: Replace `httpGetJson()` calls with `httpJson()` and `httpGetText()` with `httpText()`

### Fixed

- **http-request**: Fixed Content-Type header incorrectly sent with empty string body
  - Empty string body (`""`) no longer triggers Content-Type header
  - Changed condition from `if (body !== undefined)` to `if (body)` for semantic correctness
  - Empty string represents "no content" and should not declare a Content-Type
  - Affects `httpJson()` and `httpText()` functions
  - Fixes potential API compatibility issues with servers expecting no Content-Type for empty bodies
  - Added comprehensive test coverage for empty string edge case

## [5.5.3](https://github.com/SocketDev/socket-lib/releases/tag/v5.5.3) - 2026-01-20

### Fixed

- **deps**: Added patch for execa@2.1.0 to fix signal-exit v4 compatibility. The package was using default import syntax with signal-exit v4, which now exports onExit as a named export.

## [5.5.2](https://github.com/SocketDev/socket-lib/releases/tag/v5.5.2) - 2026-01-20

### Changed

- **dlx/package**: Use `getSocketCacacheDir()` instead of `getPacoteCachePath()` for Arborist cache configuration
  - Ensures consistent use of Socket's shared cacache directory (`~/.socket/_cacache`)
  - Removes dependency on pacote cache path extraction which could fail
  - Simplifies cache configuration by using reliable Socket path utility

## [5.5.1](https://github.com/SocketDev/socket-lib/releases/tag/v5.5.1) - 2026-01-12

### Fixed

- Fixed dotenvx compatibility with pre-commit hooks
- Fixed empty releases being returned when finding latest release

## [5.5.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.5.0) - 2026-01-12

### Added

- **dlx/detect**: Executable type detection utilities for DLX cache and local file paths
  - `detectDlxExecutableType()`: Detects Node.js packages vs native binaries in DLX cache by checking for node_modules/ directory
  - `detectExecutableType()`: Generic entry point that routes to appropriate detection strategy
  - `detectLocalExecutableType()`: Detects executables on local filesystem by checking package.json bin field or file extension
  - `isJsFilePath()`: Validates if a file path has .js, .mjs, or .cjs extension
  - `isNativeBinary()`: Simplified helper that returns true for native binary executables
  - `isNodePackage()`: Simplified helper that returns true for Node.js packages

### Fixed

- **releases/github**: Sort releases by published_at to reliably find latest release instead of relying on creation order

## [5.4.1](https://github.com/SocketDev/socket-lib/releases/tag/v5.4.1) - 2026-01-10

### Fixed

- **build**: Removed debug module stub to bundle real debug package. The stub was missing `enable()` and `disable()` methods, causing errors when downstream projects re-bundled the lib.

## [5.4.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.4.0) - 2026-01-07

### Added

- **releases/github**: Extended release functions to accept glob patterns for asset discovery
  - `getReleaseAssetUrl()` now accepts glob patterns: `'yoga-sync-*.mjs'`, `'models-*.tar.gz'`
  - `downloadReleaseAsset()` now accepts glob patterns for automatic asset discovery
  - `getLatestRelease()` now accepts asset patterns to find releases with matching assets
  - Supports wildcards, brace expansion, RegExp patterns, and prefix/suffix objects
  - Uses picomatch for robust glob pattern matching

- **releases/socket-btm**: Extended `downloadSocketBtmRelease()` to accept glob patterns
  - `asset` parameter now accepts wildcards: `'yoga-sync-*.mjs'`, `'models-*.tar.gz'`
  - Automatically discovers and downloads latest matching asset
  - Eliminates need for hardcoded asset names in build scripts

## [5.3.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.3.0) - 2026-01-07

### Added

- **releases/socket-btm**: Exported helper functions for external use
  - `detectLibc()`: Detect musl vs glibc on Linux systems
  - `getBinaryAssetName()`: Get GitHub asset name for platform/arch
  - `getBinaryName()`: Get binary filename with platform-appropriate extension
  - `getPlatformArch()`: Get platform-arch identifier for directory structure

- **releases/github**: Exported `getAuthHeaders()` for GitHub API authentication
  - Returns headers with `Accept`, `X-GitHub-Api-Version`, and optional `Authorization`
  - Checks `GH_TOKEN` and `GITHUB_TOKEN` environment variables

## [5.2.1](https://github.com/SocketDev/socket-lib/releases/tag/v5.2.1) - 2026-01-06

### Fixed

- **releases**: Fixed "Text file busy" errors when executing downloaded binaries
  - Changed `downloadGitHubRelease()` to use synchronous `chmodSync()` instead of async `chmod()`
  - Ensures file system operations complete before binary execution
  - Prevents race conditions in CI/CD environments where async operations may not fully flush to disk

## [5.2.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.2.0) - 2026-01-06

### Added

- **releases**: Added GitHub release download utilities for cross-project use
  - Added `downloadGitHubRelease()` for downloading releases from any GitHub repository
  - Added `downloadSocketBtmRelease()` specialized wrapper for socket-btm releases
  - Features version caching with `.version` files to avoid redundant downloads
  - Supports cross-platform binary downloads (darwin, linux, win32) with automatic platform/arch detection
  - Includes Linux musl/glibc support with musl as default for broader compatibility
  - Automatically removes macOS quarantine attributes from downloaded binaries
  - Supports generic asset downloads (WASM files, models, etc.)
  - API inspired by industry tools: `brew`, `cargo`, `gh` for intuitive usage
  - Package exports: `@socketsecurity/lib/releases/github` and `@socketsecurity/lib/releases/socket-btm`

## [5.1.4](https://github.com/SocketDev/socket-lib/releases/tag/v5.1.4) - 2025-12-30

### Fixed

- **dependencies**: Removed unnecessary `http2` module dependency from `@sigstore/sign@4.1.0`
  - Added pnpm override to force `@sigstore/sign@4.1.0` across all dependencies
  - Created patch to inline HTTP header and status constants instead of importing `http2` module
  - Eliminates loading of Node.js `http2` module for HTTP/1.1-only operations

## [5.1.3](https://github.com/SocketDev/socket-lib/releases/tag/v5.1.3) - 2025-12-29

### Fixed

- **http-request**: Fixed `httpDownload()` to properly handle HTTP redirects (3xx status codes)
  - Added `followRedirects` option (default: `true`) to enable automatic redirect following
  - Added `maxRedirects` option (default: `5`) to limit redirect chain length
  - Now supports downloading from services that use CDN redirects, such as GitHub release assets
  - Prevents GitHub API quota exhaustion by following `browser_download_url` redirects instead of using API endpoints
  - Resolves "Request quota exhausted" errors when downloading GitHub release assets

## [5.1.2](https://github.com/SocketDev/socket-lib/releases/tag/v5.1.2) - 2025-12-28

### Fixed

- **paths**: Fixed missing `getPathValue()` caching in `getSocketDlxDir()`
  - Now uses `getPathValue()` for performance, consistent with `getSocketUserDir()` and `getSocketCacacheDir()`
  - Adds test override support via `setPath('socket-dlx-dir', ...)`
  - Test helper `mockHomeDir()` now properly invalidates path cache with `resetPaths()` calls
  - Resolves cache persistence issues in test environments

## [5.1.1](https://github.com/SocketDev/socket-lib/releases/tag/v5.1.1) - 2025-12-28

### Added

- **paths**: Added `SOCKET_HOME` environment variable support to customize Socket base directory
  - `getSocketUserDir()` now checks `SOCKET_HOME` before defaulting to `~/.socket`
  - `getSocketDlxDir()` inherits `SOCKET_HOME` support (priority: `SOCKET_DLX_DIR` > `SOCKET_HOME/_dlx` > `~/.socket/_dlx`)
  - Enables flexible directory configuration for restricted or custom environments

### Changed

- **paths**: Enhanced directory resolution with temporary directory fallback
  - `getUserHomeDir()` now falls back to `os.tmpdir()` when home directory is unavailable
  - Improves resilience in containerized and restricted environments
  - Priority order: `HOME` > `USERPROFILE` > `os.homedir()` > `os.tmpdir()`

## [5.1.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.1.0) - 2025-12-17

### Added

- **types**: Added `ALPM` and `VSCODE` to `PURL_Type` enum
  - `ALPM`: Arch Linux Package Manager ecosystem
  - `VSCODE`: Visual Studio Code extensions ecosystem

## [5.0.2](https://github.com/SocketDev/socket-lib/releases/tag/v5.0.2) - 2025-12-15

### Changed

- **signal-exit**: `signals()` now auto-initializes its internal state
  - Commit: [`8cb0576`](https://github.com/SocketDev/socket-lib/commit/8cb0576)

## [5.0.1](https://github.com/SocketDev/socket-lib/releases/tag/v5.0.1) - 2025-12-11

### Added

- **http-request**: Enhanced `httpDownload()` with automatic progress logging via Logger integration
  - New `logger` option: Pass a Logger instance for automatic progress tracking
  - New `progressInterval` option: Configure progress reporting frequency (default: 10%)
  - Progress format: `Progress: XX% (Y.Y MB / Z.Z MB)`
  - `onProgress` callback takes precedence over `logger` when both are provided
  - Commit: [`91e5db5`](https://github.com/SocketDev/socket-lib/commit/91e5db5)

## [5.0.0](https://github.com/SocketDev/socket-lib/releases/tag/v5.0.0) - 2025-12-04

### Added

- **json/edit**: New `EditableJson` base class for generic JSON file manipulation with formatting preservation
  - Extracted from `EditablePackageJson` to enable code reuse via composition pattern
  - Supports reading, modifying, and writing JSON files while preserving formatting
  - Export: `@socketsecurity/lib/json/edit`

- **json/format**: New JSON formatting utilities for consistent JSON manipulation
  - Functions for analyzing and preserving JSON formatting patterns
  - Export: `@socketsecurity/lib/json/format`

- **json/parse**: New JSON parsing utilities
  - `isJsonPrimitive()`: Check if value is a JSON primitive type
  - `jsonParse()`: Parse JSON with error handling
  - Export: `@socketsecurity/lib/json/parse`

- **json/types**: New JSON type definitions and interfaces
  - Export: `@socketsecurity/lib/json/types`

- **dlx/cache**: New DLX cache utilities
  - `generateCacheKey()`: Generate cache keys for DLX packages
  - Export: `@socketsecurity/lib/dlx/cache`

- **dlx/dir**: New DLX directory management utilities
  - `clearDlx()`, `clearDlxSync()`: Clear DLX directory
  - `dlxDirExists()`, `dlxDirExistsAsync()`: Check if DLX directory exists
  - `ensureDlxDir()`, `ensureDlxDirSync()`: Ensure DLX directory exists
  - Export: `@socketsecurity/lib/dlx/dir`

- **dlx/packages**: New DLX package management utilities
  - `isDlxPackageInstalled()`, `isDlxPackageInstalledAsync()`: Check if package is installed
  - `listDlxPackages()`, `listDlxPackagesAsync()`: List installed packages
  - `removeDlxPackage()`, `removeDlxPackageSync()`: Remove installed packages
  - Export: `@socketsecurity/lib/dlx/packages`

- **dlx/paths**: New DLX path utilities
  - `getDlxPackageDir()`: Get package directory path
  - `getDlxInstalledPackageDir()`: Get installed package directory path
  - `getDlxPackageJsonPath()`: Get package.json path
  - `getDlxPackageNodeModulesDir()`: Get node_modules directory path
  - `isInSocketDlx()`: Check if path is in DLX directory
  - Export: `@socketsecurity/lib/dlx/paths`

### Changed

- **BREAKING**: Reorganized module paths for better structure and discoverability
  - `@socketsecurity/lib/json/editable` → `@socketsecurity/lib/json/edit`
  - `@socketsecurity/lib/packages/editable` → `@socketsecurity/lib/packages/edit`
  - `@socketsecurity/lib/maintained-node-versions` → `@socketsecurity/lib/constants/maintained-node-versions`
  - `@socketsecurity/lib/package-default-node-range` → `@socketsecurity/lib/constants/package-default-node-range`
  - `@socketsecurity/lib/package-default-socket-categories` → `@socketsecurity/lib/constants/package-default-socket-categories`
  - `@socketsecurity/lib/lifecycle-script-names` → `@socketsecurity/lib/constants/lifecycle-script-names`
  - `@socketsecurity/lib/dlx` → Split into `@socketsecurity/lib/dlx/cache`, `@socketsecurity/lib/dlx/dir`, `@socketsecurity/lib/dlx/packages`, `@socketsecurity/lib/dlx/paths`
  - `@socketsecurity/lib/dlx-binary` → `@socketsecurity/lib/dlx/binary`
  - `@socketsecurity/lib/dlx-manifest` → `@socketsecurity/lib/dlx/manifest`
  - `@socketsecurity/lib/dlx-package` → `@socketsecurity/lib/dlx/package`

- **json**: Reorganized JSON utilities into modular submodules (json/edit, json/format, json/parse, json/types)
  - Removed barrel index file in favor of direct submodule imports
  - Better separation of concerns and tree-shaking

- **dlx**: Split monolithic DLX module into focused submodules (cache, dir, packages, paths)
  - Improved modularity and maintainability
  - Better code organization and discoverability

## [4.4.0](https://github.com/SocketDev/socket-lib/releases/tag/v4.4.0) - 2025-11-25

### Added

- **fs**: Exported `normalizeEncoding()` function for robust encoding string normalization
  - Handles case-insensitive encoding names (e.g., 'UTF-8', 'utf8', 'UTF8')
  - Supports encoding aliases (e.g., 'binary' → 'latin1', 'ucs-2' → 'utf16le')
  - Fast-path optimization for common encodings
  - Defaults to 'utf8' for invalid or null encodings
  - Export: `@socketsecurity/lib/fs`

### Fixed

- **fs**: `safeReadFile()` and `safeReadFileSync()` type signatures and encoding handling
  - Corrected type overloads: `encoding: null` → `Buffer | undefined`, no encoding → `string | undefined` (UTF-8 default)
  - Fixed implementation to properly handle `encoding: null` for Buffer returns

- **suppress-warnings**: `withSuppressedWarnings()` now properly restores warning state
  - Fixed state restoration to only remove warning types that were added by the function
  - Prevents accidental removal of warnings that were already suppressed
  - Ensures correct cleanup behavior when warning types are nested or reused

## [4.3.0](https://github.com/SocketDev/socket-lib/releases/tag/v4.3.0) - 2025-11-20

### Added

- **globs**: New `glob()` and `globSync()` wrapper functions for fast-glob
  - Provides convenient wrappers around fast-glob with normalized options
  - Maintains consistent API with existing glob functionality
  - Export: `@socketsecurity/lib/globs`

## [4.1.0](https://github.com/SocketDev/socket-lib/releases/tag/v4.1.0) - 2025-11-17

### Added

- **constants/node**: New version helper functions for cleaner version detection
  - `getNodeMinorVersion()`: Extract minor version number
  - `getNodePatchVersion()`: Extract patch version number

### Fixed

- **constants/node**: Improve Node.js flag management in `getNodeHardenFlags()`
  - Properly guard `--experimental-permission` for Node 20-23 only
  - Properly guard `--permission` for Node 24+ only
  - Properly guard `--force-node-api-uncaught-exceptions-policy` for Node 22+ (was incorrectly applied to all versions)
  - Automatically include permission grants from `getNodePermissionFlags()` for Node 24+
  - Remove `--experimental-policy` flag (no policy file provided)

## [4.0.1](https://github.com/SocketDev/socket-lib/releases/tag/v4.0.1) - 2025-11-17

### Changed

- Removed # path imports and replaced with relative paths

## [4.0.0](https://github.com/SocketDev/socket-lib/releases/tag/v4.0.0) - 2025-11-15

### Changed

- **paths**: Reorganized path utilities into dedicated `paths/*` submodules for improved modularity
- **imports**: Converted lazy require() calls to ES6 static imports for better tree-shaking and bundler compatibility

## [3.5.0](https://github.com/SocketDev/socket-lib/releases/tag/v3.5.0) - 2025-11-14

### Added

- **argv/quote**: New utilities for quoting command-line arguments when using `spawn()` with `shell: true`
  - `posixQuote(arg)`: Quote arguments for POSIX shells (bash, sh, zsh) using single quotes
  - `win32Quote(arg)`: Quote arguments for Windows cmd.exe using double quotes

## [3.4.0](https://github.com/SocketDev/socket-lib/releases/tag/v3.4.0) - 2025-11-14

### Added

- **Spinner**: New `skip()` and `skipAndStop()` methods for displaying skipped operations
  - `skip(text)`: Display skip message alongside spinner (e.g., "Skipping optional step...")
  - `skipAndStop(text)`: Display skip message and stop spinner in one call
  - Uses cyan ↻ (refresh/reload) symbol with @ ASCII fallback
  - Normalizes text formatting consistently with other spinner methods
  - Useful for communicating skipped steps during long-running operations

- **Logger**: New `skip()` method and symbol for skipped operations
  - `LOG_SYMBOLS.skip`: New cyan ↻ symbol for skip output (@ ASCII fallback)
  - `skip(message)`: Display skip messages with dedicated symbol
  - Complements existing info/step/success/error/warning/reason methods

## [3.3.11](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.11) - 2025-11-14

### Fixed

- **prompts**: Fix "inquirerPrompt is not a function" error in interactive prompts
  - Properly handle inquirer modules with multiple exports (select, search)

## [3.3.10](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.10) - 2025-11-14

### Fixed

- **deps**: Add string-width and wrap-ansi overrides for bundling compatibility
  - Forces string-width@8.1.0 and wrap-ansi@9.0.2 for compatibility with strip-ansi@7.1.2

## [3.3.9](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.9) - 2025-11-14

### Fixed

- **deps**: Add strip-ansi override to fix bundling compatibility
  - Forces strip-ansi@7.1.2 for compatibility with ansi-regex@6.2.2

## [3.3.8](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.8) - 2025-11-14

### Fixed

- **spinner**: Clear remaining artifacts after withSpinner stops
  - Fixed rogue spinner characters persisting after spinner completes

## [3.3.7](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.7) - 2025-11-13

### Changed

- **refactor**: Add explicit `.js` extensions to external require calls
  - Improves module resolution clarity and compatibility with modern bundlers
  - Updated 18 require calls across 10 source files

## [3.3.6](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.6) - 2025-11-13

### Changed

- **deps**: Add pnpm overrides to consolidate package versions
  - Force single versions: `@npmcli/arborist@9.1.6`, `@npmcli/run-script@10.0.0`, `semver@7.7.2`, `ansi-regex@6.2.2`, `lru-cache@11.2.2`
  - Update patch from `@npmcli/run-script@9.1.0` to `@npmcli/run-script@10.0.0`
  - Reduces duplicate dependencies and potential version conflicts

## [3.3.5](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.5) - 2025-11-13

### Fixed

- **build**: Add patches to prevent node-gyp bundling issues

## [3.3.4](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.4) - 2025-11-13

### Fixed

- **build**: Mark node-gyp as external in npm-pack bundle

## [3.3.3](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.3) - 2025-11-13

### Fixed

- **build**: Break node-gyp string to prevent bundler issues with ESM/CJS interop

## [3.3.2](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.2) - 2025-11-13

### Changed

- **dlx**: Install package dependencies after download
- **external**: Optimize npm package bundle sizes (~3MB reduction)

## [3.3.1](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.1) - 2025-11-11

### Added

- Added `SOCKET_DOCS_CONTACT_URL` constant for documentation contact support page
- Added `checkbox` prompt support

## [3.3.0](https://github.com/SocketDev/socket-lib/releases/tag/v3.3.0) - 2025-11-07

### Added

- **Spinner**: New `reason()` and `reasonAndStop()` methods for displaying working/thinking output
  - `reason(text)`: Display reason text alongside spinner (e.g., "Analyzing dependencies...")
  - `reasonAndStop(text)`: Display reason text and stop spinner in one call
  - Normalizes text formatting consistently with other spinner methods
  - Useful for communicating progress steps during long-running operations

- **Logger**: New `reason()` method and symbol for working/thinking output
  - `LOG_SYMBOLS.reason`: New symbol for reason output (distinct from info/step symbols)
  - `reason(message)`: Display reason messages with dedicated symbol
  - Complements existing info/step/success/error/warning methods

## [3.2.8](https://github.com/SocketDev/socket-lib/releases/tag/v3.2.8) - 2025-11-05

### Fixed

- **build**: Fix CommonJS export script edge cases
  - Fixed stray semicolons after comment placeholders in transformed modules
  - Fixed incorrect transformation of `module.exports.default` to `module.module.exports`
  - Ensures external dependencies and default exports work correctly

## [3.2.7](https://github.com/SocketDev/socket-lib/releases/tag/v3.2.7) - 2025-11-05

### Fixed

- **build-externals**: Disable minification to preserve exports
  - External dependencies are no longer minified during bundling
  - Prevents export name mangling that breaks CommonJS interop
  - Fixes `semver.parse()` and `semver.major()` being undefined

- **build**: Fix CommonJS export interop for TypeScript default exports
  - Modules with `export default` now work without requiring `.default` accessor

### Changed

- **docs**: Moved packages README to correct location (`src/packages/README.md`)

## [3.2.6](https://github.com/SocketDev/socket-lib/releases/tag/v3.2.6) - 2025-11-05

### Fixed

- **logger**: Replace yoctocolors-cjs rgb() with manual ANSI codes
  - The yoctocolors-cjs package doesn't have an rgb() method
  - Manually construct ANSI escape sequences for RGB colors (ESC[38;2;r;g;bm...ESC[39m)
  - Affects `src/logger.ts` and `src/stdio/prompts.ts` applyColor() functions

## [3.2.5](https://github.com/SocketDev/socket-lib/releases/tag/v3.2.5) - 2025-11-05

### Added

- **scripts**: Add path alias resolution script (`fix-path-aliases.mjs`)
  - Resolves internal path aliases (`#lib/*`, `#constants/*`, etc.) to relative paths in built CommonJS files

- **build**: Integrate path alias resolution into build pipeline
  - Add path alias plugin to esbuild config
  - Integrate `fix-path-aliases.mjs` into build process
  - Ensures path aliases work correctly in compiled CommonJS output

## [3.2.4](https://github.com/SocketDev/socket-lib/releases/tag/v3.2.4) - 2025-11-04

### Added

- **Logger**: New `time()` method for timing operations with automatic duration reporting
  - Starts a named timer and returns a `stop()` function
  - Automatically logs completion with formatted duration (e.g., "Operation completed in 1.23s")
  - Useful for performance monitoring and debugging

### Fixed

- **Spinner effects**: Fixed star spinner frames by adding trailing space for consistent spacing
- **Build system**: Fixed external dependency bundling issues
  - Bundle `@npmcli/package-json` with subpath exports support
  - Use `src/external` files as bundle entry points for proper module resolution
  - Bundle libnpmexec from npm instead of using vendored version
  - Prevent circular dependencies with `createForceNodeModulesPlugin()` to force resolution from node_modules

## [3.2.3](https://github.com/SocketDev/socket-lib/releases/tag/v3.2.3) - 2025-11-03

### Internal

- **Build system**: Added stub infrastructure for external dependency bundling
  - Created organized `scripts/build-externals/stubs/` directory with utility and active stubs
  - Added conservative stubs for unused dependencies: `encoding`/`iconv-lite` and `debug`
  - Reduces external bundle size by ~18KB (9KB from encoding stubs, 9KB from debug stubs)

## [3.2.2](https://github.com/SocketDev/socket-lib/releases/tag/v3.2.2) - 2025-11-03

### Added

- **DLX**: Binary permission management with chmod 0o755 for all package binaries
  - New `makePackageBinsExecutable()` function ensures all binaries in installed packages are executable
  - Aligns with npm's cmd-shim approach for binary permissions
  - Handles both single and multiple binary packages
  - No-op on Windows (permissions not needed)

- **DLX**: npm-compatible bin resolution via vendored `getBinFromManifest`
  - Cherry-picked `getBinFromManifest` from libnpmexec@10.1.8 (~1.5 KB)
  - Avoids 1.1 MB bundle by vendoring single function instead of full package
  - Provides battle-tested npm bin resolution strategy
  - Maintains user-friendly fallbacks for edge cases

### Changed

- **DLX**: Enhanced `findBinaryPath()` with npm's resolution strategy
  - Primary: npm's `getBinFromManifest` (handles standard cases and aliases)
  - Fallback: user-provided `binaryName` parameter
  - Fallback: last segment of package name
  - Last resort: first binary in list

### Performance

- **Optimized package size**: Reduced bundle size through strategic export minimization and vendoring
  - Vendored `getBinFromManifest` function instead of bundling full libnpmexec (~1.1 MB savings)
  - Minimized external module exports for better tree-shaking:
    - `fast-sort`: Now exports only `{ createNewSortInstance }` (2.1 KB, 96% reduction from ~56 KB)
    - `fast-glob`: Now exports only `{ globStream }` (82 KB bundle)
    - `del`: Now exports only `{ deleteAsync, deleteSync }` (100 KB bundle)
    - `streaming-iterables`: Now exports only `{ parallelMap, transform }` (11 KB, 93% reduction from ~168 KB)
  - Total savings: ~1.3 MB (1.1 MB from vendoring + 211 KB from minimized exports)
  - Establishes pattern for future external module additions

## [3.2.1](https://github.com/SocketDev/socket-lib/releases/tag/v3.2.1) - 2025-11-02

### Changed

- **Logger/Spinner**: Use module-level constants to prevent duplicate and rogue spinner indicators
  - Call `getDefaultLogger()` and `getDefaultSpinner()` once at module scope instead of repeated calls
  - Prevents multiple spinner instances that can cause duplicate or lingering indicators in terminal output
  - Applied in `src/dlx-manifest.ts`, `src/stdio/mask.ts`, and `src/spinner.ts`
  - Follows DRY principle and aligns with socket-registry/socket-sdk-js patterns

### Fixed

- **Scripts**: Fixed undefined logger variable in update script
  - Replaced undefined `log` references with `_logger` throughout `scripts/update.mjs`
  - Resolves ESLint errors that blocked test execution
- **Tests**: Improved stdout test stability by checking call delta instead of absolute counts
  - Fixed flaky CI failures where spy call count was 101 instead of expected 100
  - More robust approach handles potential state leakage between tests
- **Tests**: Removed unnecessary 10ms delay in cache-with-ttl test
  - Cache with memoization enabled updates in-memory storage synchronously
  - Delay was insufficient in CI and unnecessary given synchronous behavior
  - Resolves flaky CI failures where cached values returned undefined

## [3.2.0](https://github.com/SocketDev/socket-lib/releases/tag/v3.2.0) - 2025-11-02

### Added

- **DLX**: Unified manifest for packages and binaries
  - Centralized manifest system for tracking DLX-compatible packages
  - Simplifies package and binary lookups for dependency-free execution

## [3.1.3](https://github.com/SocketDev/socket-lib/releases/tag/v3.1.3) - 2025-11-02

### Changed

- **Dependencies**: Updated `@socketregistry/packageurl-js` to 1.3.5

## [3.1.2](https://github.com/SocketDev/socket-lib/releases/tag/v3.1.2) - 2025-11-02

### Fixed

- **External dependencies**: Fixed incorrectly marked external dependencies to use wrapper pattern
  - Updated `src/constants/agents.ts` to use `require('../external/which')` instead of direct imports
  - Updated `src/zod.ts` to export from `./external/zod'` instead of direct imports
  - Maintains zero dependencies policy by ensuring all runtime dependencies go through the external wrapper pattern
- **Spinner**: Fixed undefined properties in setShimmer by handling defaults correctly

## [3.1.1](https://github.com/SocketDev/socket-lib/releases/tag/v3.1.1) - 2025-11-02

### Fixed

- **Cache TTL**: Fixed flaky test by handling persistent cache write failures gracefully
  - Wrapped `cacache.put` in try/catch to prevent failures when persistent cache writes fail or are slow
  - In-memory cache is updated synchronously before the persistent write, so immediate reads succeed regardless of persistent cache state
  - Improves reliability in test environments and when cache directory has issues

## [3.1.0](https://github.com/SocketDev/socket-lib/releases/tag/v3.1.0) - 2025-11-01

### Changed

- **File system utilities**: `safeMkdir` and `safeMkdirSync` now default to `recursive: true`
  - Nested directories are created by default, simplifying common usage patterns

## [3.0.6](https://github.com/SocketDev/socket-lib/releases/tag/v3.0.6) - 2025-11-01

### Added

- **Build validation**: Added guard against `link:` protocol dependencies in package.json
  - New `validate-no-link-deps.mjs` script automatically runs during `pnpm run check`
  - Prevents accidental publication with `link:` dependencies which can cause issues
  - Recommends using `workspace:` for monorepos or `catalog:` for centralized version management
  - Validates all dependency fields: dependencies, devDependencies, peerDependencies, optionalDependencies

### Changed

- **Dependencies**: Updated `@socketregistry/packageurl-js` to 1.3.3
- **Git hooks**: Committed pre-commit and pre-push hook configurations for version control
- **Scripts**: Removed shebang from `validate-no-link-deps` script (Node.js script, not shell)

## [3.0.5](https://github.com/SocketDev/socket-lib/releases/tag/v3.0.5) - 2025-11-01

### Fixed

- **Critical: Prompts API breaking changes**: Restored working prompts implementation that was accidentally replaced with non-functional stub in v3.0.0
  - Consolidated all prompts functionality into `src/stdio/prompts.ts`
  - Removed unimplemented stub from `src/prompts/` that was throwing "not yet implemented" errors
  - Removed `./prompts` package export (use `@socketsecurity/lib/stdio/prompts` instead)
  - Restored missing exports: `password`, `search`, `Separator`, and added `createSeparator()` helper
  - Fixed `Choice` type to use correct `name` property (matching `@inquirer` API, not erroneous `label`)

### Added

- **Theme integration for prompts**: Prompts now automatically use the active theme colors
  - Prompt messages styled with `colors.prompt`
  - Descriptions and disabled items styled with `colors.textDim`
  - Answers and highlights styled with `colors.primary`
  - Error messages styled with `colors.error`
  - Success indicators styled with `colors.success`
  - Exported `createInquirerTheme()` function for converting Socket themes to @inquirer format
  - Consistent visual experience with Logger and Spinner theme integration

- **Theme parameter support**: Logger, Prompts, and text effects now accept optional `theme` parameter
  - Pass theme names (`'socket'`, `'sunset'`, `'terracotta'`, `'lush'`, `'ultra'`) or Theme objects
  - **Logger**: `new Logger({ theme: 'sunset' })` - uses theme-specific symbol colors
  - **Prompts**: `await input({ message: 'Name:', theme: 'ultra' })` - uses theme for prompt styling
  - **Text effects**: `applyShimmer(text, state, { theme: 'terracotta' })` - uses theme for shimmer colors
  - Instance-specific themes override global theme context when provided
  - Falls back to global theme context when no instance theme specified
  - **Note**: Spinner already had theme parameter support in v3.0.0

### Removed

- **Unused index entrypoint**: Removed `src/index.ts` and package exports for `"."` and `"./index"`
  - This was a leftover from socket-registry and not needed for this library
  - Users should import specific modules directly (e.g., `@socketsecurity/lib/logger`)
  - Breaking: `import { getDefaultLogger } from '@socketsecurity/lib'` no longer works
  - Use: `import { getDefaultLogger } from '@socketsecurity/lib/logger'` instead

## [3.0.4](https://github.com/SocketDev/socket-lib/releases/tag/v3.0.4) - 2025-11-01

### Changed

- **Sunset theme**: Updated colors from azure blue to warm orange/purple gradient matching Coana branding
- **Terracotta theme**: Renamed from `brick` to `terracotta` for better clarity

## [3.0.3](https://github.com/SocketDev/socket-lib/releases/tag/v3.0.3) - 2025-11-01

### Fixed

- **Critical: Node.js ESM/CJS interop completely fixed**: Disabled minification to ensure proper ESM named import detection
  - Root cause: esbuild minification was breaking Node.js ESM's CJS named export detection
  - Solution: Disabled minification entirely (`minify: false` in esbuild config)
  - Libraries should not be minified - consumers minify during their own build process
  - Unminified esbuild output uses clear `__export` patterns that Node.js ESM natively understands
  - Removed `fix-commonjs-exports.mjs` build script - no longer needed with unminified code
  - ESM imports now work reliably: `import { getDefaultLogger } from '@socketsecurity/lib/logger'`
  - Verified with real-world ESM module testing (`.mjs` files importing from CJS `.js` dist)

## [3.0.2](https://github.com/SocketDev/socket-lib/releases/tag/v3.0.2) - 2025-11-01

### Fixed

- **Critical: Node.js ESM named imports from CommonJS**: Fixed build output to ensure Node.js ESM can properly detect named exports from CommonJS modules
  - Previously, esbuild's minified export pattern placed `module.exports` before variable definitions, causing "Cannot access before initialization" errors
  - Build script now uses `@babel/parser` + `magic-string` for safe AST parsing and transformation
  - Exports are now correctly placed at end of files after all variable definitions
  - Enables proper ESM named imports: `import { getDefaultLogger, Logger } from '@socketsecurity/lib/logger'`
  - Fixes socket-cli issue where named imports were failing with obscure initialization errors

## [3.0.1](https://github.com/SocketDev/socket-lib/releases/tag/v3.0.1) - 2025-11-01

### Added

- **Convenience exports from main index**: Added logger and spinner exports to ease v2→v3 migration
  - Logger: `getDefaultLogger()`, `Logger`, `LOG_SYMBOLS` now available from `@socketsecurity/lib`
  - Spinner: `getDefaultSpinner()`, `Spinner` now available from `@socketsecurity/lib`
  - Both main index (`@socketsecurity/lib`) and subpath (`@socketsecurity/lib/logger`, `@socketsecurity/lib/spinner`) imports now work
  - Both import paths return the same singleton instances

### Fixed

- **Critical: Spinner crashes when calling logger**: Fixed spinner internal calls to use `getDefaultLogger()` instead of removed `logger` export
  - Spinner methods (`start()`, `stop()`, `success()`, `fail()`, etc.) no longer crash with "logger is not defined" errors
  - All 5 internal logger access points updated to use the correct v3 API
  - Resolves runtime errors when using spinners with hoisted variables

### Changed

- **Migration path improvement**: Users can now import logger/spinner from either main index or subpaths, reducing breaking change impact from v3.0.0

## [3.0.0](https://github.com/SocketDev/socket-lib/releases/tag/v3.0.0) - 2025-11-01

### Added

- Theme system with 5 built-in themes: `socket`, `sunset`, `terracotta`, `lush`, `ultra`
- `setTheme()`, `getTheme()`, `withTheme()`, `withThemeSync()` for theme management
- `createTheme()`, `extendTheme()`, `resolveColor()` helper functions
- `onThemeChange()` event listener for theme reactivity
- `link()` function for themed terminal hyperlinks in `@socketsecurity/lib/links`
- Logger and spinner now inherit theme colors automatically
- Spinner methods: `enableShimmer()`, `disableShimmer()`, `setShimmer()`, `updateShimmer()`
- DLX cross-platform binary resolution (`.cmd`, `.bat`, `.ps1` on Windows)
- DLX programmatic options aligned with CLI conventions (`force`, `quiet`, `package`)

### Changed

- Theme context uses AsyncLocalStorage instead of manual stack management
- Promise retry options renamed: `factor` → `backoffFactor`, `minTimeout` → `baseDelayMs`, `maxTimeout` → `maxDelayMs`

### Removed

**BREAKING CHANGES:**

- `pushTheme()` and `popTheme()` - use `withTheme()` or `withThemeSync()` instead
- `logger` export - use `getDefaultLogger()` instead
- `spinner` export - use `getDefaultSpinner()` instead
- `download-lock.ts` - use `process-lock.ts` instead
- Promise option aliases: `factor`, `minTimeout`, `maxTimeout`

---

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.10.3](https://github.com/SocketDev/socket-lib/releases/tag/v2.10.3) - 2025-10-31

### Fixed

- Updated `@socketregistry/packageurl-js` to 1.3.1 to resolve an unintended external dependency
- **Documentation**: Corrected JSDoc `@example` import paths from `@socketsecurity/registry` to `@socketsecurity/lib` across utility modules
  - Updated examples in `memoization.ts`, `performance.ts`, `spinner.ts`, `suppress-warnings.ts`, and `tables.ts`
  - Ensures documentation reflects correct package name after v1.0.0 rename

## [2.10.2](https://github.com/SocketDev/socket-lib/releases/tag/v2.10.2) - 2025-10-31

### Changed

- **Package spec parsing**: Refactored to use official `npm-package-arg` library for robust handling of all npm package specification formats (versions, ranges, tags, git URLs)
  - Improves reliability when parsing complex package specs
  - Better handles edge cases in version ranges and scoped packages
  - Falls back to simple parsing if npm-package-arg fails

### Fixed

- **Scoped package version parsing**: Fixed critical bug where parsePackageSpec was stripping the `@` prefix from scoped packages with versions
  - Example: `@coana-tech/cli@~14.12.51` was incorrectly parsed as `coana-tech/cli@~14.12.51`
  - Caused package installation failures for scoped packages in DLX system

## [2.10.1](https://github.com/SocketDev/socket-lib/releases/tag/v2.10.1) - 2025-10-31

### Fixed

- **Process lock directory creation**: Use recursive mkdir to ensure parent directories exist when creating lock directory
- **Node.js debug flags**: Remove buggy `getNodeDebugFlags()` function that returned debug flags without required argument values

## [2.10.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.10.0) - 2025-10-30

### Added

- **Unified DLX metadata schema**: Standardized `.dlx-metadata.json` format across TypeScript and C++ implementations
  - Exported `DlxMetadata` interface as canonical schema reference
  - Core fields: `version`, `cache_key`, `timestamp`, `checksum`, `checksum_algorithm`, `platform`, `arch`, `size`, `source`
  - Support for `source` tracking (download vs decompression origin)
  - Reserved `extra` field for implementation-specific data
  - Comprehensive documentation with examples for both download and decompression use cases

### Changed

- **DLX binary metadata structure**: Updated `writeBinaryCacheMetadata()` to use unified schema with additional fields
  - Now includes `cache_key` (first 16 chars of SHA-512 hash)
  - Added `size` field for cached binary size
  - Added `checksum_algorithm` field (currently "sha256")
  - Restructured to use `source.type` and `source.url` for origin tracking
  - Maintains backward compatibility in `listDlxCache()` reader

## [2.9.1](https://github.com/SocketDev/socket-lib/releases/tag/v2.9.1) - 2025-10-30

### Added

- **Smart binary detection in dlxPackage**: Automatically finds the correct binary even when package name doesn't match binary name
  - If package has single binary, uses it automatically regardless of name
  - Resolves packages like `@socketsecurity/cli` (binary: `socket`) without manual configuration
  - Falls back to intelligent name matching for multi-binary packages
- **Optional binaryName parameter**: Added `binaryName` option to `DlxPackageOptions` for explicit binary selection when auto-detection isn't sufficient

### Fixed

- **Binary resolution for scoped packages**: Fixed issue where `dlxPackage` couldn't find binaries when package name didn't match binary name (e.g., `@socketsecurity/cli` with `bin: { socket: '...' }`)

## [2.9.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.9.0) - 2025-10-30

### Added

- **Socket.dev URL constants**: Added centralized URL constants for Socket.dev services
  - `SOCKET_WEBSITE_URL`: Main Socket.dev website
  - `SOCKET_CONTACT_URL`: Contact page
  - `SOCKET_DASHBOARD_URL`: Dashboard homepage
  - `SOCKET_API_TOKENS_URL`: API tokens settings page
  - `SOCKET_PRICING_URL`: Pricing information
  - `SOCKET_STATUS_URL`: Service status page
  - `SOCKET_DOCS_URL`: Documentation site
  - Available via `@socketsecurity/lib/constants/socket`

### Changed

- **Enhanced error messages across library**: Comprehensive audit and improvement of error handling
  - Added actionable error messages with resolution steps throughout modules
  - Improved file system operation errors (permissions, read-only filesystems, path issues)
  - Enhanced DLX error messages with clear troubleshooting guidance
  - Better error context in process locking, binary downloads, and package operations
  - Consistent error formatting with helpful user guidance
- **Consolidated process locking**: Standardized on directory-based lock format across all modules
  - All locking operations now use `process-lock` module exclusively
  - Lock directories provide atomic guarantees across all filesystems including NFS
  - Consistent mtime-based stale detection with 5-second timeout (aligned with npm npx)
  - Automatic cleanup on process exit with proper signal handling

## [2.8.4](https://github.com/SocketDev/socket-lib/releases/tag/v2.8.4) - 2025-10-30

### Added

- **DLX binary helper functions mirror dlx-package pattern**
  - `downloadBinary`: Download binary with caching (without execution)
  - `executeBinary`: Execute cached binary without re-downloading
  - Renamed internal `downloadBinary` to `downloadBinaryFile` to avoid naming conflicts
  - Maintains feature parity with `downloadPackage`/`executePackage` from dlx-package

## [2.8.3](https://github.com/SocketDev/socket-lib/releases/tag/v2.8.3) - 2025-10-30

### Fixed

- **Logger now fully defers all console access for Node.js internal bootstrap compatibility**: Completed lazy initialization to prevent ERR_CONSOLE_WRITABLE_STREAM errors
  - Deferred `Object.getOwnPropertySymbols(console)` call until first logger use
  - Deferred `kGroupIndentationWidth` symbol lookup
  - Deferred `Object.entries(console)` and prototype method initialization
  - Ensures logger can be safely imported in Node.js internal bootstrap contexts (e.g., `lib/internal/bootstrap/*.js`) before stdout is initialized
  - Builds on v2.8.2 console deferring to complete early bootstrap compatibility

## [2.8.2](https://github.com/SocketDev/socket-lib/releases/tag/v2.8.2) - 2025-10-29

### Changed

- Enhanced Logger class to defer Console creation until first use
  - Eliminates early bootstrap errors when importing logger before stdout is ready
  - Enables safe logger imports during Node.js early initialization phase
  - Simplified internal storage with WeakMap-only pattern for constructor args

## [2.8.1](https://github.com/SocketDev/socket-lib/releases/tag/v2.8.1) - 2025-10-29

### Changed

- **Consolidated DLX cache key generation**: Extracted `generateCacheKey` function to shared `dlx.ts` module
  - Eliminates code duplication between `dlx-binary.ts` and `dlx-package.ts`
  - Enables consistent cache key generation across the Socket ecosystem
  - Exports function for use in dependent packages (e.g., socket-cli)
  - Maintains SHA-512 truncated to 16 chars strategy from v2.8.0

## [2.8.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.8.0) - 2025-10-29

### Changed

- **Enhanced DLX cache key generation with npm/npx compatibility**: Updated cache key strategy to align with npm/npx ecosystem patterns
  - Changed from SHA-256 (64 chars) to SHA-512 truncated to 16 chars (matching npm/npx)
  - Optimized for Windows MAX_PATH compatibility (260 character limit)
  - Accepts collision risk for shorter paths (~1 in 18 quintillion with 1000 entries)
  - Added support for PURL-style package specifications (e.g., `npm:prettier@3.0.0`, `pypi:requests@2.31.0`)
  - Documented Socket's shorthand format (without `pkg:` prefix) handled by `@socketregistry/packageurl-js`
  - References npm/cli v11.6.2 implementation for consistency

## [2.7.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.7.0) - 2025-10-28

### Added

- **DLX cache locking for concurrent installation protection**: Added process-lock protection to dlx-package installation operations
  - Lock file created at `~/.socket/_dlx/<hash>/.lock` (similar to npm npx's `concurrency.lock`)
  - Prevents concurrent installations from corrupting the same package cache
  - Uses 5-second stale timeout and 2-second periodic touching (aligned with npm npx)
  - Double-check pattern verifies installation after acquiring lock to avoid redundant work
  - Completes 100% alignment with npm's npx locking strategy

## [2.6.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.6.0) - 2025-10-28

### Changed

- **Process locking aligned with npm npx**: Enhanced process-lock module to match npm's npx locking strategy
  - Reduced stale timeout from 10 seconds to 5 seconds (matches npm npx)
  - Added periodic lock touching (2-second interval) to prevent false stale detection during long operations
  - Implemented second-level granularity for mtime comparison to avoid APFS floating-point precision issues
  - Added automatic touch timer cleanup on process exit
  - Timers use `unref()` to prevent keeping process alive
  - Aligns with npm's npx implementation per https://github.com/npm/cli/pull/8512

## [2.5.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.5.0) - 2025-10-28

### Added

- **Process locking utilities**: Added `ProcessLockManager` class providing cross-platform inter-process synchronization using file-system based locks
  - Atomic lock acquisition via `mkdir()` for thread-safe operations
  - Stale lock detection with automatic cleanup (default 10 seconds, aligned with npm's npx strategy)
  - Exponential backoff with jitter for retry attempts
  - Process exit handlers for guaranteed cleanup even on abnormal termination
  - Three main APIs: `acquire()`, `release()`, and `withLock()` (recommended)
  - Comprehensive test suite with `describe.sequential` for proper isolation
  - Export: `@socketsecurity/lib/process-lock`

### Changed

- **Script refactoring**: Renamed `spinner.succeed()` to `spinner.success()` for consistency
- **Script cleanup**: Removed redundant spinner cleanup in interactive-runner

## [2.4.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.4.0) - 2025-10-28

### Changed

- **Download locking aligned with npm**: Reduced default `staleTimeout` in `downloadWithLock()` from 300 seconds to 10 seconds to align with npm's npx locking strategy
  - Prevents stale locks from blocking downloads for extended periods
  - Matches npm's battle-tested timeout range (5-10 seconds)
  - Binary downloads now protected against concurrent corruption
- **Binary download protection**: `dlxBinary.downloadBinary()` now uses `downloadWithLock()` to prevent corruption when multiple processes download the same binary concurrently
  - Eliminates race conditions during parallel binary downloads
  - Maintains checksum verification and executable permissions

## [2.3.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.3.0) - 2025-10-28

### Added

- **Binary utility wrapper functions**: Added `which()` and `whichSync()` wrapper functions to `bin` module
  - Cross-platform binary lookup that respects PATH environment variable
  - Synchronous and asynchronous variants for different use cases
  - Integrates with existing binary resolution utilities

## [2.2.1](https://github.com/SocketDev/socket-lib/releases/tag/v2.2.1) - 2025-10-28

### Fixed

- **Logger write() method**: Fixed `write()` to bypass Console formatting when outputting raw text
  - Previously, `write()` used Console's internal `_stdout` stream which applied unintended formatting like group indentation
  - Now stores a reference to the original stdout stream in a dedicated private field (`#originalStdout`) during construction
  - The `write()` method uses this stored reference to write directly to the raw stream, bypassing all Console formatting layers
  - Ensures raw text output without any formatting applied, fixing test failures in CI environments where writes after `indent()` were unexpectedly formatted

## [2.2.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.2.0) - 2025-10-28

### Added

- **Logger step symbol**: `logger.step()` now displays a cyan arrow symbol (→ or > in ASCII) before step messages for improved visual separation
  - New `LOG_SYMBOLS.step` symbol added to the symbol palette
  - Automatic stripping of existing symbols from step messages
  - Maintains existing blank line behavior for clear step separation

## [2.1.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.1.0) - 2025-10-28

### Added

- Package manager detection utilities (`detectPackageManager()`, `getPackageManagerInfo()`, `getPackageManagerUserAgent()`)
- `isInSocketDlx()` utility to check if file path is within `~/.socket/_dlx/`
- `downloadPackage()` and `executePackage()` functions for separate download and execution of packages

## [2.0.0](https://github.com/SocketDev/socket-lib/releases/tag/v2.0.0) - 2025-10-27

### Breaking Changes

**Environment Variable System Refactor**

This release completely refactors the environment variable system, consolidating 60+ individual env constant files into grouped getter modules with AsyncLocalStorage-based test rewiring.

**Consolidated env files** - Individual files replaced with grouped modules:

- `env/github.ts` - All GitHub-related env vars (GITHUB_TOKEN, GH_TOKEN, GITHUB_API_URL, etc.)
- `env/socket.ts` - Socket-specific env vars (SOCKET_API_TOKEN, SOCKET_CACACHE_DIR, etc.)
- `env/socket-cli.ts` - Socket CLI env vars (SOCKET_CLI_API_TOKEN, SOCKET_CLI_CONFIG, etc.)
- `env/npm.ts` - NPM-related env vars
- `env/locale.ts` - Locale env vars (LANG, LC_ALL, LC_MESSAGES)
- `env/windows.ts` - Windows-specific env vars (USERPROFILE, LOCALAPPDATA, APPDATA, COMSPEC)
- `env/xdg.ts` - XDG base directory env vars
- `env/temp-dir.ts` - Temp directory env vars (TEMP, TMP, TMPDIR)
- `env/test.ts` - Test framework env vars (VITEST, JEST_WORKER_ID)

**Constants → Getter functions** - All env constants converted to functions:

```typescript
// Before (v1.x):
import { GITHUB_TOKEN } from '#env/github-token'

// After (v2.x):
import { getGithubToken } from '#env/github'
```

**Deleted files** - Removed 60+ individual env constant files:

- `env/github-token.ts`, `env/socket-api-token.ts`, etc. → Consolidated into grouped files
- `env/getters.ts` → Functions moved to their respective grouped files

### Added

**AsyncLocalStorage-Based Test Rewiring**

New `env/rewire.ts` and `path/rewire.ts` modules provides context-isolated environment variable overrides for testing:

```typescript
import { withEnv, setEnv, resetEnv, getEnvValue } from '#env/rewire'

// Option 1: Isolated context with AsyncLocalStorage
await withEnv({ CI: '1', NODE_ENV: 'test' }, async () => {
  // CI env var is '1' only within this block
  // Concurrent tests don't interfere
})

// Option 2: Traditional beforeEach/afterEach pattern
beforeEach(() => {
  setEnv('CI', '1')
})

afterEach(() => {
  resetEnv()
})
```

**Features:**

- Allows toggling between snapshot and live behavior
- Compatible with `vi.stubEnv()` as fallback

### Changed

- Updated all dynamic `require()` statements to use path aliases (`#constants/*`, `#packages/*`)
- Improved logger blank line tracking per stream (separate stderr/stdout tracking)
- Exported `getCacache()` function for external use

## [1.3.6](https://github.com/SocketDev/socket-lib/releases/tag/v1.3.6) - 2025-10-26

### Fixed

- Fixed `debug` module functions being incorrectly tree-shaken as no-ops in bundled output
  - Removed incorrect `/*@__NO_SIDE_EFFECTS__*/` annotations from `debug()`, `debugDir()`, `debugLog()`, and their `*Ns` variants
  - These functions have side effects (logging output, spinner manipulation) and should not be removed by bundlers
  - Fixes issue where `debugLog()` and `debugDir()` were compiled to empty no-op functions

## [1.3.5](https://github.com/SocketDev/socket-lib/releases/tag/v1.3.5) - 2025-10-26

### Added

- Added `createEnvProxy()` utility function to `env` module for Windows-compatible environment variable access
  - Provides case-insensitive environment variable access (e.g., PATH, Path, path all work)
  - Smart priority system: overrides > exact match > case-insensitive fallback
  - Full Proxy implementation with proper handlers for get, set, has, ownKeys, getOwnPropertyDescriptor
  - Opt-in helper for users who need Windows env var compatibility
  - Well-documented with usage examples and performance notes
- Added `findCaseInsensitiveEnvKey()` utility function to `env` module
  - Searches for environment variable keys using case-insensitive matching
  - Optimized with length fast path to minimize expensive `toUpperCase()` calls
  - Useful for cross-platform env var access where case may vary (e.g., PATH vs Path vs path)
- Added comprehensive test suite for `env` module with 71 tests
  - Covers `envAsBoolean()`, `envAsNumber()`, `envAsString()` conversion utilities
  - Tests `createEnvProxy()` with Windows environment variables and edge cases
  - Validates `findCaseInsensitiveEnvKey()` optimization and behavior

### Fixed

- Fixed `spawn` module to preserve Windows `process.env` Proxy behavior
  - When no custom environment variables are provided, use `process.env` directly instead of spreading it
  - Preserves Windows case-insensitive environment variable access (PATH vs Path)
  - Fixes empty CLI output issue on Windows CI runners
  - Only spreads `process.env` when merging custom environment variables

## [1.3.4](https://github.com/SocketDev/socket-lib/releases/tag/v1.3.4) - 2025-10-26

### Added

- Added Node.js SIGUSR1 signal handler prevention utilities in `constants/node` module
  - `supportsNodeDisableSigusr1Flag()`: Detects if Node supports `--disable-sigusr1` flag (v22.14+, v23.7+, v24.8+)
  - `getNodeDisableSigusr1Flags()`: Returns appropriate flags to prevent debugger attachment
    - Returns `['--disable-sigusr1']` on supported versions (prevents Signal I/O Thread creation)
    - Falls back to `['--no-inspect']` on Node 18+ (blocks debugger but still creates thread)
  - Enables production CLI environments to prevent SIGUSR1 debugger signal handling for security

## [1.3.3](https://github.com/SocketDev/socket-lib/releases/tag/v1.3.3) - 2025-10-24

### Fixed

- Fixed lazy getter bug in `objects` module where `defineGetter`, `defineLazyGetter`, and `defineLazyGetters` had incorrect `/*@__NO_SIDE_EFFECTS__*/` annotations
  - These functions mutate objects by defining properties, so marking them as side-effect-free caused esbuild to incorrectly tree-shake the calls during bundling
  - Lazy getters were returning `undefined` instead of their computed values
  - Removed double wrapping in `defineLazyGetters` where `createLazyGetter` was being called unnecessarily

## [1.3.2](https://github.com/SocketDev/socket-lib/releases/tag/v1.3.2) - 2025-10-24

### Fixed

- Continued fixing of broken external dependency bundling

## [1.3.1](https://github.com/SocketDev/socket-lib/releases/tag/v1.3.1) - 2025-10-24

### Fixed

- Fixed @inquirer modules (`input`, `password`, `search`) not being properly bundled into `dist/external/`
  - Resolves build failures in downstream packages (socket-cli) that depend on socket-lib
  - Added missing packages to bundling configuration in `scripts/build-externals.mjs`
  - All @inquirer packages now ship as zero-dependency bundles

### Added

- Added tests to prevent rogue external stubs in `dist/external/`
  - Detects stub re-export patterns that indicate incomplete bundling
  - Verifies all @inquirer modules are properly bundled (> 1KB)
  - Catches bundling regressions early in CI pipeline

## [1.3.0](https://github.com/SocketDev/socket-lib/releases/tag/v1.3.0) - 2025-10-23

### Added

- Added `validateFiles()` utility function to `fs` module for defensive file access validation
  - Returns `ValidateFilesResult` with `validPaths` and `invalidPaths` arrays
  - Filters out unreadable files before processing (common with Yarn Berry PnP virtual filesystem, pnpm symlinks)
  - Prevents ENOENT errors when files exist in glob results but are not accessible
  - Comprehensive test coverage for all validation scenarios

## [1.2.0](https://github.com/SocketDev/socket-lib/releases/tag/v1.2.0) - 2025-10-23

### Added

- Added `dlx-package` module for installing and executing npm packages directly
  - Content-addressed caching using SHA256 hash (like npm's \_npx)
  - Auto-force for version ranges (^, ~, >, <) to get latest within range
  - Cross-platform support with comprehensive tests (30 tests)
  - Parses scoped and unscoped package specs correctly
  - Resolves binaries from package.json bin field

### Changed

- Unified DLX storage under `~/.socket/_dlx/` directory
  - Binary downloads now use `~/.socket/_dlx/` instead of non-existent cache path
  - Both npm packages and binaries share parent directory with content-addressed hashing
- Updated paths.ts documentation to clarify unified directory structure

## [1.1.2] - 2025-10-23

### Fixed

- Fixed broken relative import paths in `packages/isolation.ts` and `packages/provenance.ts` that prevented bundling by external tools

## [1.1.1] - 2025-10-23

### Fixed

- Fixed shimmer text effects not respecting CI environment detection (now disabled in CI to prevent ANSI escape codes in logs)

## [1.1.0] - 2025-10-23

### Added

- Added `filterOutput` option to `stdio/mask` for filtering output chunks before display/buffering
- Added `overrideExitCode` option to `stdio/mask` for customizing exit codes based on captured output
- Added comprehensive JSDoc documentation across entire library for enhanced VSCode IntelliSense
  - Detailed @param, @returns, @template, @throws tags
  - Practical @example blocks with real-world usage patterns
  - @default tags showing default values
  - Enhanced interface property documentation

### Changed

- Improved TypeScript type hints and tooltips throughout library
- Enhanced documentation for all core utilities (arrays, fs, git, github, http-request, json, logger, objects, path, promises, spawn, spinner, strings)
- Enhanced documentation for stdio utilities (clear, divider, footer, header, mask, progress, prompts, stderr, stdout)
- Enhanced documentation for validation utilities (json-parser, types)

## [1.0.5] - 2025-10-22

### Added

- Added support for custom retry delays from onRetry callback

## [1.0.4] - 2025-10-21

### Fixed

- Fixed external dependency paths in root-level source files (corrected require paths from `../external/` to `./external/` in bin, cacache, fs, globs, spawn, spinner, and streams modules)

## [1.0.3] - 2025-10-21

### Fixed

- Fixed external dependency import paths in packages and stdio modules (corrected require paths from `../../external/` to `../external/`)

## [1.0.2] - 2025-10-21

### Fixed

- Fixed module resolution error in packages/normalize module (corrected require path from `../../constants/socket` to `../constants/socket`)

## [1.0.1] - 2025-10-21

### Fixed

- Fixed relative import paths in compiled CommonJS output (changed `require("../external/...")` to `require("./external/...")` for root-level dist files)

## [1.0.0] - 2025-10-20

### Changed

- Consolidated parseArgs into argv/parse module

---

**Historical Entries**: The entries below are from when this package was named `@socketsecurity/registry`. This package was renamed to `@socketsecurity/lib` starting with version 1.0.0.

---

## [1.5.3] - 2025-10-07

### Added

- Fix bad build and add validation to prevent in future

## [1.5.2] - 2025-10-07

### Added

- Added coverage utilities to parse v8 and type coverage reports

### Fixed

- Fixed `isPath` function to exclude URLs with protocols
- Fixed `isolatePackage` to handle file: URLs and npm-package-arg paths correctly

## [1.5.1] - 2025-10-05

### Added

- Added `isolatePackage` to `lib/packages/isolation` for creating isolated package test environments

### Changed

- Removed `dependencies/index` barrel file to prevent eager loading of all dependency modules

## [1.5.0] - 2025-10-05

### Added

- Added support for testing local development packages in addition to socket-registry packages
- Exposed isolation module as part of public API via `lib/packages`

### Changed

- Renamed `setupPackageTest` to `isolatePackage` for clearer intent
- Refactored `installPackageForTesting` to accept explicit `sourcePath` and `packageName` parameters
- Simplified package installation logic by removing path detection from low-level function
- Consolidated `setupPackageTest` and `setupMultiEntryTest` into single `isolatePackage` function with options

## [1.4.6] - 2025-10-05

### Added

- Added comprehensive package.json exports validation tests

## [1.4.5] - 2025-10-05

### Added

- Added performance monitoring utilities with timer, measurement, and reporting functions
- Added memoization utilities with LRU, TTL, weak references, and promise deduplication support
- Added table formatting utilities (`formatTable`, `formatSimpleTable`) for CLI output
- Added progress tracking to spinner with `updateProgress()` and `incrementProgress()` methods
- Added `isDir` and `safeStats` async helpers to fs module

### Changed

- Removed `platform` and `arch` options from `dlxBinary` function as cross-platform binary execution is not supported

### Fixed

- Fixed Windows shell execution in `dlxBinary` by adding cache directory to PATH

## [1.4.4] - 2025-10-05

### Fixed

- Fixed subpath exports

## [1.4.3] - 2025-10-04

### Added

- Spinner lifecycle utilities (`withSpinner`, `withSpinnerRestore`, `withSpinnerSync`) for automatic spinner cleanup with try/finally blocks

## [1.4.2] - 2025-10-04

### Added

- Added `GITHUB_API_BASE_URL` constant for GitHub API endpoint configuration
- Added `SOCKET_API_BASE_URL` constant for Socket API endpoint configuration
- Added generic TTL cache utility (`createTtlCache`) with in-memory memoization and persistent storage support

### Changed

- Refactored GitHub caching to use the new `cache-with-ttl` utility for better performance and consistency

## [1.4.1] - 2025-10-04

### Changed

- Update maintained Node.js versions of `constants.maintainedNodeVersions`

## [1.4.0] - 2025-10-04

### Added

- Added `PromiseQueue` utility for controlled concurrency operations
- Added lazy dependency loaders and test utilities
- Added HTTP utilities with retry logic and download locking
- Added `.claude` directory for scratch documents
- Added `noUnusedLocals` and `noUnusedParameters` to TypeScript config

### Changed

- Refactored all library functions to use options objects for better API consistency
  - `lib/strings.ts` - String manipulation functions
  - `lib/url.ts` - URL handling functions
  - `lib/words.ts` - Word manipulation functions
- Refactored `lib/packages` module into specialized submodules for improved code organization
  - `lib/packages/editable.ts` - Package editing functionality
  - `lib/packages/exports.ts` - Export resolution utilities
  - `lib/packages/licenses.ts` - License handling and validation
  - `lib/packages/manifest.ts` - Manifest data operations
  - `lib/packages/normalize.ts` - Path normalization utilities
  - `lib/packages/operations.ts` - Package installation and modification operations
  - `lib/packages/paths.ts` - Package path utilities
  - `lib/packages/provenance.ts` - Package provenance verification
  - `lib/packages/specs.ts` - Package spec parsing
  - `lib/packages/validation.ts` - Package validation utilities
- Moved configuration files (vitest, eslint, knip, oxlint, taze) to `.config` directory
- Replaced `fetch()` with Node.js native `http`/`https` modules for better reliability
- Replaced `any` types with meaningful types across library utilities
- Improved pnpm security with build script allowlist
- Updated vitest coverage thresholds to 80%
- Consolidated test files to reduce duplication
- Note: Public API remains unchanged; these are internal organizational improvements

### Fixed

- Fixed resource leaks and race conditions in socket-registry
- Fixed `yarn-cache-path` constant to return string type consistently
- Fixed Yarn Windows temp path detection in `shouldSkipShadow`
- Fixed path normalization for Windows compatibility across all path utilities
- Fixed cache path tests for Windows case sensitivity
- Fixed type errors in promises, parse-args, logger, and specs tests
- Fixed GitHub tests to mock `httpRequest` correctly
- Fixed SEA build tests to mock `httpRequest`
- Decoded URL percent-encoding in `pathLikeToString` fallback

## [1.3.10] - 2025-10-03

### Added

- New utility modules for DLX, shadow, SEA, cacache, and versions functionality
- getSocketHomePath alias to paths module
- del dependency and external wrapper for safer file deletion
- @fileoverview tags to lib modules
- camelCase expansion for kebab-case arguments in parseArgs
- Coerce and configuration options to parseArgs

### Changed

- Updated file removal to use del package for safer deletion
- Normalized path returns in fs and Socket directory utilities
- Removed default exports from git and parse-args modules
- Enhanced test coverage across multiple modules (parse-args, prompts, strings, env, spawn, json)

## [1.3.9] - 2025-10-03

### Changed

- Internal build and distribution updates

## [1.3.8] - 2025-10-03

### Added

- Added unified directory structure for Socket ecosystem tools
- New path utilities module for cross-platform directory resolution
- Directory structure constants for Socket CLI, Registry, Firewall, and DLX

## [1.3.7] - 2025-10-02

### Changed

- Updated manifest.json entries

## [1.3.6] - 2025-10-01

### Fixed

- Fixed indent-string interoperability with older v1 and v2 versions

## [1.3.5] - 2025-10-01

### Added

- Added lib/git utilities module

### Fixed

- Fixed invalid manifest entries
- Fixed parseArgs strip-aliased bug

## [1.3.4] - 2025-10-01

### Changed

- Updated various package override versions

## [1.3.3] - 2025-10-01

### Fixed

- Fixed normalizePath collapsing multiple leading `..` segments incorrectly

## [1.3.2] - 2025-10-01

### Added

- Added 'sfw' to isBlessedPackageName method check
- Added ENV.DEBUG normalization for debug package compatibility
  - `DEBUG='1'` or `DEBUG='true'` automatically expands to `DEBUG='*'` (enables all namespaces)
  - `DEBUG='0'` or `DEBUG='false'` automatically converts to empty string (disables all output)
  - Namespace patterns like `DEBUG='app:*'` are preserved unchanged

## [1.3.1] - 2025-09-30

### Changed

- Renamed debug functions from *Complex to *Ns

### Fixed

- Fixed regression with lib/prompts module imports

## [1.3.0] - 2025-09-29

### Changed

- Updated registry subpath exports

### Fixed

- Fixed Node.js built-in module imports in CommonJS output

## [1.2.2] - 2025-09-29

### Changed

- Internal improvements to module structure

## [1.2.1] - 2025-09-29

### Changed

- Restructured constants module with new architecture
- Updated build configuration and package exports
