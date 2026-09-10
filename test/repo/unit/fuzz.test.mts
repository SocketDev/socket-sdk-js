import { describe, expect, it } from 'vitest'

import { parseShmRows } from '../../../scripts/repo/fuzz.mts'

describe('shared memory inventory parsing', () => {
  it('retains owner and attachment evidence and ignores malformed rows', () => {
    expect(
      parseShmRows(
        [
          'T ID KEY MODE OWNER GROUP CREATOR CGROUP NATTCH SEGSZ CPID LPID',
          'm 123 0 --rw------- example-user staff example-user staff 0 4096 456 456',
          'm invalid 0 --rw------- example-user staff example-user staff 0 4096 789 789',
          'm 321 0 --rw------- example-user staff example-user staff 2 4096 654 654',
          'm too-short',
        ].join('\n'),
      ),
    ).toEqual([
      { cpid: 456, nattch: 0, owner: 'example-user', shmid: 123 },
      { cpid: 654, nattch: 2, owner: 'example-user', shmid: 321 },
    ])
  })
})
