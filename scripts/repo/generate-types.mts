/**
 * @file Renders operation and path types from Socket OpenAPI documents.
 */

import openapiTS from 'openapi-typescript'

import { OPENAPI_METHOD_ALIASES } from './openapi-contracts.mts'

import type { OpenAPI3, SchemaObject } from 'openapi-typescript'
import type { OpenApiVersion } from './openapi-contracts.mts'

function includeBinaryMetadataTypes(schema: SchemaObject): void {
  if (!('properties' in schema) || !schema.properties) {
    return
  }
  const additional = schema.additionalProperties
  if (
    typeof additional === 'object' &&
    'format' in additional &&
    additional.format === 'binary'
  ) {
    schema.additionalProperties = {
      anyOf: [additional, ...Object.values(schema.properties)],
    }
  }
}

export async function renderOpenApiDocumentTypes(
  document: OpenAPI3,
): Promise<string> {
  return openapiTS(document, {
    transform(schemaObject) {
      includeBinaryMetadataTypes(schemaObject)
      if (schemaObject.format === 'binary') {
        return 'Uint8Array'
      }
      if (
        'type' in schemaObject &&
        schemaObject.type === 'object' &&
        schemaObject.properties === undefined &&
        schemaObject.additionalProperties === undefined &&
        schemaObject.oneOf === undefined &&
        schemaObject.allOf === undefined &&
        schemaObject.anyOf === undefined
      ) {
        return 'Record<string, unknown>'
      }
      return undefined
    },
  })
}

export async function renderOpenApiTypes(
  document: OpenAPI3,
  version: OpenApiVersion,
): Promise<string> {
  const output = await renderOpenApiDocumentTypes(document)
  if (version === 'v1') {
    return output
  }
  const aliases = Object.entries(OPENAPI_METHOD_ALIASES)
    .map(([name, operation]) => `  ${name}: operations['${operation}']`)
    .join('\n')
  return `${output}\nexport interface operations {\n${aliases}\n}\n`
}
