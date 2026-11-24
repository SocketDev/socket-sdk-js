/**
 * @file Verify signed OpenAPI requests reproduce the Git index.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it, onTestFinished } from 'vitest'

import { buildOpenApiCommitRequest } from '../../scripts/openapi-commit-request.mts'

function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'sdk-openapi-index-'))
  onTestFinished(() => rmSync(cwd, { recursive: true, force: true }))
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'core.hooksPath=.disabled-hooks', ...args], {
      cwd,
      encoding: 'utf8',
    }).trim()
  git('init', '--quiet')
  git('config', 'core.autocrlf', 'false')
  git('config', 'user.name', 'SDK Test')
  git('config', 'user.email', 'sdk@example.invalid')
  const write = (file: string, contents: string | Buffer) =>
    writeFileSync(path.join(cwd, file), contents)
  write('artifact.json', 'original\n')
  write('old name', 'original\n')
  git('add', '--all')
  git('commit', '--no-gpg-sign', '-qm', 'fixture')
  return { cwd, git, head: git('rev-parse', 'HEAD'), write }
}

it('sends staged bytes, rename paths and the expected branch head', () => {
  const { cwd, git, head, write } = fixture()
  const bytes = Buffer.from([0, 128, 255, 10])
  write('artifact.json', bytes)
  git('mv', 'old name', 'new name')
  git('add', 'artifact.json')
  write('artifact.json', 'unstaged replacement')
  write('untracked.json', 'excluded')
  const { input } = buildOpenApiCommitRequest(
    'org/sdk',
    'automated/test',
    head,
    cwd,
  ).variables
  expect(input.branch).toEqual({
    repositoryNameWithOwner: 'org/sdk',
    branchName: 'automated/test',
  })
  expect(input.expectedHeadOid).toBe(head)
  expect(input.fileChanges).toEqual({
    additions: [
      { path: 'artifact.json', contents: bytes.toString('base64') },
      {
        path: 'new name',
        contents: Buffer.from('original\n').toString('base64'),
      },
    ],
    deletions: [{ path: 'old name' }],
  })
})

const script = fileURLToPath(
  new URL('../../scripts/openapi-commit-request.mts', import.meta.url),
)

it('emits only the JSON request on stdout for a clean index', () => {
  const { cwd, head } = fixture()
  const output = execFileSync(
    process.execPath,
    [script, 'org/sdk', 'automated/test', head],
    { cwd, encoding: 'utf8' },
  )
  expect(JSON.parse(output)).toEqual(
    buildOpenApiCommitRequest('org/sdk', 'automated/test', head, cwd),
  )
  expect(JSON.parse(output).variables.input.fileChanges).toEqual({
    additions: [],
    deletions: [],
  })
})

it('rejects incomplete CLI arguments before emitting a request', () => {
  const result = spawnSync(process.execPath, [script, 'org/sdk'], {
    encoding: 'utf8',
  })
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.stderr).toContain(
    'Expected repository, branch, and base commit.',
  )
})
