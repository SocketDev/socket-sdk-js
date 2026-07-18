/**
 * @file Type-definition string emitters for the strict-type codegen pipeline.
 *   Houses the shared property/config interfaces plus the functions that render
 *   the generated `src/types-strict.mts` text consumed by
 *   scripts/repo/generate-strict-types.mts.
 */

export interface TypeProperty {
  name: string
  optional: boolean
  type: string
}

export interface StrictTypeConfig {
  operationId: string
  extractType?: string | undefined
  responseCode?: number | undefined
  typeName: string
  sourcePath?: string[] | undefined
  requiredFields?: string[] | undefined
  requiredParams?: string[] | undefined
  typeOverrides?: Record<string, string> | undefined
  additionalFields?:
    | Array<{ name: string; type: string; optional?: boolean | undefined }>
    | undefined
}

/**
 * Generate type definition string from properties.
 */
export function generateTypeDefinition(
  typeName: string,
  properties: TypeProperty[],
  description: string,
): string {
  const lines: string[] = []
  lines.push('/**')
  lines.push(` * ${description}`)
  lines.push(' */')
  lines.push(`export type ${typeName} = {`)

  for (let i = 0, { length } = properties; i < length; i += 1) {
    const prop = properties[i]!
    const opt = prop.optional ? '?' : ''
    lines.push(`  ${prop.name}${opt}: ${prop.type}`)
  }

  lines.push('}')
  return lines.join('\n')
}

/**
 * The wrapper type names generateWrapperTypes() emits, derived from the
 * template itself. Single source for consumers that re-export them
 * (updateIndexExports in generate-strict-types.mts) — deriving here means
 * adding or renaming a wrapper type can never silently drop its
 * src/index.mts export.
 */
export function wrapperTypeNames(): string[] {
  const names = [...generateWrapperTypes().matchAll(/^export type (\w+)/gm)]
    .map(m => m[1]!)
    // oxlint-disable-next-line unicorn/no-array-sort -- fresh copy
    .sort()
  if (!names.length) {
    throw new Error(
      'wrapperTypeNames: no `export type` declarations found in generateWrapperTypes() output — the emit template changed shape.',
    )
  }
  return names
}

/**
 * Generate wrapper result types.
 */
export function generateWrapperTypes(): string {
  return `
/**
 * Error result type for all SDK operations.
 */
export type StrictErrorResult = {
  cause?: string | undefined
  data?: undefined | undefined
  error: string
  status: number
  success: false
}

/**
 * Generic strict result type combining success and error.
 */
export type StrictResult<T> =
  | {
      cause?: undefined | undefined
      data: T
      error?: undefined | undefined
      status: number
      success: true
    }
  | StrictErrorResult

/**
 * Strict type for full scan list result.
 */
export type FullScanListResult = {
  cause?: undefined | undefined
  data: FullScanListData
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for single full scan result.
 */
export type FullScanResult = {
  cause?: undefined | undefined
  data: FullScanItem
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Options for streaming a full scan.
 */
export type StreamFullScanOptions = {
  output?: boolean | string | undefined
}

/**
 * Strict type for organizations list result.
 */
export type OrganizationsResult = {
  cause?: undefined | undefined
  data: {
    organizations: OrganizationItem[]
  }
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for repositories list result.
 */
export type RepositoriesListResult = {
  cause?: undefined | undefined
  data: RepositoriesListData
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for delete operation result.
 */
export type DeleteResult = {
  cause?: undefined | undefined
  data: { success: boolean }
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for single repository result.
 */
export type RepositoryResult = {
  cause?: undefined | undefined
  data: RepositoryItem
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for repository labels list result.
 */
export type RepositoryLabelsListResult = {
  cause?: undefined | undefined
  data: RepositoryLabelsListData
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for single repository label result.
 */
export type RepositoryLabelResult = {
  cause?: undefined | undefined
  data: RepositoryLabelItem
  error?: undefined | undefined
  status: number
  success: true
}

/**
 * Strict type for delete repository label result.
 */
export type DeleteRepositoryLabelResult = {
  cause?: undefined | undefined
  data: { status: string }
  error?: undefined | undefined
  status: number
  success: true
}
`
}
