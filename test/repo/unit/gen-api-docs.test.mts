import process from 'node:process'

import { normalizePath } from '@socketsecurity/lib-stable/paths/normalize'
import { describe, expect, it, vi } from 'vitest'

import { generateApiDocs } from '../../../scripts/repo/gen-api-docs.mts'

const state = vi.hoisted(() => ({
  write: vi.fn(),
  rendered: 'generated documentation',
}))
vi.mock(import('node:fs'), async importOriginal => ({
  ...(await importOriginal()),
  writeFileSync: state.write,
}))
vi.mock(import('../../../scripts/repo/gen-api-docs-lib.mts'), () => ({
  extractMethods: vi.fn(() => []),
  renderApiDocs: vi.fn(() => state.rendered),
}))

describe('documentation generation', () => {
  it('writes rendered method documentation through the generator entry', () => {
    const argv = process.argv
    process.argv = ['node', 'gen-api-docs.mts']
    try {
      generateApiDocs()
      expect(state.write).toHaveBeenCalledExactlyOnceWith(
        expect.any(String),
        state.rendered,
      )
      expect(normalizePath(state.write.mock.calls[0]![0])).toContain(
        '/docs/api.md',
      )
    } finally {
      process.argv = argv
    }
  })
})
