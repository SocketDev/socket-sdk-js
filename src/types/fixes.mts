/**
 * @file Fix computation requests and discriminated result details.
 */
import type { Purl, VulnerabilityId } from './keys.mts'
export type OrgFixesTarget =
  | {
      repo_slug: string
      full_scan_id?: never | undefined
      tar_hash?: never | undefined
    }
  | {
      repo_slug?: never | undefined
      full_scan_id: string
      tar_hash?: never | undefined
    }
  | {
      repo_slug?: never | undefined
      full_scan_id?: never | undefined
      tar_hash: string
    }

export type OrgFixesOptions = OrgFixesTarget & {
  vulnerability_ids: string
  allow_major_updates?: boolean | undefined
  minimum_release_age?: string | undefined
  include_details?: boolean | undefined
  include_responsible_direct_dependencies?: boolean | undefined
  include_all_detected_ghsas?: boolean | undefined
  include_stateful_alert_ids?: boolean | undefined
  autofix_run_id?: string | undefined
}

export type FixUpdateType = 'patch' | 'minor' | 'major' | 'unknown'
export type WithheldFixReason =
  | 'majorUpdate'
  | 'releaseAge'
  | 'publishDateUnknown'
export type WithheldFix = {
  purl: string
  version: string
  reason: WithheldFixReason
}
export type FixManifestFile = {
  file: string
  start?: number | undefined
  end?: number | undefined
}
export type FixToplevelAncestor = {
  purl: string
  manifestFiles: FixManifestFile[]
}
export type FixArtifact = {
  purl: string
  manifestFiles: string[]
  manifestFilesWithOffsets: FixManifestFile[]
  direct: boolean
  dev: boolean
  toplevelAncestors: FixToplevelAncestor[]
}
export type PackageFix = FixArtifact & {
  fixedVersion: string
  updateType: FixUpdateType
}
export type VulnerableFixArtifact = FixArtifact & {
  reasons?: string[] | undefined
  dependencyChain?: string[] | undefined
  withheldFix?: WithheldFix | undefined
}
export type UnfixablePurl = VulnerableFixArtifact & { reasons: string[] }
export type FixAdvisoryDetails = {
  title?: string | null | undefined
  description?: string | null | undefined
  cwes?: string[] | undefined
  severity?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | undefined
  cvssVector?: string | null | undefined
  publishedAt?: string | undefined
  kev?: boolean | undefined
  epss?: number | null | undefined
  affectedPurls?: Array<{ purl: string; affectedRange: string }> | undefined
}
export type FixVersionUpdate = { version: string; updateType: FixUpdateType }
export type ResponsibleDirectDependencies = Record<
  Purl,
  {
    currentVersion: string
    nextAvailableVersion?: FixVersionUpdate | null | undefined
    fixByUpgradingTo?: FixVersionUpdate | null | undefined
  }
> | null
export type FixAdvisoryReference = {
  ghsa: string
  cve: string | null
  advisoryDetails: FixAdvisoryDetails | null
}
export type FixFoundValue = FixAdvisoryReference & {
  type: 'fixFound'
  fixDetails: {
    fixes: PackageFix[]
    responsibleDirectDependencies?: ResponsibleDirectDependencies | undefined
  }
}
export type PartialFixFoundValue = FixAdvisoryReference & {
  type: 'partialFixFound'
  fixDetails: {
    fixes: PackageFix[]
    unfixablePurls: UnfixablePurl[]
    responsibleDirectDependencies?: ResponsibleDirectDependencies | undefined
  }
}
export type NoFixAvailableValue = FixAdvisoryReference & {
  type: 'noFixAvailable'
  vulnerableArtifacts: VulnerableFixArtifact[]
}
export type FixNotApplicableValue = FixAdvisoryReference & {
  type: 'fixNotApplicable'
  vulnerableArtifacts: VulnerableFixArtifact[]
}
export type ErrorComputingFixValue = Omit<FixAdvisoryReference, 'ghsa'> & {
  type: 'errorComputingFix'
  ghsa: string | null
  message: string
}
export type FixDetailValue =
  | FixFoundValue
  | PartialFixFoundValue
  | NoFixAvailableValue
  | FixNotApplicableValue
  | ErrorComputingFixValue
export type FixDetail = {
  [Variant in FixDetailValue as Variant['type']]: {
    type: Variant['type']
    value: Variant
  }
}[FixDetailValue['type']]
export type OrgFixesData = {
  fixDetails: Record<VulnerabilityId, FixDetail>
  allDetectedGhsas?: string[] | undefined
  statefulAlertIds?: Record<VulnerabilityId, string[]> | undefined
}
export type FixComputationStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
export type StartOrgFixComputationData = {
  id: string
  status: FixComputationStatus
}
export type OrgFixComputationData = StartOrgFixComputationData & {
  createdAt: string
  startedAt?: string | undefined
  finishedAt?: string | undefined
  failureReason?: string | undefined
  failureDetail?: string | undefined
  result?: OrgFixesData | undefined
}
