/**
 * @file Types for the v1 threat-campaigns endpoints (public API — not hidden
 *   from the OpenAPI spec, but no generated schema exists in this SDK yet, so
 *   the types are hand-written and derived directly from the depscan route
 *   schemas, mirroring the precedent set by full-scans-v1.mts).
 */

export type ThreatCampaignStatus = 'ongoing' | 'past'

export type ThreatCampaign = {
  blogUrls: string[]
  description: string
  ecosystem: string[] | null
  firstDiscovered: string | null
  id: string
  lastActivity: string | null
  name: string
  status: ThreatCampaignStatus
  updatedAt: string
}

export type ListThreatCampaignsOptions = {
  cursor?: string | undefined
  ecosystem?: string | undefined
  per_page?: number | undefined
  status?: ThreatCampaignStatus | undefined
  updated_after?: string | undefined
}

export type ThreatCampaignsListData = {
  endCursor?: string | null | undefined
  items: ThreatCampaign[]
}

export type ListThreatCampaignsResult = {
  cause: undefined
  data: ThreatCampaignsListData
  error: undefined
  status: 200
  success: true
}

export type GetThreatCampaignResult = {
  cause: undefined
  data: ThreatCampaign
  error: undefined
  status: 200
  success: true
}

export type ListThreatCampaignPackagesOptions = {
  cursor?: string | undefined
  per_page?: number | undefined
}

export type ThreatCampaignPackagesData = {
  endCursor?: string | null | undefined
  items: string[]
}

export type ListThreatCampaignPackagesResult = {
  cause: undefined
  data: ThreatCampaignPackagesData
  error: undefined
  status: 200
  success: true
}
