/**
 * @file Tests for the GitHub pull-request helpers + the release-branch promote
 *   that routes a branch-protected `main` bump through a PR + squash auto-merge
 *   instead of a direct fast-forward ref push (which a protected main rejects
 *   with 422). All GitHub calls are mocked with nock over node:http.
 *
 * @vitest-environment node
 */

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import {
  createPullRequest,
  enablePullRequestAutoMerge,
  mergePullRequest,
} from '../../../scripts/fleet/lib/github-pull-requests.mts'
import { promoteReleaseBranch } from '../../../scripts/fleet/publish-infra/release-branch.mts'
import {
  isCoverageMode,
  setupTestEnvironment,
} from '../../utils/environment.mts'

import type { ReleaseBranch } from '../../../scripts/fleet/publish-infra/release-branch.mts'

const API = 'https://api.github.com'
const REPO = 'SocketDev/socket-sdk-js'

// Nock static replies are skipped in coverage mode (forks pool) — same guard
// the SDK's nock suites use.
const describeGh = isCoverageMode ? describe.skip : describe

function releaseBranch(): ReleaseBranch {
  return {
    branch: 'npm-publish-v1.4.3',
    env: {
      mainBranch: 'main',
      repo: REPO,
      token: 'release-app-token',
    },
    version: '1.4.3',
  }
}

// oxlint-disable-next-line socket/require-vitest-globals-import -- describeGh aliases the imported describe (describe.skip in coverage mode), not a global.
describeGh('github-pull-requests', () => {
  setupTestEnvironment()

  describe('createPullRequest', () => {
    it('opens a PR and returns its number + node id', async () => {
      nock(API)
        .post(`/repos/${REPO}/pulls`, body => {
          expect(body.base).toBe('main')
          expect(body.head).toBe('npm-publish-v1.4.3')
          expect(body.title).toBe('chore: bump version to 1.4.3')
          return true
        })
        .reply(201, { node_id: 'PR_node_1', number: 42 })

      const pr = await createPullRequest({
        base: 'main',
        body: 'bump',
        head: 'npm-publish-v1.4.3',
        repo: REPO,
        title: 'chore: bump version to 1.4.3',
        token: 't',
      })

      expect(pr).toEqual({ nodeId: 'PR_node_1', number: 42 })
    })

    it('reuses the existing open PR when create returns 422', async () => {
      nock(API)
        .post(`/repos/${REPO}/pulls`)
        .reply(422, { message: 'A pull request already exists for ...' })
      nock(API)
        .get(`/repos/${REPO}/pulls`)
        .query({
          base: 'main',
          head: 'SocketDev:npm-publish-v1.4.3',
          state: 'open',
        })
        .reply(200, [{ node_id: 'PR_node_existing', number: 7 }])

      const pr = await createPullRequest({
        base: 'main',
        body: 'bump',
        head: 'npm-publish-v1.4.3',
        repo: REPO,
        title: 'chore: bump version to 1.4.3',
        token: 't',
      })

      expect(pr).toEqual({ nodeId: 'PR_node_existing', number: 7 })
    })
  })

  describe('enablePullRequestAutoMerge', () => {
    it('returns true when auto-merge is enabled', async () => {
      nock(API)
        .post('/graphql', body => {
          expect(body.variables.id).toBe('PR_node_1')
          expect(body.variables.headline).toBe('chore: bump version to 1.4.3')
          expect(body.query).toContain('mergeMethod: SQUASH')
          return true
        })
        .reply(200, { data: { enablePullRequestAutoMerge: {} } })

      const queued = await enablePullRequestAutoMerge({
        commitHeadline: 'chore: bump version to 1.4.3',
        pullRequestId: 'PR_node_1',
        repo: REPO,
        token: 't',
      })

      expect(queued).toBe(true)
    })

    it('returns false (not throw) when the PR is already in clean status', async () => {
      nock(API)
        .post('/graphql')
        .reply(200, {
          errors: [{ message: 'Pull request is in clean status' }],
        })

      const queued = await enablePullRequestAutoMerge({
        commitHeadline: 'chore: bump version to 1.4.3',
        pullRequestId: 'PR_node_1',
        repo: REPO,
        token: 't',
      })

      expect(queued).toBe(false)
    })

    it('throws on any other GraphQL error', async () => {
      nock(API)
        .post('/graphql')
        .reply(200, { errors: [{ message: 'Resource not accessible' }] })

      await expect(
        enablePullRequestAutoMerge({
          commitHeadline: 'chore: bump version to 1.4.3',
          pullRequestId: 'PR_node_1',
          repo: REPO,
          token: 't',
        }),
      ).rejects.toThrow(/Resource not accessible/)
    })
  })

  describe('mergePullRequest', () => {
    it('squash-merges the PR with the bump subject as the commit title', async () => {
      nock(API)
        .put(`/repos/${REPO}/pulls/42/merge`, body => {
          expect(body.merge_method).toBe('squash')
          expect(body.commit_title).toBe('chore: bump version to 1.4.3')
          return true
        })
        .reply(200, { merged: true })

      await expect(
        mergePullRequest({
          commitTitle: 'chore: bump version to 1.4.3',
          number: 42,
          repo: REPO,
          token: 't',
        }),
      ).resolves.toBeUndefined()
    })
  })

  describe('promoteReleaseBranch', () => {
    it('opens a PR and enables squash auto-merge (no direct ref push)', async () => {
      nock(API)
        .post(`/repos/${REPO}/pulls`, body => {
          expect(body.title).toBe('chore: bump version to 1.4.3')
          return true
        })
        .reply(201, { node_id: 'PR_node_1', number: 42 })
      nock(API)
        .post('/graphql', body => {
          expect(body.variables.headline).toBe('chore: bump version to 1.4.3')
          return true
        })
        .reply(200, { data: { enablePullRequestAutoMerge: {} } })

      await expect(
        promoteReleaseBranch(releaseBranch(), 'abc1234def'),
      ).resolves.toBeUndefined()
      // Both interceptors consumed → no direct PATCH of refs/heads/main.
      expect(nock.isDone()).toBe(true)
    })

    it('merges immediately when auto-merge cannot be enabled (clean status)', async () => {
      nock(API)
        .post(`/repos/${REPO}/pulls`)
        .reply(201, { node_id: 'PR_node_1', number: 42 })
      nock(API)
        .post('/graphql')
        .reply(200, {
          errors: [{ message: 'Pull request is in clean status' }],
        })
      nock(API)
        .put(`/repos/${REPO}/pulls/42/merge`, body => {
          expect(body.merge_method).toBe('squash')
          expect(body.commit_title).toBe('chore: bump version to 1.4.3')
          return true
        })
        .reply(200, { merged: true })

      await expect(
        promoteReleaseBranch(releaseBranch(), 'abc1234def'),
      ).resolves.toBeUndefined()
      expect(nock.isDone()).toBe(true)
    })
  })
})
