/**
 * @file OpenAPI artifact formatting converges within its configured limit.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { format as oxfmtFormat } from 'oxfmt'

import {
  formatOpenApiArtifact,
  OPENAPI_FORMAT_MAX_PASSES,
} from '../../scripts/openapi-contracts.mts'
import { REPO_ROOT } from '../../scripts/paths/repo.mts'

const state = vi.hoisted(() => ({ format: vi.fn<typeof oxfmtFormat>() }))

vi.mock(import('oxfmt'), () => ({
  format: state.format as typeof oxfmtFormat,
}))

beforeEach(() => {
  state.format.mockReset()
})

describe('formatOpenApiArtifact', () => {
  it('repeats formatting until the generated output stabilizes', async () => {
    state.format
      .mockResolvedValueOnce({ code: 'first pass', errors: [] })
      .mockResolvedValueOnce({ code: 'stable output', errors: [] })
      .mockResolvedValueOnce({ code: 'stable output', errors: [] })

    await expect(
      formatOpenApiArtifact(
        `${REPO_ROOT}/types/api.d.ts`,
        'generated output',
        REPO_ROOT,
      ),
    ).resolves.toBe('stable output')
    expect(state.format).toHaveBeenCalledTimes(3)
  })

  it('stops when formatting does not stabilize within the configured limit', async () => {
    state.format.mockImplementation(async (_filePath, content) => ({
      code: `${content} `,
      errors: [],
    }))

    await expect(
      formatOpenApiArtifact(
        `${REPO_ROOT}/types/api.d.ts`,
        'generated output',
        REPO_ROOT,
      ),
    ).rejects.toThrow()
    expect(state.format).toHaveBeenCalledTimes(OPENAPI_FORMAT_MAX_PASSES)
  })
})
