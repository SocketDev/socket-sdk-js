/**
 * @file Guards against re-introducing a SocketSdkOptions field the request path
 *   drops on the floor. `agent` was such a field: it was resolved, stored on
 *   the internal request options, and never forwarded, so every request used
 *   Node's globalAgent while the docs promised connection pooling and proxy
 *   support. The transport (`httpRequest` from `@socketsecurity/lib`) builds
 *   its `http.request` options from a fixed list that has no agent slot, so the
 *   option was removed rather than wired up.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { SocketSdkOptions } from '../../../src/index.mts'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
)

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

describe('SocketSdkOptions carries no dead transport option', () => {
  it('does not declare an agent option', () => {
    const types = readRepoFile('src/types.mts')
    const optionsBlock = types.slice(
      types.indexOf('export interface SocketSdkOptions {'),
    )

    expect(optionsBlock).not.toMatch(/^\s{2}agent\?:/m)
  })

  it('rejects an agent option at the type level', () => {
    const options: SocketSdkOptions = {
      // @ts-expect-error - `agent` is not a SocketSdkOptions field.
      agent: undefined,
    }

    expect(options).toBeDefined()
  })

  it('re-add the option only once the transport accepts an agent', () => {
    // The reversal condition: if `HttpRequestOptions` grows an `agent` field,
    // the SDK can forward one again and this assertion should be replaced by
    // real forwarding plus a test that the agent is used.
    const transportOptions = readRepoFile(
      'node_modules/@socketsecurity/lib/dist/http-request/request-types.d.ts',
    )

    expect(transportOptions).not.toMatch(/^\s{4}agent\?:/m)
  })
})
