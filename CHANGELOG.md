# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.8.4](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.8.4) - 2025-10-01

### Fixed
- Fixed registry constant import paths to use correct casing (SOCKET_PUBLIC_API_TOKEN, UNKNOWN_ERROR)

## [1.8.3](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.8.3) - 2025-09-30

### Changed
- Synced with OpenAPI definition

## [1.8.2](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.8.2) - 2025-09-29

### Fixed
- Fixed publishing workflow to ensure dist folder is built before npm publish
- Changed prepublishOnly script to prevent accidental local publishing

## [1.8.1](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.8.1) - 2025-09-29

### Changed
- Update test infrastructure and build configuration

## [1.8.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.8.0) - 2025-09-27

### Added
- Quota utility functions for API cost management in `quota-utils.ts`
- New exported functions: `checkQuota`, `formatQuotaReport`, `getEstimatedCost`, `getMethodCost`, `getQuotaSummary`, `isWithinQuota`
- Example files demonstrating quota usage patterns

### Changed
- Improved error handling for quota utilities

## [1.7.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.7.0) - 2025-09-26

### Added
- `getApi` method for raw GET requests with configurable response handling
- `sendApi` method for POST/PUT requests with JSON body support
- `CResult` type pattern for non-throwing API operations
- `CustomResponseType` type export for response type options
- Support for custom response types (`response`, `text`, `json`) in `getApi`
- Enhanced error handling with detailed error context from `error.details` field
- Socket API `error.details` parsing for richer error information
- `getEntitlements` method for retrieving organization entitlements
- `getEnabledEntitlements` method for getting enabled entitlement keys
- `viewPatch` method for retrieving patch details by UUID
- `streamPatchesFromScan` method for streaming patches from scan results
- `Entitlement` and `EntitlementsResponse` types for entitlements API
- `PatchFile`, `Vulnerability`, `SecurityAlert`, `PatchRecord`, `PatchViewResponse`, and `ArtifactPatches` types for patches API
- Support for NDJSON streaming responses in patches API
- Comprehensive test coverage improvements (484 total tests, 99.92% line coverage, 99.39% branch coverage)
- Enhanced error handling tests for JSON parsing edge cases in streaming
- Additional coverage tests for invalid JSON line handling in NDJSON streams

### Changed
- Improved error message formatting and JSON parsing error handling
- Enhanced type safety with better generic constraints
- Renamed option types to `GetOptions` and `SendOptions` for consistency
- Reorganized test files into focused, functionality-based modules
- Raised coverage thresholds to match achieved levels (100% statements, functions, lines)
- Removed duplicate tests while maintaining coverage integrity
- Renamed `getIssuesByNPMPackage` to `getIssuesByNpmPackage` for consistent naming convention
- Improved method alphabetical ordering in source code
- Enhanced test coverage from 99.77% to 99.92% line coverage
- Improved branch coverage from 99.08% to 99.39%

## [1.6.1](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.6.1) - 2025-09-24

### Changed
- Updated to use trusted publisher for npm package provenance

## [1.6.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.6.0) - 2025-09-24

### Changed
- **BREAKING:** Converted to single CommonJS export type, removing dual ESM/CJS support

## [1.5.1](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.5.1) - 2025-09-24

### Fixed
- Added missing setup-script to provenance workflow

## [1.5.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.5.0) - 2025-09-23

### Added
- `getOrgFullScanBuffered` method for buffered full scan retrieval

### Changed
- **BREAKING:** Renamed `getOrgFullScan` to `streamOrgFullScan` for clarity

### Fixed
- Added missing `getResponseJson` call to `createScanFromFilepaths`
- Improved handling of empty response bodies

## [1.4.93](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.93) - 2025-09-15

### Fixed
- Fixed malformed part header issue for upload of manifest files

## [1.4.91](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.91) - 2025-09-11

### Changed
- Improved URL handling

## [1.4.90](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.90) - 2025-09-11

### Fixed
- Improved error handling

## [1.4.84](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.84) - 2025-09-03

### Added
- Filter alerts by action

### Changed
- Improved JSON parsing

## [1.4.82](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.82) - 2025-09-02

### Changed
- Improved public policy handling

## [1.4.81](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.81) - 2025-09-02

### Added
- Add public security policy support

## [1.4.79](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.79) - 2025-08-27

### Fixed
- Fixed ESM module compatibility

## [1.4.77](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.77) - 2025-08-25

### Added
- Add timeout option for API requests

## [1.4.73](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.73) - 2025-08-08

### Fixed
- Fixed crates ecosystem support

## [1.4.72](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.72) - 2025-08-08

### Fixed
- Fixed rubygems ecosystem support

## [1.4.71](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.71) - 2025-08-08

### Added
- Support for crate and rubygem ecosystems

## [1.4.68](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.68) - 2025-08-02

### Changed
- Improved type definitions
- Memory usage optimizations

## [1.4.66](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.66) - 2025-07-29

### Fixed
- Fixed file upload timing issue
- Fixed multipart form data formatting

## [1.4.64](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.64) - 2025-07-22

### Changed
- Improved method signatures

## [1.4.62](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.62) - 2025-07-21

### Fixed
- Fixed query parameter handling for empty values

## [1.4.61](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.61) - 2025-07-21

### Changed
- Improved query parameter normalization

## [1.4.60](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.60) - 2025-07-21

### Changed
- Renamed result type for clarity

## [1.4.59](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.59) - 2025-07-20

### Added
- Add alias types for improved developer experience

## [1.4.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.4.0) - 2025-05-01

### Added
- Full scans feature support
- Audit log and repos features
- Organization security policy support (getOrgSecurityPolicy)

### Changed
- Improved TypeScript type exports
- Enhanced ESM and CJS dual package support

## [1.3.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.3.0) - 2025-03-01

### Added
- Support for multiple ecosystem types
- Enhanced error handling and reporting

### Changed
- Improved API client architecture
- Better TypeScript type definitions

## [1.2.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.2.0) - 2025-01-15

### Added
- File upload support for manifest files
- Request body creation for file paths

### Changed
- Enhanced multipart form data handling
- Improved streaming support

## [1.1.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.1.0) - 2024-11-01

### Added
- Query parameter normalization
- Enhanced search parameter handling

### Changed
- Improved URL parsing and handling
- Better error messages

## [1.0.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.0.0) - 2024-09-01

### Added
- Initial release of Socket SDK for JavaScript
- Full Socket API client implementation
- TypeScript support with comprehensive type definitions
- Dual ESM/CJS package support
