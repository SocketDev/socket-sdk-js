import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDeleteSync } from '@socketsecurity/lib-stable/fs/safe'
import { describe, expect, it } from 'vitest'

import { checkFileForCdnRefs } from '../../../scripts/repo/validate-no-cdn-refs.mts'

describe('CDN source validation', () => {
  it('reports the offending source line and accepts local references', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'sdk-cdn-check-'))
    try {
      const file = path.join(directory, 'example.mts')
      await writeFile(
        file,
        [
          'const local = "./asset.js"',
          `const remote = "https://${['cdn', 'jsdelivr', 'net'].join('.')}/example"`,
        ].join('\n'),
      )
      const violations = await checkFileForCdnRefs(file)
      expect(violations).toHaveLength(1)
      expect(violations[0]?.line).toBe(2)
      await writeFile(file, 'const local = "./asset.js"')
      expect(await checkFileForCdnRefs(file)).toEqual([])
    } finally {
      safeDeleteSync(directory)
    }
  })
})
