import { describe, expect, it, vi } from 'vitest'

import { generateApiTypes } from '../../../scripts/repo/generate-types.mts'

const state = vi.hoisted(() => ({
  write: vi.fn(),
  input: undefined as unknown,
  binary: undefined as unknown,
  ordinary: undefined as unknown,
}))
vi.mock(import('node:fs'), async importOriginal => {
  const original = await importOriginal()
  return {
    ...original,
    promises: { ...original.promises, writeFile: state.write },
  }
})
vi.mock(import('openapi-typescript'), () => ({
  default: vi.fn(async (input, options) => {
    state.input = input
    state.binary = options?.transform?.(
      { format: 'binary' },
      { path: '#/example' },
    )
    state.ordinary = options?.transform?.(
      { type: 'string' },
      { path: '#/example' },
    )
    return 'export interface Example {}'
  }),
}))

describe('OpenAPI type generation', () => {
  it('rejects binary schemas in declarations and writes generated text', async () => {
    await generateApiTypes()
    expect(state.input).toEqual(expect.stringContaining('openapi.json'))
    expect(state.binary).toBe('never')
    expect(state.ordinary).toBeUndefined()
    expect(state.write).toHaveBeenCalledWith(
      expect.stringContaining('types/api.d.ts'),
      'export interface Example {}',
      'utf8',
    )
  })
})
