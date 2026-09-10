import { describe, expect, it } from 'vitest'

import { ensureWorkspacePackages } from '../../../scripts/repo/bootstrap/prepare.mts'

describe('prepare workspace repair', () => {
  it('preserves existing packages and settings while appending missing globs once', () => {
    const source = "packages:\n  - 'packages/*'\n\ncatalog:\n  example: 1.0.0\n"
    const required = ['packages/*', '.claude/hooks/fleet/*']
    const repaired = ensureWorkspacePackages(source, required)
    expect(repaired).toContain("  - 'packages/*'")
    expect(repaired).toContain("  - '.claude/hooks/fleet/*'")
    expect(repaired).toContain('catalog:\n  example: 1.0.0')
    expect(ensureWorkspacePackages(repaired, required)).toBe(repaired)
  })
})
