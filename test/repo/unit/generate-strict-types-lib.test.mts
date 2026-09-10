/**
 * @file Strict contract extraction preserves nested types and optional values.
 */

import { describe, expect, it } from 'vitest'

import {
  extractQueryParams,
  extractResponseType,
  findExportByName,
  navigateToPath,
  parseTypeScript,
  renderStrictPropertyType,
  typeNodeToString,
} from '../../../scripts/repo/generate-strict-types-lib.mts'

import type { AstNode } from '../../../scripts/repo/generate-strict-types-lib.mts'

function parseAliasType(source: string): AstNode {
  return findExportByName(parseTypeScript(source), 'Fixture')!.typeAnnotation!
}

describe('nested generated optional properties', () => {
  it('keeps optional outer objects and function values explicit', () => {
    const source = 'export type Fixture = { child?: string | undefined }'
    expect(
      renderStrictPropertyType(parseAliasType(source), source, {
        required: false,
      }),
    ).toBe('{ child?: string | undefined } | undefined')
    expect(
      renderStrictPropertyType(undefined, '', {
        required: false,
        override: '() => string',
      }),
    ).toBe('(() => string) | undefined')
    expect(
      renderStrictPropertyType(undefined, '', {
        required: false,
        override: 'string | undefined',
      }),
    ).toBe('string | undefined')
  })
  it('adds undefined to nested objects and optional functions without changing required members', () => {
    const source =
      "export type Fixture = { source?: { type?: 'github'; value: string | undefined }; callback?: () => string; required: string; ready?: boolean | undefined }"
    const rendered = typeNodeToString(parseAliasType(source), source)
    expect(rendered).toBe(
      "{ source?: { type?: 'github' | undefined; value: string | undefined } | undefined; callback?: (() => string) | undefined; required: string; ready?: boolean | undefined }",
    )
    const generated = `export type Fixture = ${rendered}`
    expect(typeNodeToString(parseAliasType(generated), generated)).toBe(
      rendered,
    )
  })
})

describe('contract type paths', () => {
  it.each([
    ['({ results: { name: string }[] })', ['results', 'Array', 'items']],
    ['Record<string, { name: string }>', ['Record', 'value']],
    ['{ [key: string]: { name: string } }', ['Record', 'value']],
  ])('navigates %s', (typeSource, segments) => {
    const source = `export type Fixture = ${typeSource}`
    expect(
      typeNodeToString(
        navigateToPath(parseAliasType(source), segments),
        source,
      ),
    ).toBe('{ name: string }')
  })

  it('returns undefined when a path property is absent', () => {
    const source = 'export type Fixture = { name: string }'
    expect(
      navigateToPath(parseAliasType(source), ['missing', 'name']),
    ).toBeUndefined()
  })

  it('extracts query and successful response properties through operation paths', () => {
    const source = `export interface operations {
      inspect: {
        parameters: { query: { limit?: number; after: string } };
        responses: { 200: { content: { "application/json": { results: { name: string }[] } } } }
      }
    }`
    const operations = findExportByName(parseTypeScript(source), 'operations')!
      .body as AstNode
    const config = {
      operationId: 'inspect',
      typeName: 'Inspection',
      requiredParams: ['limit'],
      additionalFields: [{ name: 'page', type: 'number', optional: false }],
    }
    expect(extractQueryParams(operations, 'inspect', source, config)).toEqual([
      { name: 'after', optional: true, type: 'string | undefined' },
      { name: 'limit', optional: false, type: 'number' },
      { name: 'page', optional: false, type: 'number' },
    ])
    expect(
      extractResponseType(
        operations,
        'inspect',
        200,
        ['results', 'Array'],
        source,
        { ...config, requiredFields: ['name'] },
      ),
    ).toEqual([{ name: 'name', optional: false, type: 'string' }])
    expect(
      extractQueryParams(operations, 'missing', source, config),
    ).toBeUndefined()
    expect(
      extractResponseType(operations, 'inspect', undefined, [], source, config),
    ).toBeUndefined()
    expect(
      extractResponseType(operations, 'inspect', 404, [], source, config),
    ).toBeUndefined()
  })
})
