# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.5.0](https://github.com/SocketDev/socket-sdk-js/releases/tag/v1.5.0) - 2025-09-22

### Changed
- **BREAKING:** Renamed `getOrgFullScan` to `streamOrgFullScan` for clarity
- Added `getOrgFullScanBuffered` method for buffered full scan retrieval

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
