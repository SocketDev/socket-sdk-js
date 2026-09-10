/**
 * @file Typed organization alert policy requests.
 */
import { requestSdkJson } from './api-client.mts'
import { createOrgApiPath } from './org-api.mts'

import type { SdkApiContext } from './api-client.mts'
import type { SocketSdkData, SocketSdkGenericResult } from './types/core.mts'
import type {
  AlertPolicyWriteOptions,
  CreateOrgAlertPolicyBody,
  UpdateOrgAlertPolicyBody,
} from './types/alert-policies.mts'

export function createOrgAlertPolicy(
  context: SdkApiContext,
  orgSlug: string,
  body: CreateOrgAlertPolicyBody,
  options?: AlertPolicyWriteOptions | undefined,
): Promise<SocketSdkGenericResult<SocketSdkData<'createOrgAlertPolicy'>>> {
  return requestSdkJson<SocketSdkData<'createOrgAlertPolicy'>>(context, {
    body,
    method: 'POST',
    path: createOrgApiPath(orgSlug, 'alert-policies'),
    query: options,
  })
}

export function deleteOrgAlertPolicy(
  context: SdkApiContext,
  orgSlug: string,
  policyId: string,
  options?: AlertPolicyWriteOptions | undefined,
): Promise<SocketSdkGenericResult<SocketSdkData<'deleteOrgAlertPolicy'>>> {
  return requestSdkJson<SocketSdkData<'deleteOrgAlertPolicy'>>(context, {
    method: 'DELETE',
    path: createOrgApiPath(orgSlug, 'alert-policies', policyId),
    query: options,
  })
}

export function getOrgAlertPolicies(
  context: SdkApiContext,
  orgSlug: string,
): Promise<SocketSdkGenericResult<SocketSdkData<'getOrgAlertPolicies'>>> {
  return requestSdkJson<SocketSdkData<'getOrgAlertPolicies'>>(context, {
    path: createOrgApiPath(orgSlug, 'alert-policies'),
  })
}

export function getOrgAlertPolicy(
  context: SdkApiContext,
  orgSlug: string,
  policyId: string,
): Promise<SocketSdkGenericResult<SocketSdkData<'getOrgAlertPolicy'>>> {
  return requestSdkJson<SocketSdkData<'getOrgAlertPolicy'>>(context, {
    path: createOrgApiPath(orgSlug, 'alert-policies', policyId),
  })
}

export function updateOrgAlertPolicy(
  context: SdkApiContext,
  orgSlug: string,
  policyId: string,
  body: UpdateOrgAlertPolicyBody,
  options?: AlertPolicyWriteOptions | undefined,
): Promise<SocketSdkGenericResult<SocketSdkData<'updateOrgAlertPolicy'>>> {
  return requestSdkJson<SocketSdkData<'updateOrgAlertPolicy'>>(context, {
    body,
    method: 'PUT',
    path: createOrgApiPath(orgSlug, 'alert-policies', policyId),
    query: options,
  })
}
