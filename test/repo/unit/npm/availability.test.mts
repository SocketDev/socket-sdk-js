import { afterEach, describe, expect, it, vi } from 'vitest'

import { main } from '../../../../scripts/repo/npm/availability.mts'
import {
  chooseReleaseVersion,
  parseReleaseCommits,
} from '../../../../scripts/repo/npm/prepare-content.mts'

describe('npm version availability', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks the SDK package version with a HEAD request', async () => {
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe(
          'https://registry.npmjs.org/@socketsecurity%2fsdk/4.3.1',
        )
        expect(init?.method).toBe('HEAD')
        return new Response(null, { status: 200 })
      },
    )
    vi.stubGlobal('fetch', fetcher)

    await main(['4.3.1'])

    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('bumps breaking conventional commits to the next major version', () => {
    expect(
      chooseReleaseVersion(
        ['4.3.0'],
        [{ sha: 'abc1234', subject: 'refactor(repo)!: require Node 24' }],
        [],
      ),
    ).toBe('5.0.0')
  })

  it('bumps a BREAKING CHANGE footer to the next major version', () => {
    const commits = parseReleaseCommits(
      'abc1234\0feat: change the client contract\0\nBREAKING CHANGE: remove the old option\0',
    )

    expect(commits).toMatchObject([
      {
        sha: 'abc1234',
        subject: 'feat: change the client contract',
        body: 'BREAKING CHANGE: remove the old option',
      },
    ])
    expect(chooseReleaseVersion(['4.3.0'], commits, [])).toBe('5.0.0')
  })
})
