import { rolldown } from 'rolldown'
import { expect, it } from 'vitest'

import { tolerantTimeout } from '../../fleet/_shared/lib/timing.mts'

import { buildConfig } from '../../../.config/repo/rolldown.config.mts'
import { buildInto } from '../../utils/build-output.mts'

it('keeps legal and optimization comments without package documentation', async () => {
  const bundle = await rolldown({
    input: 'virtual:comment-fixture',
    plugins: [
      {
        name: 'comment-fixture',
        resolveId(id) {
          return id
        },
        load() {
          return `/** @license Example license notice. */
/** Example module documentation. */
export const documentedPackage = /* @__PURE__ */ Object.freeze({ name: 'example-package' })`
        },
      },
    ],
  })
  try {
    const { output } = await bundle.generate(buildConfig.output)
    const code = output.find(chunk => chunk.type === 'chunk')?.code
    expect(code).toContain('Example license notice.')
    expect(code).toContain('@__PURE__')
    expect(code).not.toContain('Example module documentation.')
  } finally {
    await bundle.close()
  }
})

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
