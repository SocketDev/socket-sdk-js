# @socketregistry/packageurl-js

[![Socket Badge](https://socket.dev/api/badge/npm/package/@socketregistry/packageurl-js)](https://socket.dev/npm/package/@socketregistry/packageurl-js)
[![CI - @socketregistry/packageurl-js](https://github.com/SocketDev/socket-packageurl-js/actions/workflows/ci.yml/badge.svg)](https://github.com/SocketDev/socket-packageurl-js/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/badge/coverage-99.72%25-brightgreen)

[![Follow @SocketSecurity](https://img.shields.io/twitter/follow/SocketSecurity?style=social)](https://twitter.com/SocketSecurity)
[![Follow @socket.dev on Bluesky](https://img.shields.io/badge/Follow-@socket.dev-1DA1F2?style=social&logo=bluesky)](https://bsky.app/profile/socket.dev)

TypeScript Package URL (purl) parser and builder.
Drop-in replacement for [`packageurl-js`](https://socket.dev/npm/package/packageurl-js) with full type safety, zero dependencies, and spec compliance with the [Package URL specification](https://github.com/package-url/purl-spec).

## What is a PURL?

A Package URL (purl) standardizes how to identify software packages:

```
pkg:npm/lodash@4.17.21
pkg:pypi/requests@2.28.1
pkg:maven/org.springframework/spring-core@5.3.21
```

**Format breakdown**:

```
  pkg:type/namespace/name@version?qualifiers#subpath
  │   │    │         │    │       │          │
  │   │    │         │    │       │          └─ Optional subpath
  │   │    │         │    │       └──────────── Optional key=value pairs
  │   │    │         │    └──────────────────── Optional version
  │   │    │         └───────────────────────── Required package name
  │   │    └─────────────────────────────────── Optional namespace/scope
  │   └──────────────────────────────────────── Required package type
  └──────────────────────────────────────────── Scheme (always "pkg:")
```

**Supports 35+ ecosystems**: npm, pypi, maven, gem, cargo, nuget, composer, golang, docker, and more.

## Features

- ✅ **Modular & tree-shakeable** - Import only what you need
- ✅ **Full TypeScript support** - Comprehensive type exports
- ✅ **Zero dependencies** - Lightweight and secure
- ✅ **Spec compliant** - Follows [purl-spec](https://github.com/package-url/purl-spec)
- ✅ **100% test coverage** - Over 1,000 passing tests
- ✅ **Multiple APIs** - Functional, class-based, and builder patterns
- ✅ **URL conversion** - Convert to repository and download URLs
- ✅ **Registry checks** - Verify package existence across 14 registries

## Install

```sh
pnpm install @socketregistry/packageurl-js
```

**Drop-in replacement** via package override:

```json
{
  "pnpm": {
    "overrides": {
      "packageurl-js": "npm:@socketregistry/packageurl-js@^1"
    }
  }
}
```

**Requirements**: Node >= 18.20.4

## Usage

### Modular Functions (Tree-shakeable)

**Parse npm specifiers:**

```javascript
import { parseNpmSpecifier } from '@socketregistry/packageurl-js'

parseNpmSpecifier('lodash@4.17.21')
// -> { namespace: undefined, name: 'lodash', version: '4.17.21' }

parseNpmSpecifier('@babel/core@^7.0.0')
// -> { namespace: '@babel', name: 'core', version: '7.0.0' }
```

**Stringify PURLs:**

```javascript
import { stringify } from '@socketregistry/packageurl-js'

stringify(purl)
// -> 'pkg:npm/lodash@4.17.21'
```

**Compare PURLs:**

```javascript
import { equals, compare } from '@socketregistry/packageurl-js'

equals(purl1, purl2) // -> boolean
compare(purl1, purl2) // -> -1 | 0 | 1
```

### Class API

**Parse and build:**

```javascript
import { PackageURL } from '@socketregistry/packageurl-js'

// Parse strings
const purl = PackageURL.fromString('pkg:npm/lodash@4.17.21')
console.log(purl.name) // 'lodash'
console.log(purl.version) // '4.17.21'

// Parse npm specifiers
PackageURL.fromNpm('lodash@4.17.21')
PackageURL.fromNpm('@babel/core@^7.0.0')

// Constructor
new PackageURL('npm', null, 'express', '4.18.2')
// -> 'pkg:npm/express@4.18.2'
```

**Builder pattern:**

```javascript
import { PurlBuilder } from '@socketregistry/packageurl-js'

PurlBuilder.npm().name('lodash').version('4.17.21').build()
// -> 'pkg:npm/lodash@4.17.21'
```

**URL conversion:**

```javascript
import { UrlConverter } from '@socketregistry/packageurl-js'

UrlConverter.toRepositoryUrl(purl)
// -> 'https://github.com/lodash/lodash'

UrlConverter.toDownloadUrl(purl)
// -> 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz'
```

**Registry existence checks:**

```javascript
import { purlExists, npmExists } from '@socketregistry/packageurl-js'

// Check if package exists in its registry
await purlExists(purl)
// -> { exists: true, latestVersion: '4.17.21' }

// Type-specific checks (modular)
await npmExists('lodash')
await npmExists('core', '@babel') // scoped package
await npmExists('lodash', undefined, '4.17.21') // validate version

// Supported registries:
// npmExists, pypiExists, cargoExists, gemExists,
// mavenExists, nugetExists, golangExists, packagistExists,
// cocoapodsExists, pubExists, hexExists, cpanExists,
// cranExists, hackageExists
```

### TypeScript Types

All types are exported for maximum flexibility:

```typescript
import type {
  PackageURLObject,
  NpmPackageComponents,
  ParsedPurlComponents,
  QualifiersObject,
  ComponentEncoder,
  DownloadUrl,
  RepositoryUrl,
} from '@socketregistry/packageurl-js'

// Type-safe npm package parsing
const components: NpmPackageComponents = parseNpmSpecifier('lodash@4.17.21')

// Type-safe PURL objects
const obj: PackageURLObject = purl.toObject()
```

**Constants:**

```typescript
import { PurlQualifierNames, PURL_Type } from '@socketregistry/packageurl-js'

// Standard qualifier keys
PurlQualifierNames.Checksum // 'checksum'
PurlQualifierNames.RepositoryUrl // 'repository_url'

// Package types
PURL_Type.NPM // 'npm'
PURL_Type.PYPI // 'pypi'
```

See [docs/types.md](docs/types.md) for complete type reference.

## API Reference

- **[docs/api.md](docs/api.md)** - Complete API documentation
- **[docs/types.md](docs/types.md)** - TypeScript type reference

## Development

**Quick commands:**

```bash
pnpm install   # Install dependencies
pnpm build     # Build
pnpm test      # Test
pnpm check     # Lint + typecheck
```

## License

MIT
