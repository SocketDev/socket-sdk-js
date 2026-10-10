/**
 * @file Generated API helpers preserve success and error response variants.
 */

import { describe, expectTypeOf, it } from 'vitest'

import type { OpErrorType, OpReturnType } from '../../../types/api-helpers.d.ts'
import type { paths } from '../../../types/api-v1.d.ts'

interface ExampleOperation {
  responses: {
    200: { content: { 'application/x-ndjson': { inputPurl: string } } }
    201: { content: { 'application/json': { id: string } } }
    202: { content: { 'application/json': { status: 'processing' } } }
    204: { headers: Record<string, string> }
    206: { content: { 'application/octet-stream': Uint8Array } }
    400: { content: { 'application/json': { error: 'invalid' } } }
    504: {
      content: { 'application/json': { error: 'timeout'; retryable: true } }
    }
  }
}

describe('OpenAPI response types', () => {
  it('represents generated empty content as an undefined body', () => {
    expectTypeOf<
      OpReturnType<{ responses: { 204: { content: never } } }>
    >().toEqualTypeOf<undefined>()
  })
  it('exposes version history through the recorded v1 path contract', () => {
    type VersionHistoryOperation =
      paths['/v1/orgs/{org_slug}/purl/versions/{purl}']['get']
    expectTypeOf<OpReturnType<VersionHistoryOperation>>().toEqualTypeOf<{
      purl: string
      versions: Array<{
        version: string
        publishedAt: string | null
        prerelease: boolean | null
      }>
    }>()
  })
  it('exposes package checks request, result, and policy context types', () => {
    type Operation = paths['/v1/orgs/{org_slug}/packages/checks']['post']
    type Request = Operation['requestBody']['content']['application/json']
    type Response = OpReturnType<Operation>
    expectTypeOf<Request>().toEqualTypeOf<{
      packages: { purl: string }[]
    }>()
    expectTypeOf<Response['context']>().toMatchTypeOf<{
      mode: 'organization'
      organizationSlug: string
      policyScope: 'organization-default'
      policyRevision: number
    }>()
    expectTypeOf<Response['results'][number]>().toMatchTypeOf<{
      index: number
      inputPurl: string
      resolvedPurls: string[]
      status: 'complete' | 'pending' | 'unknown' | 'unsupported' | 'error'
      action: 'block' | 'warn' | 'monitor' | 'allow' | 'indeterminate'
    }>()
    expectTypeOf<Response['results'][number]['coverage']>().toMatchTypeOf<{
      scope: 'published-artifacts'
      complete: boolean
      artifactCount: number
      evaluatedArtifactCount: number
      reason: string | null
    }>()
    expectTypeOf<Response['results'][number]['freshness']>().toMatchTypeOf<{
      evaluatedAt: string
      analysisAt: null
      source: 'artifact-state'
      state: 'current' | 'stale' | 'unknown'
    }>()
  })

  it('preserves package summary artifact scores and findings in its type', () => {
    type Operation = paths['/v1/orgs/{org_slug}/packages/summaries']['post']
    type Request = Operation['requestBody']['content']['application/json']
    type Response = OpReturnType<Operation>
    expectTypeOf<Request>().toEqualTypeOf<{
      packages: { purl: string }[]
    }>()
    expectTypeOf<Response['context']>().toMatchTypeOf<{
      mode: 'organization'
      organizationSlug: string
      policyScope: 'organization-default'
      policyRevision: number
    }>()
    expectTypeOf<
      Response['results'][number]['artifacts'][number]
    >().toMatchTypeOf<{
      reference: string
      purl: string
      state: 'complete' | 'pending' | 'revalidate' | 'error' | 'unknown'
      scores: null | {
        supplyChain: number
        quality: number
        maintenance: number
        vulnerability: number
        license: number
        overall: number
      }
      alerts: {
        key: string
        type: string
        action: 'error' | 'warn' | 'monitor' | 'ignore' | null
      }[]
      detailUrl: string
    }>()
    expectTypeOf<Response['results'][number]['coverage']>().toMatchTypeOf<{
      scope: 'published-artifacts'
      complete: boolean
      artifactCount: number
      evaluatedArtifactCount: number
      reason: string | null
    }>()
    expectTypeOf<Response['results'][number]['freshness']>().toMatchTypeOf<{
      evaluatedAt: string
      analysisAt: null
      source: 'artifact-state'
      state: 'current' | 'stale' | 'unknown'
    }>()
  })

  it('combines every successful status and content type', () => {
    expectTypeOf<OpReturnType<ExampleOperation>>().toEqualTypeOf<
      | { inputPurl: string }
      | { id: string }
      | { status: 'processing' }
      | undefined
      | Uint8Array
    >()
  })

  it('includes gateway timeout errors without mixing success bodies', () => {
    expectTypeOf<OpErrorType<ExampleOperation>>().toEqualTypeOf<
      { error: 'invalid' } | { error: 'timeout'; retryable: true }
    >()
  })

  it('handles string status keys and response objects without error responses', () => {
    expectTypeOf<
      OpReturnType<{
        responses: { '202': { content: { 'application/json': number } } }
      }>
    >().toEqualTypeOf<number>()
    expectTypeOf<
      OpErrorType<{ responses: { 204: Record<string, never> } }>
    >().toEqualTypeOf<{ error?: string | undefined }>()
  })
})
