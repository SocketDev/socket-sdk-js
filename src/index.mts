/**
 * @file Main entry point for the Socket SDK. Provides the SocketSdk class and
 *   utility functions for Socket security analysis API interactions.
 */

/* c8 ignore start - Re-export module, no testable logic */
// Re-export the content-addressed blob helpers (socketusercontent.com).
export {
  fetchBlob,
  fetchChunkedBytes,
  fetchRawBytes,
  tryDecodeText,
} from './blob.mts'
export type {
  BlobResult,
  ChunkedFetchResult,
  FetchBlobOptions,
  RawFetchResult,
} from './blob.mts'
// Re-export the v1 content-addressed full-scan and blob-upload primitives.
export {
  assembleManifest,
  deriveApiV1BaseUrl,
  hashFile,
} from './full-scans-v1.mts'
export type {
  AssembledManifest,
  BlobRef,
  BlobUploadEntry,
  BlobsUploadData,
  CreateFullScanFromManifestParams,
  CreateFullScanFromManifestResult,
  FileHashResult,
  FullScanManifest,
  FullScanManifestEntry,
  FullScanV1CreatedData,
  FullScanV1PendingData,
  ManifestLocalEntry,
  SkippedManifestPath,
  UploadBlobsResult,
} from './full-scans-v1.mts'
// Re-export types for the v1 events endpoint.
export type {
  PostEventsData,
  PostEventsResult,
  SocketEvent,
} from './events-v1.mts'
// Re-export types for the v1 threat-campaigns endpoints.
export type {
  GetThreatCampaignResult,
  ListThreatCampaignPackagesOptions,
  ListThreatCampaignPackagesResult,
  ListThreatCampaignsOptions,
  ListThreatCampaignsResult,
  ThreatCampaign,
  ThreatCampaignPackagesData,
  ThreatCampaignStatus,
  ThreatCampaignsListData,
} from './threat-campaigns-v1.mts'
// Re-export HTTP client classes.
export { ResponseError } from './http-client.mts'
// Re-export quota utility functions.
export {
  calculateTotalQuotaCost,
  getAllMethodRequirements,
  getMethodRequirements,
  getMethodsByPermissions,
  getMethodsByQuotaCost,
  getQuotaCost,
  getQuotaUsageSummary,
  getRequiredPermissions,
  hasQuotaForMethods,
} from './quota-utils.mts'
// Re-export the main SocketSdk class.
export { SocketSdk } from './socket-sdk-class.mts'
// Re-export option/response types for the newer endpoint methods.
export type {
  CreateOrgRepoDiffOptions,
  GetOrgFullScanCsvOptions,
  GetOrgFullScanPdfOptions,
  HistoricalAlertsListOptions,
  HistoricalAlertsTrendOptions,
  HistoricalDependenciesTrendOptions,
  HistoricalSnapshotsListOptions,
} from './types-parity.mts'
// Re-export types from modules.
export type {
  ALERT_ACTION,
  ALERT_TYPE,
  Agent,
  ArtifactPatches,
  BatchPackageFetchResultType,
  BatchPackageStreamOptions,
  CompactSocketArtifact,
  CompactSocketArtifactAlert,
  CreateDependenciesSnapshotOptions,
  CustomResponseType,
  Entitlement,
  EntitlementsResponse,
  FileValidationCallback,
  FileValidationResult,
  GetOptions,
  GotOptions,
  HeadersRecord,
  MalwareCheckAlert,
  MalwareCheckPackage,
  MalwareCheckResult,
  MalwareCheckScore,
  PatchFile,
  PatchRecord,
  PatchViewResponse,
  TelemetryConfig,
  PostOrgTelemetryPayload,
  PostOrgTelemetryResponse,
  QueryParams,
  RequestInfo,
  RequestOptions,
  RequestOptionsWithHooks,
  ResponseInfo,
  SecurityAlert,
  SendMethod,
  SendOptions,
  SocketArtifact,
  SocketArtifactAlert,
  SocketArtifactWithExtras,
  SocketId,
  SocketMetricSchema,
  SocketSdkArrayElement,
  SocketSdkData,
  SocketSdkErrorResult,
  SocketSdkGenericResult,
  SocketSdkOperations,
  SocketSdkOptions,
  SocketSdkResult,
  SocketSdkSuccessResult,
  StreamOrgFullScanOptions,
  UploadManifestFilesError,
  UploadManifestFilesOptions,
  UploadManifestFilesResponse,
  UploadManifestFilesReturnType,
  Vulnerability,
} from './types.mts'
// Re-export strict types for v3 API.
export type {
  CreateFullScanOptions,
  DeleteRepositoryLabelResult,
  DeleteResult,
  FullScanItem,
  FullScanListData,
  FullScanListResult,
  FullScanResult,
  GetRepositoryOptions,
  ListFullScansOptions,
  ListRepositoriesOptions,
  OrganizationItem,
  OrganizationsResult,
  RepositoriesListData,
  RepositoriesListResult,
  RepositoryItem,
  RepositoryLabelItem,
  RepositoryLabelResult,
  RepositoryLabelsListData,
  RepositoryLabelsListResult,
  RepositoryListItem,
  RepositoryResult,
  StreamFullScanOptions,
  StrictErrorResult,
  StrictResult,
} from './types-strict.mts'
// Re-export functions from modules.
export { createUserAgentFromPkgJson } from './user-agent.mts'
/* c8 ignore stop */
