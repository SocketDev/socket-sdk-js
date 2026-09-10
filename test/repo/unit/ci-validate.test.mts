import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

import { runCommand } from '../../../scripts/repo/ci-validate.mts'

const state = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock(import('@socketsecurity/lib-stable/process/spawn/child'), () => ({
  spawn: state.spawn,
}))

describe('CI command lifecycle', () => {
  it('propagates child failure status and process errors', async () => {
    const child = new EventEmitter()
    state.spawn.mockReturnValue({ process: child })
    const result = runCommand('example-tool', { args: ['check'] })
    child.emit('exit', 7)
    await expect(result).resolves.toBe(7)
    expect(state.spawn).toHaveBeenCalledWith(
      'example-tool',
      ['check'],
      expect.objectContaining({ stdio: 'inherit' }),
    )
    const failedChild = new EventEmitter()
    state.spawn.mockReturnValue({ process: failedChild })
    const failed = runCommand('missing-tool')
    const failure = new Error('fixture spawn failure')
    failedChild.emit('error', failure)
    await expect(failed).rejects.toBe(failure)
  })
})
