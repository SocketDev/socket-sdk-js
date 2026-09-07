/**
 * @file Markdown location checks accept native and mixed path separators.
 */

import { fileURLToPath } from 'node:url'

import { normalizePath } from '@socketsecurity/lib-stable/paths/normalize'
import { describe, expect, it } from 'vitest'

import {
  isInAllowedLocationForRegularMd,
  isInAllowedLocationForScreamingCase,
} from '../../../scripts/repo/validate-markdown-filenames.mts'

describe('markdown file locations', () => {
  it.each([
    ['docs/nested/example.md', true, false],
    ['docs/EXAMPLE.md', true, true],
    ['.claude/nested/example.md', true, false],
    ['src/example.md', false, false],
  ])('checks %s with either separator', (relativePath, regular, screaming) => {
    const filePath = normalizePath(
      fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)),
    )
    const backslashPath = filePath.replaceAll('/', '\\')
    expect(isInAllowedLocationForRegularMd(filePath)).toBe(regular)
    expect(isInAllowedLocationForRegularMd(backslashPath)).toBe(regular)
    expect(isInAllowedLocationForScreamingCase(filePath)).toBe(screaming)
    expect(isInAllowedLocationForScreamingCase(backslashPath)).toBe(screaming)
  })
})
