/**
 * @file Verify OpenAPI automation preserves the triggering source and limits
 *   write credentials.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'

import { SYNC_OPENAPI_WORKFLOW_PATH } from '../../../scripts/repo/paths.mts'

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
    const currentHead = await runGit(root, ['rev-parse', 'HEAD'])
    const generatedPath = path.join(root, 'generated.mts')
    await fs.writeFile(generatedPath, 'export type Generated = string\n')
    await runGit(root, ['switch', '--create', branch])
    expect(await runGit(root, ['rev-parse', 'HEAD'])).toBe(currentHead)
    expect(await fs.readFile(workflowPath, 'utf8')).toBe(
      'name: current workflow\n',
    )
    expect(await fs.readFile(generatedPath, 'utf8')).toBe(
      'export type Generated = string\n',
    )
  } finally {
    await safeDelete(root)
  }
})
