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
