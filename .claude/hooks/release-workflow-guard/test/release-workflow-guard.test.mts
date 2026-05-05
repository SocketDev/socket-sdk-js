/**
 * @fileoverview Tests for the release-workflow-guard hook.
 *
 * Runs the hook as a subprocess (node --test), piping a tool-use
 * payload on stdin and asserting on the exit code + stderr. Exit 2
 * means the hook refused the command; exit 0 means it passed it
 * through.
 */

import { execPath } from 'node:process'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isSpawnError, spawn } from '@socketsecurity/lib/spawn'

const hookScript = new URL('../index.mts', import.meta.url).pathname

async function runHook(
  command: string,
  toolName = 'Bash',
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const payload = JSON.stringify({
    tool_name: toolName,
    tool_input: { command },
  })
  return runChild(payload)
}

// Async @socketsecurity/lib/spawn — preferred over child_process
// spawnSync (see CLAUDE.md "Async spawn preferred"). Hooks are
// small, but async tests run in parallel under node --test, so
// even short subprocess waits compound when sync. spawn returns
// `{ stdin, stdout, stderr, process }` synchronously plus a thenable
// for the result; write the payload to stdin and await the result.
// On non-zero exit it throws a SpawnError — catch and lift fields
// back out so tests can assert on code (the hook's exit-2 path is
// the primary thing we test).
async function runChild(
  payload: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(execPath, [hookScript], {
    timeout: 5_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  child.stdin?.end(payload)
  try {
    const result = await child
    return {
      code: result.code,
      stdout: (result.stdout || '').toString(),
      stderr: (result.stderr || '').toString(),
    }
  } catch (e) {
    if (isSpawnError(e)) {
      return {
        code: e.code,
        stdout: (e.stdout || '').toString(),
        stderr: (e.stderr || '').toString(),
      }
    }
    throw e
  }
}

describe('release-workflow-guard hook', () => {
  describe('blocks dispatching commands', () => {
    it('gh workflow run', async () => {
      const r = await runHook('gh workflow run release.yml')
      assert.equal(r.code, 2)
      assert.match(r.stderr, /BLOCKED/)
      assert.match(r.stderr, /release\.yml/)
    })

    it('gh workflow dispatch', async () => {
      const r = await runHook('gh workflow dispatch publish.yml')
      assert.equal(r.code, 2)
      assert.match(r.stderr, /publish\.yml/)
    })

    it('gh workflow run with -f flags', async () => {
      const r = await runHook(
        'gh workflow run build.yml -f mode=prod -f arch=arm64',
      )
      assert.equal(r.code, 2)
      assert.match(r.stderr, /build\.yml/)
    })

    it('gh api .../dispatches', async () => {
      const r = await runHook(
        'gh api repos/foo/bar/actions/workflows/42/dispatches -X POST',
      )
      assert.equal(r.code, 2)
      assert.match(r.stderr, /42/)
    })

    it('gh workflow run after a chained &&', async () => {
      const r = await runHook('git fetch && gh workflow run release.yml')
      assert.equal(r.code, 2)
    })
  })

  describe('allows benign commands', () => {
    it('plain echo', async () => {
      assert.equal((await runHook('echo hello')).code, 0)
    })

    it('git status', async () => {
      assert.equal((await runHook('git status --short')).code, 0)
    })

    it('gh pr list (not a dispatch)', async () => {
      assert.equal((await runHook('gh pr list --state open')).code, 0)
    })

    it('gh workflow list (read-only, no dispatch)', async () => {
      assert.equal((await runHook('gh workflow list')).code, 0)
    })

    it('gh api repos/.../workflows (no /dispatches)', async () => {
      assert.equal(
        (await runHook('gh api repos/foo/bar/actions/workflows')).code,
        0,
      )
    })
  })

  describe('does not match inside quoted argument bodies', () => {
    it('git commit -m with double-quoted body mentioning gh workflow run', async () => {
      const r = await runHook(
        'git commit -m "chore: blocks dispatching gh workflow run jobs"',
      )
      assert.equal(r.code, 0, `Expected 0 but got ${r.code}: ${r.stderr}`)
    })

    it('git commit -m with heredoc body mentioning gh workflow run', async () => {
      const r = await runHook(
        `git commit -m "$(cat <<'EOF'\nchore: never gh workflow run anything\nEOF\n)"`,
      )
      assert.equal(r.code, 0, `Expected 0 but got ${r.code}: ${r.stderr}`)
    })

    it('echo of a doc string mentioning gh api .../dispatches', async () => {
      const r = await runHook(
        'echo "see also: gh api repos/x/y/actions/workflows/1/dispatches"',
      )
      assert.equal(r.code, 0, `Expected 0 but got ${r.code}: ${r.stderr}`)
    })

    it('single-quoted body protects against dispatch substring', async () => {
      const r = await runHook(
        "echo 'pretend command: gh workflow dispatch foo.yml'",
      )
      assert.equal(r.code, 0, `Expected 0 but got ${r.code}: ${r.stderr}`)
    })
  })

  describe('payload edge cases', () => {
    it('non-Bash tool is ignored', async () => {
      assert.equal(
        (await runHook('gh workflow run release.yml', 'Read')).code,
        0,
      )
    })

    it('empty command is ignored', async () => {
      assert.equal((await runHook('')).code, 0)
    })

    it('invalid JSON on stdin returns 0 (silent)', async () => {
      // Hook intentionally returns 0 on bad JSON (don't punish the
      // model for unparseable payloads — pass them through).
      const r = await runChild('not json')
      assert.equal(r.code, 0)
    })
  })
})
