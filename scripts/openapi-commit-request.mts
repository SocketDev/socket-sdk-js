/**
 * @file Build a GitHub signed-commit request from the staged OpenAPI changes.
 */
import { execFileSync } from 'node:child_process'

import { isMainModule } from './cli.mts'

export function buildOpenApiCommitRequest(
  repository: string,
  branch: string,
  head: string,
  cwd = process.cwd(),
) {
  const changes = execFileSync(
    'git',
    ['diff', '--cached', '--no-renames', '--name-status', '-z', head, '--'],
    { cwd, encoding: 'utf8' },
  ).split('\0')
  const additions: Array<{ path: string; contents: string }> = []
  const deletions: Array<{ path: string }> = []
  for (let i = 0; i < changes.length - 1; i += 2) {
    const status = changes[i]
    const path = changes[i + 1]!
    if (status === 'D') {
      deletions.push({ path })
    } else if (status === 'A' || status === 'M') {
      const bytes = execFileSync('git', ['cat-file', 'blob', ':' + path], {
        cwd,
        maxBuffer: 64 * 1024 * 1024,
      })
      additions.push({ path, contents: bytes.toString('base64') })
    } else {
      throw new Error(`Unsupported staged change ${status} for ${path}`)
    }
  }

  return {
    query:
      'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }',
    variables: {
      input: {
        branch: { repositoryNameWithOwner: repository, branchName: branch },
        expectedHeadOid: head,
        message: { headline: 'fix(openapi): sync API contracts' },
        fileChanges: { additions, deletions },
      },
    },
  }
}

if (isMainModule(import.meta.url)) {
  const [repository, branch, head] = process.argv.slice(2)
  if (!repository || !branch || !head) {
    throw new Error('Expected repository, branch, and base commit.')
  }
  process.stdout.write(
    JSON.stringify(buildOpenApiCommitRequest(repository, branch, head)),
  )
}
