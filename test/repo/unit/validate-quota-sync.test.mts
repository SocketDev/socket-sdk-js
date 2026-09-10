/**
 * @file Quota metadata rejects missing tags and unsupported operation aliases.
 */
import { describe, expect, it } from 'vitest'

import {
  extractMethods,
  resolveDataEntry,
  validateMethodQuota,
} from '../../../scripts/repo/validate-quota-sync.mts'

import type {
  MethodInfo,
  QuotaData,
} from '../../../scripts/repo/validate-quota-sync.mts'

const data: QuotaData = {
  api: {
    getQuota: { quota: 0, permissions: [] },
    createFullScan: { quota: 1, permissions: ['full-scans:create'] },
    getOrgRepo: { quota: 1, permissions: ['repo:list'] },
    getIssuesByNpmPackage: { quota: 1, permissions: [] },
    postOrgTelemetry: { quota: 0, permissions: [] },
  },
}

function quotaErrors(overrides: Partial<MethodInfo>): string[] {
  const errors: string[] = []
  validateMethodQuota(
    {
      name: 'getQuota',
      operationId: 'getQuota',
      hadOperationIdNone: false,
      jsdocQuota: 0,
      ...overrides,
    },
    data,
    errors,
  )
  return errors
}

describe('quota metadata validation', () => {
  it('respects explicit operation absence and extracts generic fallback with quota', () => {
    expect(
      extractMethods({
        source: `class SocketSdk {
      /** @operationId none */
      async localScan(): Promise<void> { return request<'ignored'>() }
      /** @quota 7 units */
      async readScan(): Promise<void> { return request<'getScan'>() }
    }`,
      }),
    ).toEqual([
      {
        hadOperationIdNone: true,
        jsdocQuota: undefined,
        name: 'localScan',
        operationId: undefined,
      },
      {
        hadOperationIdNone: false,
        jsdocQuota: 7,
        name: 'readScan',
        operationId: 'getScan',
      },
    ])
  })

  it('accepts zero-cost operations and verified SDK aliases', () => {
    expect(quotaErrors({})).toEqual([])
    expect(
      quotaErrors({
        name: 'createFullScan',
        operationId: 'CreateOrgFullScan',
        jsdocQuota: 1,
      }),
    ).toEqual([])
    expect(
      quotaErrors({
        name: 'getIssuesByNpmPackage',
        operationId: 'getIssuesByNPMPackage',
        jsdocQuota: 1,
      }),
    ).toEqual([])
  })

  it('resolves canonical operation metadata when the SDK method is an alias', () => {
    expect(
      resolveDataEntry(data, 'getOrgRepo', { methodName: 'getRepository' }),
    ).toEqual({
      key: 'getOrgRepo',
      entry: { quota: 1, permissions: ['repo:list'] },
    })
  })

  it.each([
    { operationId: undefined },
    { operationId: 'GETQUOTA' },
    { operationId: 'missingOperation' },
    { jsdocQuota: undefined },
    { jsdocQuota: 10 },
    { name: 'createFullScan', operationId: 'createorgfullscan', jsdocQuota: 1 },
    {
      name: 'unrelatedMethod',
      operationId: 'CreateOrgFullScan',
      jsdocQuota: 1,
    },
  ])('rejects missing or mismatched quota contracts: %j', overrides => {
    expect(quotaErrors(overrides)).toHaveLength(1)
  })

  it('permits methods without an operation contract and checks hidden-route metadata', () => {
    expect(
      quotaErrors({
        name: 'postEvents',
        operationId: undefined,
        hadOperationIdNone: true,
        jsdocQuota: undefined,
      }),
    ).toEqual([])
    expect(
      quotaErrors({
        name: 'postOrgTelemetry',
        operationId: undefined,
        hadOperationIdNone: true,
      }),
    ).toEqual([])
    expect(
      quotaErrors({
        name: 'postOrgTelemetry',
        operationId: undefined,
        hadOperationIdNone: true,
        jsdocQuota: 1,
      }),
    ).toHaveLength(1)
  })
})
