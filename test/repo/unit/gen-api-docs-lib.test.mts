import { describe, expect, it, vi } from 'vitest'
import { extractMethods } from '../../../scripts/repo/gen-api-docs-lib.mts'

const source = vi.hoisted(() => ({ text: '' }))
vi.mock(import('node:fs'), async importOriginal => {
  const original = await importOriginal()
  return {
    ...original,
    readFileSync: vi.fn((file, ...args) => {
      if (String(file).endsWith('socket-sdk-class.mts')) {
        return source.text
      }
      if (String(file).endsWith('api-method-quota-and-permissions.json')) {
        return JSON.stringify({
          api: { GetScan: { quota: 3, permissions: ['scan:read'] } },
        })
      }
      return Reflect.apply(original.readFileSync, original, [file, ...args])
    }),
  }
})

describe('API documentation method extraction', () => {
  it('retains nested signatures, generator metadata, case-insensitive quotas, and overload deduplication', () => {
    source.text = `class SocketSdk {
  /**
   * Read a scan.
   * @operationId getscan
   */
  async *readScan(options: { nested: { enabled: boolean } }): AsyncGenerator<string> {
    yield 'scan'
  }
  async *readScan(): AsyncGenerator<string> {
    yield 'overload'
  }
}`
    expect(extractMethods()).toEqual([
      {
        isGenerator: true,
        name: 'readScan',
        operationId: 'getscan',
        permissions: ['scan:read'],
        quota: 3,
        signature:
          'async *readScan(options: { nested: { enabled: boolean } }): AsyncGenerator<string>',
        summary: 'Read a scan.',
      },
    ])
  })
})
