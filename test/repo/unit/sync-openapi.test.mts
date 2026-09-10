import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { expect, it } from 'vitest'

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { code, stdout } = await spawn('git', args, {
    cwd,
    stdio: 'pipe',
    stdioString: true,
  })
  if (code !== 0) {
    throw new Error(
      `Git fixture failed in ${cwd}: exit ${code}; expected 0. Inspect the fixture command.`,
    )
  }
  return stdout
}

it('bases generated changes on the current workflow and source', async () => {
  const workflow = await fs.readFile(
    new URL('../../../.github/workflows/sync-openapi.yml', import.meta.url),
    'utf8',
  )
  const command = workflow.match(
    /^\s*git worktree add -B (?<branch>\S+) "\$tmp_worktree" (?<base>\S+)$/m,
  )
  expect(command).not.toBeNull()
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-openapi-base-'))
  const worktree = path.join(root, 'generated-checkout')
  try {
    await runGit(root, ['init', '--initial-branch=fixture-main'])
    const workflowPath = path.join(root, 'workflow.yml')
    await fs.writeFile(workflowPath, 'name: original workflow\n')
    await runGit(root, ['add', 'workflow.yml'])
    const commitArgs = [
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.name=example-user',
      '-c',
      'user.email=example-user@example.invalid',
      'commit',
      '-m',
      'test: record workflow',
    ]
    await runGit(root, commitArgs)
    await fs.writeFile(workflowPath, 'name: current workflow\n')
    await runGit(root, ['add', 'workflow.yml'])
    await runGit(root, commitArgs)
    await runGit(root, [
      'worktree',
      'add',
      '-B',
      command!.groups!['branch']!,
      worktree,
      command!.groups!['base']!,
    ])
    await fs.writeFile(
      path.join(worktree, 'generated.mts'),
      'export type Generated = string\n',
    )
    expect(
      await runGit(worktree, ['diff', 'fixture-main', '--', 'workflow.yml']),
    ).toBe('')
    expect(await fs.readFile(path.join(worktree, 'workflow.yml'), 'utf8')).toBe(
      'name: current workflow\n',
    )
  } finally {
    await safeDelete(root)
  }
})
