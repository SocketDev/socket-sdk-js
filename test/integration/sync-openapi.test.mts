/**
 * @file Verify OpenAPI automation uses repository-owned scripts and workflows.
 */

import fs from 'node:fs/promises'

import { expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'

import { REPO_ROOT } from '../../scripts/paths.mts'

it('runs generation and validation from the default branch', async () => {
  const workflow = parseYaml(
    await fs.readFile(
      `${REPO_ROOT}/.github/workflows/chore-sync-openapi.yml`,
      'utf8',
    ),
  ) as {
    jobs: Record<
      string,
      { if: string; steps: Array<{ uses?: string; run?: string }> }
    >
  }
  const job = workflow.jobs['sync']
  expect(job?.if).toBe(
    "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
  )
  expect(
    job?.steps.some(step => step.uses?.startsWith('./.github/actions/fleet/')),
  ).toBe(false)
  expect(job?.steps.some(step => step.run === 'pnpm run update:openapi')).toBe(
    true,
  )
  expect(
    job?.steps.some(step => step.run?.includes('pnpm run check:api-contracts')),
  ).toBe(true)
})
