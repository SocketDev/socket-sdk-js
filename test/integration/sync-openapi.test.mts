/**
 * @file Verify OpenAPI automation uses repository-owned scripts and workflows.
 */

import fs from 'node:fs/promises'

import { expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'

import { CHECK_COMMANDS } from '../../scripts/check/run.mts'
import { REPO_ROOT } from '../../scripts/paths/repo.mts'
import {
  BUILD_RUNNER_PATH,
  CHECK_RUNNER_PATH,
  CLEAN_RUNNER_PATH,
} from '../../scripts/paths/runners.mts'

it('runs generation and validation from the default branch', async () => {
  const workflow = parseYaml(
    await fs.readFile(
      `${REPO_ROOT}/.github/workflows/chore-sync-openapi.yml`,
      'utf8',
    ),
  ) as {
    jobs: Record<
      string,
      {
        if: string
        steps: Array<{ name?: string; uses?: string; run?: string }>
      }
    >
  }
  const job = workflow.jobs['sync']
  expect(job?.if).toBe(
    "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
  )
  expect(
    job?.steps.some(step => step.uses?.startsWith('./.github/actions/fleet/')),
  ).toBe(false)
  const steps = job?.steps ?? []
  const generationStep = steps.findIndex(
    step => step.run === 'pnpm run update:openapi',
  )
  const verificationStep = steps.findIndex(
    step => step.run === 'pnpm run check:openapi-pr',
  )
  const publicationStep = steps.findIndex(
    step => step.name === 'Create signed update pull request',
  )
  expect(generationStep).toBeGreaterThanOrEqual(0)
  expect(verificationStep).toBeGreaterThan(generationStep)
  expect(publicationStep).toBeGreaterThan(verificationStep)
})

it('checks committed API contracts in pull request CI', async () => {
  const workflow = parseYaml(
    await fs.readFile(`${REPO_ROOT}/.github/workflows/ci-gates.yml`, 'utf8'),
  ) as {
    jobs: Record<string, { steps: Array<{ run?: string }> }>
  }
  const packageJson = JSON.parse(
    await fs.readFile(`${REPO_ROOT}/package.json`, 'utf8'),
  ) as { scripts: Record<string, string> }
  expect(
    workflow.jobs['check']?.steps.some(step => step.run === 'pnpm run check'),
  ).toBe(true)
  expect(packageJson.scripts['check']).toBe(`node ${CHECK_RUNNER_PATH}`)
  expect(packageJson.scripts['build']).toBe(`node ${BUILD_RUNNER_PATH}`)
  expect(packageJson.scripts['clean']).toBe(`node ${CLEAN_RUNNER_PATH}`)
  expect(CHECK_COMMANDS).toContainEqual({
    args: ['run', 'check:api-contracts'],
    command: 'pnpm',
  })
})
