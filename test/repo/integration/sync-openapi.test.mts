/**
 * @file Verify OpenAPI automation preserves the triggering source and limits
 *   write credentials.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { expect, it, vi } from 'vitest'
import { parse as parseYaml } from 'yaml'

import { runGitOrThrow } from '../../../.claude/hooks/fleet/_shared/git-runner.mts'
import { REPO_ROOT } from '../../../scripts/fleet/paths.mts'
import { SYNC_OPENAPI_WORKFLOW_PATH } from '../../../scripts/repo/paths.mts'
import { makeGitRepo } from '../../fleet/_shared/lib/git-fixture.mts'

interface WorkflowStep {
  env?: Record<string, string> | undefined
  id?: string | undefined
  name: string
  run?: string | undefined
}

interface SyncWorkflow {
  jobs: {
    fetch_and_update: {
      if: string
      permissions: Record<string, string>
      steps: WorkflowStep[]
    }
  }
}

it('limits write jobs to the default branch and uses the PR App for changes', async () => {
  const workflow = parseYaml(
    await fs.readFile(SYNC_OPENAPI_WORKFLOW_PATH, 'utf8'),
  ) as SyncWorkflow
  const job = workflow.jobs.fetch_and_update
  expect(job.if).toBe(
    "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
  )
  expect(job.permissions).toEqual({ actions: 'write', contents: 'read' })
  const bootstrap = job.steps.find(step => step.name === 'Bootstrap checkout')
  expect(bootstrap?.env?.['TRIGGER_REF']).toBe('${{ github.sha }}')
  const token = job.steps.find(step => step.id === 'openapi-app')
  expect(token?.env?.['CLIENT_ID']).toBe('${{ vars.SOCKET_PR_CLIENT_ID }}')
  expect(token?.env?.['APP_PRIVATE_KEY']).toBe(
    '${{ secrets.SOCKET_PR_APP_PRIVATE_KEY }}',
  )
  const push = job.steps.find(
    step => step.name === 'Commit and push generated artifacts',
  )
  const pullRequest = job.steps.find(
    step => step.name === 'Create or update pull request',
  )
  expect(push?.env?.['GH_TOKEN']).toBe('${{ steps.openapi-app.outputs.token }}')
  expect(pullRequest?.env?.['GH_TOKEN']).toBe(
    '${{ steps.openapi-app.outputs.token }}',
  )
  const dispatch = job.steps.find(step => step.name === 'Trigger CI checks')
  expect(dispatch?.env?.['GH_TOKEN']).toBe('${{ github.token }}')
})

it('verifies generated contracts with existing test files', async () => {
  const workflow = parseYaml(
    await fs.readFile(SYNC_OPENAPI_WORKFLOW_PATH, 'utf8'),
  ) as SyncWorkflow
  const verification = workflow.jobs.fetch_and_update.steps.find(
    step => step.name === 'Verify generated contracts',
  )
  const command = verification?.run
    ?.split('\n')
    .find(line => line.startsWith('pnpm test '))
  const testPaths = command?.trim().split(/\s+/u).slice(2) ?? []
  expect(testPaths.length).toBeGreaterThan(0)
  for (const testPath of testPaths) {
    expect((await fs.stat(path.join(REPO_ROOT, testPath))).isFile()).toBe(true)
  }
})

it('bases generated changes on the current workflow and source', async () => {
  const workflow = await fs.readFile(SYNC_OPENAPI_WORKFLOW_PATH, 'utf8')
  const command = workflow.match(/^\s*git switch --create (?<branch>\S+)$/mu)
  const branch = command?.groups?.['branch']
  expect(branch).toBe('automated/open-api')
  if (!branch) {
    throw new Error(
      'Generated branch is missing in the OpenAPI workflow. Expected git switch --create. Restore the branch step.',
    )
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-openapi-base-'))
  try {
    runGitOrThrow(['init', '--initial-branch=fixture-main'], { cwd: root })
    const workflowPath = path.join(root, 'workflow.yml')
    await fs.writeFile(workflowPath, 'name: original workflow\n')
    runGitOrThrow(['add', 'workflow.yml'], { cwd: root })
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
    runGitOrThrow(commitArgs, { cwd: root })
    await fs.writeFile(workflowPath, 'name: current workflow\n')
    runGitOrThrow(['add', 'workflow.yml'], { cwd: root })
    runGitOrThrow(commitArgs, { cwd: root })
    const currentHead = runGitOrThrow(['rev-parse', 'HEAD'], { cwd: root })
    const generatedPath = path.join(root, 'generated.mts')
    await fs.writeFile(generatedPath, 'export type Generated = string\n')
    const generatedBytes = await fs.readFile(generatedPath)
    runGitOrThrow(['switch', '--create', branch], { cwd: root })
    expect(runGitOrThrow(['rev-parse', 'HEAD'], { cwd: root })).toBe(
      currentHead,
    )
    expect(await fs.readFile(workflowPath, 'utf8')).toBe(
      'name: current workflow\n',
    )
    expect(await fs.readFile(generatedPath)).toEqual(generatedBytes)
  } finally {
    await safeDelete(root)
  }
})

it('isolates fixture Git commands from inherited repository paths', () => {
  const fixture = makeGitRepo()
  const inherited = makeGitRepo()
  try {
    const expectedGitDir = fixture.git('rev-parse', '--absolute-git-dir')
    const inheritedGitDir = inherited.git('rev-parse', '--absolute-git-dir')
    vi.stubEnv('GIT_DIR', inheritedGitDir)
    vi.stubEnv('GIT_WORK_TREE', inherited.dir)
    vi.stubEnv('GIT_INDEX_FILE', path.join(inheritedGitDir, 'index'))
    expect(
      runGitOrThrow(['rev-parse', '--absolute-git-dir'], { cwd: fixture.dir }),
    ).toBe(expectedGitDir)
  } finally {
    vi.unstubAllEnvs()
    fixture.cleanup()
    inherited.cleanup()
  }
})
