/**
 * @file Contract freshness checks run offline and return a failing status on
 *   drift.
 */

import path from 'node:path'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { runMain } from '../../../../scripts/fleet/process/run-main.mts'

const logger = getDefaultLogger()

const mocks = vi.hoisted(() => ({
  generate: vi.fn<() => Promise<string[]>>(),
  runMain: vi.fn<typeof runMain>(),
}))

vi.mock(import('../../../../scripts/fleet/process/is-main-module.mts'), () => ({
  isMainModule: () => true,
}))
vi.mock(import('../../../../scripts/fleet/process/run-main.mts'), () => ({
  runMain: mocks.runMain,
}))
vi.mock(import('../../../../scripts/repo/generate-sdk.mts'), () => ({
  generateSdkContracts: mocks.generate,
}))

async function runContractCheck(): Promise<unknown> {
  await import('../../../../scripts/repo/check/api-contracts-are-current.mts')
  const { 0: main } = mocks.runMain.mock.calls[0]!
  return await main()
}

describe('API contract freshness entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mocks.generate.mockResolvedValue([])
    vi.spyOn(logger, 'error').mockImplementation(() => logger)
  })

  it('checks both local contracts without writing when artifacts are current', async () => {
    await expect(runContractCheck()).resolves.toBe(0)
    expect(mocks.runMain).toHaveBeenCalledOnce()
    expect(mocks.generate).toHaveBeenCalledExactlyOnceWith({
      rootPath: path.resolve(import.meta.dirname, '../../../..'),
      offline: true,
      check: true,
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('returns a failing status when any generated contract differs', async () => {
    mocks.generate.mockResolvedValue(['types/api-v1.d.ts'])
    await expect(runContractCheck()).resolves.toBe(1)
    expect(mocks.runMain).toHaveBeenCalledOnce()
    expect(logger.error).toHaveBeenCalledOnce()
  })

  it('propagates a generator failure to the CLI runner', async () => {
    const failure = Object.assign(new Error('Fixture contract failure'), {
      code: 'ENOENT',
    })
    mocks.generate.mockRejectedValue(failure)
    await expect(runContractCheck()).rejects.toBe(failure)
    expect(mocks.runMain).toHaveBeenCalledOnce()
    expect(logger.error).not.toHaveBeenCalled()
  })
})
