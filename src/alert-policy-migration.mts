/**
 * @file Alert resolution creation and legacy alert policy migration requests.
 */
import { requestSdkJson } from './api-client.mts'
import { createOrgApiPath } from './org-api.mts'

import type { SdkApiContext } from './api-client.mts'
import type { SocketSdkData, SocketSdkGenericResult } from './types/core.mts'
import type {
  AlertPolicyWriteOptions,
  CreateOrgAlertResolutionBody,
  TranslateOrgAlertPolicyMigrationTriageBody,
} from './types/alert-policies.mts'

export function createOrgAlertResolution(
  context: SdkApiContext,
  orgSlug: string,
  body: CreateOrgAlertResolutionBody,
  options?: AlertPolicyWriteOptions | undefined,
): Promise<SocketSdkGenericResult<SocketSdkData<'createOrgAlertResolution'>>> {
  return requestSdkJson<SocketSdkData<'createOrgAlertResolution'>>(context, {
    body,
    method: 'POST',
    path: createOrgApiPath(orgSlug, 'alerts', 'resolutions'),
    query: options,
  })
}

export function getOrgAlertPolicyMigrationStatus(
  context: SdkApiContext,
  orgSlug: string,
): Promise<
  SocketSdkGenericResult<SocketSdkData<'getOrgAlertPolicyMigrationStatus'>>
> {
  return requestSdkJson<SocketSdkData<'getOrgAlertPolicyMigrationStatus'>>(
    context,
    {
      path: createOrgApiPath(orgSlug, 'alert-policies', 'migration', 'status'),
    },
  )
}

export function translateOrgAlertPolicyMigrationTriage(
  context: SdkApiContext,
  orgSlug: string,
  body: TranslateOrgAlertPolicyMigrationTriageBody,
): Promise<
  SocketSdkGenericResult<
    SocketSdkData<'translateOrgAlertPolicyMigrationTriage'>
  >
> {
  return requestSdkJson<
    SocketSdkData<'translateOrgAlertPolicyMigrationTriage'>
  >(context, {
    body,
    method: 'POST',
    path: createOrgApiPath(orgSlug, 'alert-policies', 'migration', 'translate'),
  })
}
