import { describe, expect, it } from 'vitest'

import {
  extractQueryParams,
  extractResponseType,
  findExportByName,
  navigateToPath,
  parseTypeScript,
} from '../../../scripts/repo/generate-strict-types-lib.mts'

const source = `export type Operations = {
  scan: {
    parameters: { query: { limit?: number; name: string } };
    responses: { 200: { content: { "application/json": { payload: { id: string }[] } } } };
  };
}`
const operations = findExportByName(parseTypeScript(source), 'Operations')!
const config = {
  operationId: 'scan',
  requiredParams: ['name'],
  typeName: 'Scan',
}

describe('strict type extraction', () => {
  it('retains required query fields and sorts additional fields', () => {
    expect(
      extractQueryParams(operations.typeAnnotation!, 'scan', source, {
        ...config,
        additionalFields: [
          { name: 'archived', type: 'boolean', optional: false },
        ],
      }),
    ).toEqual([
      { name: 'archived', optional: false, type: 'boolean' },
      { name: 'limit', optional: true, type: 'number | undefined' },
      { name: 'name', optional: false, type: 'string' },
    ])
  })

  it('resolves response content through an array element and rejects missing paths', () => {
    expect(
      extractResponseType(
        operations.typeAnnotation!,
        'scan',
        200,
        ['payload', 'Array'],
        source,
        {
          ...config,
          requiredFields: ['id'],
        },
      ),
    ).toEqual([{ name: 'id', optional: false, type: 'string' }])
    expect(
      extractResponseType(
        operations.typeAnnotation!,
        'scan',
        404,
        [],
        source,
        config,
      ),
    ).toBeUndefined()
    expect(
      extractQueryParams(operations.typeAnnotation!, 'missing', source, config),
    ).toBeUndefined()
  })

  it('unwraps record values while retaining literal and absent segment behavior', () => {
    const value = { type: 'TSTypeLiteral', members: [] }
    expect(
      navigateToPath(
        {
          type: 'TSTypeReference',
          typeParameters: { params: [{ type: 'TSStringKeyword' }, value] },
        },
        ['Record', 'value', 'items'],
      ),
    ).toBe(value)
    expect(
      navigateToPath(
        {
          type: 'TSTypeLiteral',
          members: [
            {
              type: 'TSIndexSignature',
              typeAnnotation: { typeAnnotation: value },
            },
          ],
        },
        ['Record'],
      ),
    ).toBe(value)
    expect(navigateToPath(value, ['missing'])).toBeUndefined()
  })
})
