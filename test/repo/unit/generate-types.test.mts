/**
 * @file OpenAPI rendering retains ordinary fields and usable binary types.
 */
import { describe, expect, it } from 'vitest'

import { renderOpenApiDocumentTypes } from '../../../scripts/repo/generate-types.mts'

describe('OpenAPI type generation', () => {
  it('renders binary upload schemas alongside ordinary string schemas', async () => {
    const output = await renderOpenApiDocumentTypes({
      openapi: '3.0.3',
      info: { title: 'Fixture upload API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          Upload: {
            type: 'object',
            required: ['content', 'name'],
            properties: {
              content: { type: 'string', format: 'binary' },
              name: { type: 'string' },
            },
          },
        },
      },
    })
    expect(output).toContain('content: Uint8Array')
    expect(output).toContain('name: string')
  })
})
