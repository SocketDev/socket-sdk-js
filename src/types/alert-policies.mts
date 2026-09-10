/**
 * @file Alert policy, rule, resolution, and migration request types.
 */
import type { operations } from '../../types/api.d.ts'

export type AlertPolicyWriteOptions = { dry_run?: boolean | undefined }

export type CreateOrgAlertPolicyBody =
  operations['createOrgAlertPolicy']['requestBody']['content']['application/json']
export type UpdateOrgAlertPolicyBody =
  operations['updateOrgAlertPolicy']['requestBody']['content']['application/json']
export type CreateOrgAlertPolicyRuleBody =
  operations['createOrgAlertPolicyRule']['requestBody']['content']['application/json']
export type UpdateOrgAlertPolicyRuleBody =
  operations['updateOrgAlertPolicyRule']['requestBody']['content']['application/json']
export type CreateOrgAlertResolutionBody =
  operations['createOrgAlertResolution']['requestBody']['content']['application/json']
export type TranslateOrgAlertPolicyMigrationTriageBody =
  operations['translateOrgAlertPolicyMigrationTriage']['requestBody']['content']['application/json']
