/**
 * @file Patch-domain response types for Socket SDK (view, search-by-CVE/
 *   GHSA/PURL, batch search, records, package download references, package
 *   grant stats/lookup). Split out of `core.mts` to keep that file under
 *   the file-size cap.
 */
/* c8 ignore start - Type definitions only, no runtime code to test. */

export type PatchFile = {
  afterHash?: string | undefined
  beforeHash?: string | undefined
  socketBlob?: string | null | undefined
}

export type Vulnerability = {
  cves: string[]
  description: string
  severity: string
  summary: string
}

export type SecurityAlert = {
  description: string
  severity: string
  summary: string
  cveId?: string | null | undefined
  ghsaId?: string | null | undefined
}

export type PatchRecord = {
  description: string
  license: string
  publishedAt: string
  securityAlerts: SecurityAlert[]
  tier: 'free' | 'paid'
  uuid: string
}

export type PatchViewResponse = {
  description: string
  files: Record<string, PatchFile>
  license: string
  publishedAt: string
  purl: string
  tier: 'free' | 'paid'
  uuid: string
  vulnerabilities: Record<string, Vulnerability>
}

export type ArtifactPatches = {
  artifactId: string
  patches: PatchRecord[]
}

export type PatchSearchResult = {
  description: string
  license: string
  publishedAt: string
  purl: string
  tier: 'free' | 'paid'
  uuid: string
  vulnerabilities: Record<string, Vulnerability>
}

export type PatchSearchResponse = {
  canAccessPaidPatches: boolean
  patches: PatchSearchResult[]
}

export type PatchArtifactIntegrity = {
  dirhashH1: string | null
  goModH1: string | null
  md5: string | null
  sha1: string | null
  sha256: string | null
  sha512: string | null
  yarnBerry10c0: string | null
}

export type PatchArtifact = {
  contentType: string
  integrity: PatchArtifactIntegrity
  kind: string
  sizeBytes: number | null
  url: string | null
}

export type PatchRegistryOverrideIdentifiers = {
  cargoCksumSha256: string | null
  gemChecksumSha256: string | null
  goModH1: string | null
  goModulePath: string | null
  goModuleVersion: string | null
  goZipDirhashH1: string | null
  mavenArtifactId: string | null
  mavenGroupId: string | null
  mavenPomSha256: string | null
  mavenSuffixedVersion: string | null
  name: string
  nugetIdLower: string | null
  nugetVersionNorm: string | null
  version: string
}

export type PatchRegistryOverride = {
  identifiers: PatchRegistryOverrideIdentifiers
  indexUrl: string
  kind: string
}

export type PatchPackageResult = {
  artifacts: PatchArtifact[]
  purl: string | null
  registryOverride: PatchRegistryOverride | null
  status:
    | 'granted'
    | 'reused'
    | 'pending_build'
    | 'build_failed'
    | 'withdrawn'
    | 'forbidden'
    | 'not_found'
  url: string | null
}

export type GetPatchPackagesResponse = {
  results: Record<string, PatchPackageResult>
}

export type PatchPackageStatsResult = {
  downloadCount: number
  expiresAt: string | null
  grantedAt: string | null
  lastDownloadAt: string | null
  patchUuid: string | null
  purl: string | null
  revokedAt: string | null
  status: 'active' | 'revoked' | 'expired' | 'not_found'
}

export type PatchPackageStatsResponse = {
  results: Record<string, PatchPackageStatsResult>
}

export type LookupPatchPackageResult = {
  patchUuid: string | null
  status: 'active' | 'revoked' | 'expired' | 'not_found'
}

export type LookupPatchPackageResponse = {
  results: Record<string, LookupPatchPackageResult>
}

export type PatchesSkippedComponent = {
  purl: string
  reason: string
}

export type PatchesBatchResponse = {
  canAccessPaidPatches: boolean
  packages: ArtifactPatches[]
  skipped: PatchesSkippedComponent[]
}

export type PatchRecordFile = {
  afterHash?: string | undefined
  beforeHash?: string | undefined
}

export type PatchRecordDetail = {
  description: string
  files: Record<string, PatchRecordFile>
  license: string
  publishedAt: string
  purl: string
  tier: 'free' | 'paid'
  uuid: string
  vulnerabilities: Record<string, Vulnerability>
}

export type PatchRecordsResponse = {
  forbidden: string[]
  missing: string[]
  records: Record<string, PatchRecordDetail>
}
