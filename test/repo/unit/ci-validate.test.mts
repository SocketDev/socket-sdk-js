/**
 * @file CI commands preserve repository context, completion status, and errors.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { spawn } from '@socketsecurity/lib-stable/process/spawn/child'

import { runCommand } from '../../../scripts/repo/ci-validate.mts'
import { REPO_ROOT } from '../../../scripts/fleet/paths.mts'

const state = vi.hoisted(() => ({ spawn: vi.fn<typeof spawn>() }))
vi.mock(import('@socketsecurity/lib-stable/process/spawn/child'), () => ({
  spawn: state.spawn as typeof spawn,
}))

beforeEach(() => {
  state.spawn.mockReset()
})

describe('CI command lifecycle', () => {
  it.each([0, 7, 23])(
    'returns completed command status %i from the repository root',
    async code => {
      state.spawn.mockResolvedValue({
        cmd: 'example-tool',
        args: ['check', 'value with spaces'],
        code,
        signal: null,
        stdout: '',
        stderr: '',
      })

      await expect(
        runCommand('example-tool', { args: ['check', 'value with spaces'] }),
      ).resolves.toBe(code)
      expect(state.spawn).toHaveBeenCalledExactlyOnceWith(
        'example-tool',
        ['check', 'value with spaces'],
        { cwd: REPO_ROOT, stdio: 'inherit', throws: false },
      )
    },
  )

  it('fails when a signal terminates the command', async () => {
    state.spawn.mockResolvedValue({
      cmd: 'example-tool',
      args: [],
      code: 0,
      signal: 'SIGTERM',
      stdout: '',
      stderr: '',
    })

    await expect(runCommand('example-tool')).resolves.toBe(1)
    expect(state.spawn).toHaveBeenCalledExactlyOnceWith('example-tool', [], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      throws: false,
    })
  })

  it('preserves a rejected launch promise', async () => {
    const failure = Object.assign(new Error('Fixture launch failure'), {
      code: 'ENOENT',
    })
    state.spawn.mockRejectedValue(failure)

    await expect(runCommand('missing-tool')).rejects.toBe(failure)
  })
})
