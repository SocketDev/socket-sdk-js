import { expect, it } from 'vitest'

import { tolerantTimeout } from '../../fleet/_shared/lib/timing.mts'

import { buildConfig } from '../../../.config/repo/rolldown.config.mts'
import { buildInto } from '../../utils/build-output.mts'

it(
  'produces byte-identical node output across two builds',
  async () => {
    const first = await buildInto(buildConfig)
    const second = await buildInto(buildConfig)
    expect(Object.keys(first).length).toBeGreaterThan(0)
    expect(second).toEqual(first)
  },
  tolerantTimeout(60_000),
)
