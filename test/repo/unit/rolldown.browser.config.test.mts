import { expect, it } from 'vitest'

import { tolerantTimeout } from '../../fleet/_shared/lib/timing.mts'

import { browserBuildConfig } from '../../../.config/repo/rolldown.browser.config.mts'
import { buildInto } from '../../utils/build-output.mts'

it(
  'produces byte-identical browser output across two builds',
  async () => {
    const first = await buildInto(browserBuildConfig)
    const second = await buildInto(browserBuildConfig)
    expect(Object.keys(first).length).toBeGreaterThan(0)
    expect(second).toEqual(first)
  },
  tolerantTimeout(60_000),
)
