/**
 * @file SDK aliases preserve the generated operation contracts.
 */
import { describe, expect, it } from 'vitest'

import { renderOpenApiTypes } from '../../../scripts/repo/generate-types.mts'

import type { OpenAPI3 } from 'openapi-typescript'

describe('SDK operation aliases', () => {
  it('adds v0 aliases while preserving the operation response', async () => {
    const document: OpenAPI3 = {
      openapi: '3.0.3',
      info: { title: 'Fixture API', version: '1.0.0' },
      paths: {
        '/organizations': {
          get: {
            operationId: 'getOrganizations',
            responses: {
              200: {
                description: 'Organization names',
                content: {
                  'application/json': { schema: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    }
    const output = await renderOpenApiTypes(document, 'v0')
    expect(output).toContain('getOrganizations: {')
    expect(output).toContain('"application/json": string')
    expect(output).toContain(
      "listOrganizations: operations['getOrganizations']",
    )
    const v1 = await renderOpenApiTypes(document, 'v1')
    expect(v1).toContain('getOrganizations: {')
    expect(v1).not.toContain('listOrganizations:')
  })
})
