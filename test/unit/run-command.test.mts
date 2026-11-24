/**
 * @file Child command sequences fail closed when a command is interrupted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { spawn } from '@socketsecurity/lib-stable/process/spawn/child'

import { runCommand, runSequence } from '../../scripts/run-command.mts'

const state = vi.hoisted(() => ({ spawn: vi.fn<typeof spawn>() }))

vi.mock(import('@socketsecurity/lib-stable/process/spawn/child'), () => ({
  spawn: state.spawn as typeof spawn,
}))

beforeEach(() => {
  state.spawn.mockReset()
})

describe('child command exit codes', () => {
  it('returns the child exit code', async () => {
    state.spawn.mockResolvedValue({
      cmd: 'example-tool',
      args: [],
      code: 7,
      signal: null,
      stdout: '',
      stderr: '',
    })

    await expect(runCommand('example-tool')).resolves.toBe(7)
  })

  it('fails and stops the sequence when a child is terminated by a signal', async () => {
    state.spawn.mockResolvedValue({
      cmd: 'example-tool',
      args: [],
      code: null as unknown as number,
      signal: 'SIGTERM',
      stdout: '',
      stderr: '',
    })

    await expect(
      runSequence([
        { command: 'interrupted-check' },
        { command: 'later-check' },
      ]),
    ).resolves.toBe(1)
    expect(state.spawn).toHaveBeenCalledExactlyOnceWith(
      'interrupted-check',
      [],
      expect.objectContaining({ stdio: 'inherit' }),
    )
  })

  it('fails when a completed result has no numeric exit code', async () => {
    state.spawn.mockResolvedValue({
      cmd: 'example-tool',
      args: [],
      code: null as unknown as number,
      signal: null,
      stdout: '',
      stderr: '',
    })

    await expect(runCommand('example-tool')).resolves.toBe(1)
  })
})
