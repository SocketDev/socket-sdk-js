/**
 * @file Typed organization alert policy rule requests.
 */
import { requestSdkJson } from './api-client.mts'
import { createOrgApiPath } from './org-api.mts'

import type { SdkApiContext } from './api-client.mts'
import type { SocketSdkData, SocketSdkGenericResult } from './types/core.mts'
import type {
  AlertPolicyWriteOptions,
  CreateOrgAlertPolicyRuleBody,
  UpdateOrgAlertPolicyRuleBody,
} from './types/alert-policies.mts'

export function createOrgAlertPolicyRule(
  context: SdkApiContext,
  orgSlug: string,
  policyId: string,
  body: CreateOrgAlertPolicyRuleBody,
  options?: AlertPolicyWriteOptions | undefined,
): Promise<SocketSdkGenericResult<SocketSdkData<'createOrgAlertPolicyRule'>>> {
  return requestSdkJson<SocketSdkData<'createOrgAlertPolicyRule'>>(context, {
    body,
    method: 'POST',
    path: createOrgApiPath(orgSlug, 'alert-policies', policyId, 'rules'),
    query: options,
  })
}

export function deleteOrgAlertPolicyRule(
  context: SdkApiContext,
  orgSlug: string,
  policyId: string,
  ruleId: string,
  options?: AlertPolicyWriteOptions | undefined,
): Promise<SocketSdkGenericResult<SocketSdkData<'deleteOrgAlertPolicyRule'>>> {
  return requestSdkJson<SocketSdkData<'deleteOrgAlertPolicyRule'>>(context, {
    method: 'DELETE',
    path: createOrgApiPath(
      orgSlug,
      'alert-policies',
      policyId,
      'rules',
      ruleId,
    ),
    query: options,
  })
}

export function getOrgAlertPolicyRule(
  context: SdkApiContext,
  orgSlug: string,
  policyId: string,
  ruleId: string,
): Promise<SocketSdkGenericResult<SocketSdkData<'getOrgAlertPolicyRule'>>> {
  return requestSdkJson<SocketSdkData<'getOrgAlertPolicyRule'>>(context, {
    path: createOrgApiPath(
      orgSlug,
      'alert-policies',
      policyId,
      'rules',
      ruleId,
    ),
  })
}

export function getOrgAlertPolicyRules(
  context: SdkApiContext,
  orgSlug: string,
  policyId: string,
): Promise<SocketSdkGenericResult<SocketSdkData<'getOrgAlertPolicyRules'>>> {
  return requestSdkJson<SocketSdkData<'getOrgAlertPolicyRules'>>(context, {
    path: createOrgApiPath(orgSlug, 'alert-policies', policyId, 'rules'),
  })
}

export function updateOrgAlertPolicyRule(
  context: SdkApiContext,
  orgSlug: string,
  policyId: string,
  ruleId: string,
  body: UpdateOrgAlertPolicyRuleBody,
  options?: AlertPolicyWriteOptions | undefined,
): Promise<SocketSdkGenericResult<SocketSdkData<'updateOrgAlertPolicyRule'>>> {
  return requestSdkJson<SocketSdkData<'updateOrgAlertPolicyRule'>>(context, {
    body,
    method: 'PUT',
    path: createOrgApiPath(
      orgSlug,
      'alert-policies',
      policyId,
      'rules',
      ruleId,
    ),
    query: options,
  })
}
