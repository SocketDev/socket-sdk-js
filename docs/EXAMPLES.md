# Examples

Practical examples for common Socket SDK usage patterns.

## Basic Setup

```typescript
import { SocketSdk } from '@socketsecurity/sdk'

// Initialize with production configuration
const client = new SocketSdk('your-api-key', {
  retries: 3,        // Retry failed requests up to 3 times
  retryDelay: 1000,  // Start with 1s delay, exponential backoff
  timeout: 30000,    // 30 second timeout
})
```

## Package Analysis

### Analyze Single Package

```typescript
// Get security score
const scoreResult = await client.getScoreByNpmPackage('express', '4.18.0')

if (scoreResult.success) {
  const { score, supplyChainRisk } = scoreResult.data
  console.log(`Security Score: ${score}/100`)
  console.log(`Supply Chain Risk: ${supplyChainRisk}`)
}

// Get detailed issues
const issuesResult = await client.getIssuesByNpmPackage('express', '4.18.0')

if (issuesResult.success) {
  for (const issue of issuesResult.data.issues) {
    console.log(`[${issue.severity}] ${issue.type}: ${issue.description}`)
  }
}
```

### Batch Package Analysis

```typescript
// Analyze multiple packages efficiently
const packages = [
  { purl: 'pkg:npm/express@4.18.0' },
  { purl: 'pkg:npm/react@18.0.0' },
  { purl: 'pkg:npm/vue@3.0.0' },
]

const result = await client.batchPackageFetch({ components: packages })

if (result.success) {
  for (const pkg of result.data) {
    console.log(`${pkg.name}@${pkg.version}: Score ${pkg.score}`)
  }
}
```

### Stream Package Analysis

```typescript
// Stream results for large batches
const packages = Array.from({ length: 100 }, (_, i) => ({
  purl: `pkg:npm/package-${i}@1.0.0`
}))

const stream = client.batchPackageStream(
  { components: packages },
  { concurrency: 10 }
)

for await (const result of stream) {
  if (result.success) {
    const pkg = result.data
    if (pkg.score < 70) {
      console.log(`⚠️ Low score: ${pkg.name} (${pkg.score})`)
    }
  }
}
```

## Security Scanning

### Full Project Scan

```typescript
import { glob } from 'fast-glob'

// Find all relevant files
const files = await glob([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
])

// Create full scan
const result = await client.createOrgFullScan(
  'my-org',
  files,
  process.cwd(),
  {
    branch: 'main',
    repo: 'my-repo',
  }
)

if (result.success) {
  console.log(`Scan initiated: ${result.data.id}`)

  // Poll for completion
  let scanComplete = false
  while (!scanComplete) {
    await new Promise(resolve => setTimeout(resolve, 5000))

    const metadata = await client.getOrgFullScanMetadata('my-org', result.data.id)
    if (metadata.success) {
      console.log(`Status: ${metadata.data.status}`)
      scanComplete = metadata.data.status === 'completed'
    }
  }

  // Get results
  const scanData = await client.getOrgFullScanBuffered('my-org', result.data.id)
  if (scanData.success) {
    console.log(`Found ${scanData.data.packages.length} packages`)
  }
}
```

### Compare Scans (Diff)

```typescript
// Create diff between two scans
const diffResult = await client.createOrgDiffScanFromIds('my-org', {
  from: 'scan_baseline',
  to: 'scan_current'
})

if (diffResult.success) {
  const diff = await client.getDiffScanById('my-org', diffResult.data.id)

  if (diff.success) {
    console.log(`\nAdded packages: ${diff.data.added.length}`)
    for (const pkg of diff.data.added) {
      console.log(`  + ${pkg.name}@${pkg.version}`)
    }

    console.log(`\nRemoved packages: ${diff.data.removed.length}`)
    for (const pkg of diff.data.removed) {
      console.log(`  - ${pkg.name}@${pkg.version}`)
    }

    console.log(`\nChanged packages: ${diff.data.changed.length}`)
    for (const pkg of diff.data.changed) {
      console.log(`  ~ ${pkg.name}: ${pkg.fromVersion} → ${pkg.toVersion}`)
    }
  }
}
```

## Organization Management

### List and Manage Repositories

```typescript
// List all repositories
const reposResult = await client.getOrgRepoList('my-org', {
  archived: false,
  limit: 100
})

if (reposResult.success) {
  console.log(`Found ${reposResult.data.repositories.length} repositories`)

  for (const repo of reposResult.data.repositories) {
    console.log(`${repo.name}: ${repo.default_branch}`)

    // Get detailed info
    const details = await client.getOrgRepo('my-org', repo.name)
    if (details.success) {
      console.log(`  Homepage: ${details.data.homepage}`)
      console.log(`  Visibility: ${details.data.visibility}`)
    }
  }
}
```

### Create and Configure Repository

```typescript
// Create new repository
const createResult = await client.createOrgRepo('my-org', {
  name: 'new-project',
  homepage: 'https://github.com/org/new-project',
  default_branch: 'main',
  visibility: 'public'
})

if (createResult.success) {
  console.log(`Repository created: ${createResult.data.id}`)

  // Update configuration
  const updateResult = await client.updateOrgRepo('my-org', 'new-project', {
    homepage: 'https://new-url.com',
    archived: false
  })

  if (updateResult.success) {
    console.log('Repository configuration updated')
  }
}
```

## Policy Management

### Security Policy

```typescript
// Get current policy
const policyResult = await client.getOrgSecurityPolicy('my-org')

if (policyResult.success) {
  console.log('Current security policy:', policyResult.data)

  // Update policy
  const updateResult = await client.updateOrgSecurityPolicy('my-org', {
    securityPolicyRules: {
      malware: { action: 'error' },
      vulnerability: { action: 'warn' },
      typosquat: { action: 'error' },
      shellScriptOverride: { action: 'monitor' }
    }
  })

  if (updateResult.success) {
    console.log('Security policy updated')
  }
}
```

### License Policy

```typescript
// Configure license policy
const updateResult = await client.updateOrgLicensePolicy('my-org', {
  allowed: ['MIT', 'Apache-2.0', 'BSD-3-Clause'],
  restricted: ['GPL-3.0', 'AGPL-3.0'],
  monitored: ['LGPL-2.1']
})

if (updateResult.success) {
  console.log('License policy updated')

  // Verify new policy
  const policy = await client.getOrgLicensePolicy('my-org')
  if (policy.success) {
    console.log('Allowed licenses:', policy.data.allowed)
    console.log('Restricted licenses:', policy.data.restricted)
  }
}
```

## Analytics and Monitoring

### Track Usage Metrics

```typescript
// Get organization analytics
const analyticsResult = await client.getOrgAnalytics('30d')

if (analyticsResult.success) {
  console.log('Last 30 days:')

  let totalScans = 0
  let totalIssues = 0

  for (const day of analyticsResult.data) {
    totalScans += day.scans
    totalIssues += day.issues
    console.log(`  ${day.date}: ${day.scans} scans, ${day.issues} issues`)
  }

  console.log(`\nTotal: ${totalScans} scans, ${totalIssues} issues`)
}
```

### Audit Log Review

```typescript
// Get recent audit events
const auditResult = await client.getAuditLogEvents('my-org', {
  limit: 50,
  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
})

if (auditResult.success) {
  console.log('Recent audit events:')

  for (const event of auditResult.data.events) {
    console.log(`[${event.timestamp}] ${event.user}: ${event.action}`)
    if (event.details) {
      console.log(`  Details: ${JSON.stringify(event.details)}`)
    }
  }
}
```

## Token Management

### Create and Rotate Tokens

```typescript
// Create new API token
const createResult = await client.postAPIToken('my-org', {
  name: 'CI/CD Pipeline',
  scopes: ['read:scans', 'write:scans', 'read:repos'],
  description: 'Token for automated CI/CD workflows'
})

if (createResult.success) {
  const token = createResult.data.token
  console.log('New token created (save this securely):')
  console.log(token)

  // Rotate token after some time
  const rotateResult = await client.postAPITokensRotate(
    'my-org',
    createResult.data.id
  )

  if (rotateResult.success) {
    console.log('Token rotated successfully')
    console.log('New token:', rotateResult.data.token)
  }
}
```

### List and Revoke Tokens

```typescript
// List all tokens
const tokensResult = await client.getAPITokens('my-org')

if (tokensResult.success) {
  console.log('Organization tokens:')

  for (const token of tokensResult.data.tokens) {
    console.log(`${token.name} (${token.id})`)
    console.log(`  Created: ${token.created_at}`)
    console.log(`  Scopes: ${token.scopes.join(', ')}`)

    // Revoke old tokens
    const tokenAge = Date.now() - new Date(token.created_at).getTime()
    if (tokenAge > 90 * 24 * 60 * 60 * 1000) { // 90 days
      console.log(`  ⚠️ Token older than 90 days, revoking...`)
      await client.postAPITokensRevoke('my-org', token.id)
    }
  }
}
```

## SBOM Export

### Export Software Bill of Materials

```typescript
// Export as CycloneDX
const cdxResult = await client.exportCDX('my-org', 'scan_123')

if (cdxResult.success) {
  const fs = await import('fs/promises')
  await fs.writeFile(
    'sbom-cyclonedx.json',
    JSON.stringify(cdxResult.data, null, 2)
  )
  console.log('CycloneDX SBOM exported')
}

// Export as SPDX
const spdxResult = await client.exportSPDX('my-org', 'scan_123')

if (spdxResult.success) {
  const fs = await import('fs/promises')
  await fs.writeFile(
    'sbom-spdx.json',
    JSON.stringify(spdxResult.data, null, 2)
  )
  console.log('SPDX SBOM exported')
}
```

## Error Handling

### Robust Error Handling

```typescript
async function analyzePackage(name: string, version: string) {
  const result = await client.getScoreByNpmPackage(name, version)

  if (!result.success) {
    // Handle specific error codes
    switch (result.status) {
      case 404:
        console.error(`Package ${name}@${version} not found`)
        break
      case 401:
        console.error('Invalid API token')
        break
      case 429:
        console.error('Rate limit exceeded')
        break
      default:
        console.error(`Error ${result.status}: ${result.error}`)
        if (result.cause) {
          console.error(`Cause: ${result.cause}`)
        }
    }
    return null
  }

  return result.data
}
```

### Retry Configuration

```typescript
// Configure aggressive retries for production
const productionClient = new SocketSdk('api-key', {
  retries: 5,
  retryDelay: 2000,
  timeout: 60000
})

// No retries for testing
const testClient = new SocketSdk('test-key', {
  retries: 0,
  timeout: 5000
})
```

## Advanced Streaming

### Process Large Scans

```typescript
import { createWriteStream } from 'fs'

// Stream scan data to file
const writeStream = createWriteStream('scan-results.json')

await client.streamOrgFullScan('my-org', 'scan_large', writeStream)

console.log('Scan data written to scan-results.json')
```

### Custom Response Processing

```typescript
// Get raw response for custom processing
const response = await client.getApi('/custom/endpoint', {
  responseType: 'response'
})

if (response.success) {
  const res = response.data
  console.log('Status:', res.statusCode)
  console.log('Headers:', res.headers)

  // Process stream manually
  let data = ''
  for await (const chunk of res) {
    data += chunk
  }
  console.log('Response:', data)
}
```

## Integration Patterns

### CI/CD Integration

```typescript
#!/usr/bin/env node

import { SocketSdk } from '@socketsecurity/sdk'

const client = new SocketSdk(process.env.SOCKET_API_KEY!, {
  retries: 3,
  timeout: 30000
})

async function ciScan() {
  // Create scan
  const scanResult = await client.createOrgFullScan(
    process.env.SOCKET_ORG!,
    ['package.json', 'package-lock.json'],
    process.cwd()
  )

  if (!scanResult.success) {
    console.error('Failed to create scan:', scanResult.error)
    process.exit(1)
  }

  console.log(`Scan created: ${scanResult.data.id}`)

  // Wait for completion
  let attempts = 0
  const maxAttempts = 60 // 5 minutes max

  while (attempts < maxAttempts) {
    const metadata = await client.getOrgFullScanMetadata(
      process.env.SOCKET_ORG!,
      scanResult.data.id
    )

    if (metadata.success) {
      if (metadata.data.status === 'completed') {
        console.log('Scan completed successfully')
        process.exit(0)
      } else if (metadata.data.status === 'failed') {
        console.error('Scan failed')
        process.exit(1)
      }
    }

    await new Promise(resolve => setTimeout(resolve, 5000))
    attempts++
  }

  console.error('Scan timeout')
  process.exit(1)
}

ciScan()
```

## See Also

- [API Reference](./API.md) - Complete API documentation
- [Quota Management](./QUOTA.md) - Quota utilities and cost management
- [Testing Utilities](./TESTING.md) - Testing helpers and mocks
