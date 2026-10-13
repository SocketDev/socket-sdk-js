import { describe, expect, it } from 'vitest'

import { extractPackageExports } from '../../../../../../scripts/repo/api-doc/exports.mts'

const sources = new Map<string, string>([
  [
    'src/index.mts',
    `export { value as renamedValue } from './value.mts'
export { default as defaultAlias } from './default.mts'
export { default } from './default.mts'
export type { Shared as SharedType } from './nested.mts'
export * from './barrel.mts'
export * as namespaceExports from './nested.mts'
export { localValue as localAlias }
const localValue = 1
`,
  ],
  [
    'src/default.mts',
    `export default function defaultHelper(): string { return '' }`,
  ],
  [
    'src/value.mts',
    `/** A documented callable helper. */
export function value(input: string): boolean {
  return input.length > 0
}
`,
  ],
  [
    'src/barrel.mts',
    `export * from './nested.mts'
export * from './cycle.mts'
export const starCollision = true
`,
  ],
  [
    'src/nested.mts',
    `export interface Shared {
  name: string
}
export const nested = true
`,
  ],
  [
    'src/cycle.mts',
    `export type Cycle = string
export * from './barrel.mts'
export { cycleNamed } from './cycle-named.mts'
export default 1
export const cycleAlpha = true
`,
  ],
  [
    'src/cycle-named.mts',
    `export { cycleAlpha as cycleNamed } from './cycle.mts'
`,
  ],
  ['src/testing.d.ts', `export interface Shared { readonly testing: true }`],
  ['types/api.d.ts', `export interface paths { '/v1': unknown }`],
])

function readSource(packagePath: string): string {
  const source = sources.get(packagePath)
  if (source === undefined) {
    throw new Error(`Missing fixture source: ${packagePath}`)
  }
  return source
}

describe('SDK API export inventory', () => {
  it('enumerates direct, renamed, star, namespace, and declaration-only exports', () => {
    const targets = [
      { subpath: '.', target: './src/index.mts' },
      { subpath: './testing', target: './src/testing.d.ts' },
      { subpath: './types/api', target: './types/api.d.ts' },
      { subpath: './package.json', target: undefined },
    ]
    const exports = extractPackageExports(targets, readSource)

    expect(
      exports.map(item => `${item.subpath}:${item.name}:${item.kind}`),
    ).toEqual([
      '.:Cycle:type',
      '.:Shared:type',
      '.:SharedType:type',
      '.:cycleAlpha:value',
      '.:cycleNamed:value',
      '.:default:value',
      '.:defaultAlias:value',
      '.:localAlias:value',
      '.:namespaceExports:value',
      '.:nested:value',
      '.:renamedValue:value',
      '.:starCollision:value',
      './testing:Shared:type',
      './types/api:paths:type',
    ])
    expect(exports.find(item => item.name === 'Shared')?.packagePath).toBe(
      'src/nested.mts',
    )
  })

  it('preserves interface fields and class method signatures', () => {
    const exports = extractPackageExports(
      [{ subpath: '.', target: './src/declarations.mts' }],
      () =>
        `export interface Config { enabled: boolean }\nexport class Client {\n  run(value: string): number { return value.length }\n  #secret(): void {}\n}`,
    )
    expect(exports.find(item => item.name === 'Config')?.signature).toContain(
      'enabled: boolean',
    )
    expect(exports.find(item => item.name === 'Client')?.signature).toContain(
      'run(value: string): number',
    )
    expect(
      exports.find(item => item.name === 'Client')?.signature,
    ).not.toContain('#secret')
  })

  it('documents memoized callbacks and public callable class properties', () => {
    const source = `import { memoize } from 'memo'
export const getValues = memoize((key: string): number[] => {
  return [key.length]
}, { name: 'getValues' })
export class Client {
  static { doInternalWork() }
  handler = (key: string): number => { return key.length }
  run(key: string): number { return key.length }
  #secret(): void {}
  private hidden(): void {}
}`
    const exports = extractPackageExports(
      [{ subpath: '.', target: './src/memoized.mts' }],
      () => source,
    )
    expect(exports.find(item => item.name === 'getValues')?.signature).toBe(
      'function getValues(key: string): number[]',
    )
    const classSignature = exports.find(
      item => item.name === 'Client',
    )?.signature
    expect(classSignature).toContain('handler: (key: string) => number')
    expect(classSignature).toContain('run(key: string): number')
    expect(classSignature).not.toContain('doInternalWork')
    expect(classSignature).not.toContain('#secret')
    expect(classSignature).not.toContain('hidden')
  })

  it('follows default identifier exports to their declarations', () => {
    const exports = extractPackageExports(
      [{ subpath: '.', target: './src/default-identifier.mts' }],
      () =>
        `export function helper(input: string): number { return 1 }\nexport default helper`,
    )
    expect(exports.find(item => item.name === 'default')?.signature).toBe(
      'function helper(input: string): number',
    )
  })

  it('resolves imported local aliases from plain declarations', () => {
    const sources = new Map([
      [
        'src/index.mts',
        `import { Alias } from './inner.mts'\nexport { Alias as Renamed}`,
      ],
      ['src/inner.mts', `const value = 1\nexport { value as Alias }`],
    ])
    const exports = extractPackageExports(
      [{ subpath: '.', target: './src/index.mts' }],
      packagePath => {
        const source = sources.get(packagePath)
        if (source === undefined) {
          throw new Error(`Missing fixture source: ${packagePath}`)
        }
        return source
      },
    )
    expect(exports.find(item => item.name === 'Renamed')?.signature).toContain(
      'value = 1',
    )
  })

  it('follows imported defaults and indirect external named exports', () => {
    const sources = new Map([
      [
        'src/index.mts',
        `import helper from './helper.mts'\nexport default helper\nexport { external } from './external.mts'`,
      ],
      [
        'src/helper.mts',
        `export default function helper(input: string): number { return 1 }`,
      ],
      ['src/external.mts', `export { external } from 'external-package'`],
    ])
    const exports = extractPackageExports(
      [{ subpath: '.', target: './src/index.mts' }],
      packagePath => {
        const source = sources.get(packagePath)
        if (source === undefined) {
          throw new Error(`Missing fixture source: ${packagePath}`)
        }
        return source
      },
    )
    expect(exports.find(item => item.name === 'default')?.signature).toBe(
      'function helper(input: string): number',
    )
    expect(exports.find(item => item.name === 'external')).toMatchObject({
      kind: 'value',
      packagePath: 'external-package',
    })
  })

  it('preserves type-only status and namespace exports through aliases', () => {
    const sources = new Map([
      [
        'src/index.mts',
        `import type { Alias } from './inner.mts'\nimport { ns as leafNs } from './inner.mts'\nimport * as ns from './inner.mts'\nexport { Alias, ns, leafNs }`,
      ],
      [
        'src/inner.mts',
        `export type { C as Alias } from './leaf.mts'\nexport * as ns from './leaf.mts'`,
      ],
      ['src/leaf.mts', `export class C {}\nexport const value = true`],
    ])
    const exports = extractPackageExports(
      [{ subpath: '.', target: './src/index.mts' }],
      packagePath => {
        const source = sources.get(packagePath)
        if (source === undefined) {
          throw new Error(`Missing fixture source: ${packagePath}`)
        }
        return source
      },
    )
    expect(exports.find(item => item.name === 'Alias')?.kind).toBe('type')
    expect(exports.find(item => item.name === 'ns')).toMatchObject({
      kind: 'value',
      packagePath: 'src/inner.mts',
    })
    expect(exports.find(item => item.name === 'leafNs')).toMatchObject({
      kind: 'value',
      packagePath: 'src/leaf.mts',
    })
  })

  it('preserves helper signatures and adjacent JSDoc', () => {
    const exports = extractPackageExports(
      [{ subpath: '.', target: './src/value.mts' }],
      readSource,
    )

    expect(exports[0]?.signature).toBe('function value(input: string): boolean')
    expect(exports[0]?.description).toBe('A documented callable helper.')
  })

  it('reports unresolved exports with their declaring path', () => {
    expect(() =>
      extractPackageExports(
        [{ subpath: '.', target: './src/index.mts' }],
        packagePath =>
          packagePath === 'src/index.mts'
            ? `export { missing } from './nested.mts'`
            : readSource(packagePath),
      ),
    ).toThrow(
      'Unresolved public export missing in src/index.mts from src/nested.mts.',
    )
  })

  it('reports unsupported export assignments with their source path', () => {
    expect(() =>
      extractPackageExports(
        [{ subpath: '.', target: './src/unsupported.mts' }],
        () => 'export = 1',
      ),
    ).toThrow(/src\/unsupported\.mts/)
  })
})
