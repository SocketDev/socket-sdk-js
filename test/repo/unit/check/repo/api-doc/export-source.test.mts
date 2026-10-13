import { describe, expect, it } from 'vitest'

import { packageExportTargets } from '../../../../../../scripts/repo/api-doc/export-source.mts'

describe('API documentation export source target selection', () => {
  it('selects source and types targets in deterministic subpath order', () => {
    expect(
      packageExportTargets({
        '.': { source: './src/index.mts', types: './types/index.d.mts' },
        './types-only': { types: './types/public.d.ts' },
        './nested': { import: { source: './src/nested.mts' } },
        './package.json': './package.json',
      }),
    ).toEqual([
      { subpath: '.', target: './src/index.mts' },
      { subpath: './nested', target: './src/nested.mts' },
      { subpath: './package.json', target: undefined },
      { subpath: './types-only', target: './types/public.d.ts' },
    ])
  })

  it('fails when an export map entry has no source or declaration condition', () => {
    expect(() =>
      packageExportTargets({ './unsupported': { default: null } }),
    ).toThrow(
      'No source or declaration target for package export ./unsupported.',
    )
  })
})
