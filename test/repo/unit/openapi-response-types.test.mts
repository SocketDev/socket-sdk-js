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
