import { describe, expect, it, vi } from 'vitest'
import {
  extractMethods,
  resolveDataEntry,
} from '../../../scripts/repo/validate-quota-sync.mts'

const source = vi.hoisted(() => ({ text: '' }))
vi.mock(import('node:fs'), async importOriginal => {
  const original = await importOriginal()
  return {
    ...original,
    readFileSync: vi.fn((file, ...args) =>
      String(file).endsWith('socket-sdk-class.mts')
        ? source.text
        : Reflect.apply(original.readFileSync, original, [file, ...args]),
    ),
  }
})

describe('quota method metadata', () => {
  it('respects explicit operation absence and extracts generic fallback with quota', () => {
    source.text = `class Example {
  /**
   * @operationId none
   */
  async localScan(): Promise<void> {
    return request<'ignored'>()
  }
  /**
   * @quota 7 units
   */
  async readScan(): Promise<void> {
    return request<'getScan'>()
  }
}`
    expect(extractMethods()).toEqual([
      {
        hadOperationIdNone: true,
        jsdocQuota: undefined,
        name: 'localScan',
        operationId: undefined,
      },
      {
        hadOperationIdNone: false,
        jsdocQuota: 7,
        name: 'readScan',
        operationId: 'getScan',
      },
    ])
    const entry = { permissions: ['scan:read'], quota: 7 }
    expect(resolveDataEntry({ api: { GetScan: entry } }, 'getscan')).toEqual({
      entry,
      key: 'GetScan',
    })
    expect(resolveDataEntry({ api: {} }, 'missing')).toBeUndefined()
  })
})
