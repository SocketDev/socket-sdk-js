/**
 * @file API documentation and quota extraction use actual class methods.
 */
import { describe, expect, it } from 'vitest'

import { extractMethods as extractDocsMethods } from '../../../scripts/repo/gen-api-docs-lib.mts'
import { extractSdkClassMethods } from '../../../scripts/repo/sdk-method-extraction.mts'
import { extractMethods as extractQuotaMethods } from '../../../scripts/repo/validate-quota-sync.mts'

const source = `
function outside() {
  debugLog('before class')
}
class OtherClient {
  unrelated() { return 0 }
}
export class SocketSdk {
  constructor() { debugLog('constructor') }
  /** Ordinary result.
   * @operationId ordinaryOperation
   * @quota 3 units
   */
  ordinary<Value>(value: Value): Value {
  debugLog('same indentation as a method')
    const text = '} class SocketSdk {'
    return value
  }
  /** Async result.
   * @quota 2 units
   */
  async asynchronous(): Promise<unknown> { return this.request<'asyncOperation'>() }
  /** Generator result. */
  *records() { yield 'record' }
  /** Async generator result. */
  async *stream() { yield 'record' }
  /** Delegated generator result.
   * @operationId none
   */
  delegated(): AsyncGenerator<unknown> { return this.request<'ignoredOperation'>() }
  #hidden() { return 0 }
  private privateMethod() { return 0 }
  protected protectedMethod() { return 0 }
  get accessor() { return 0 }
  arrow = () => 0
}
if (true) {
  debugLog('after class')
}
`
const names = ['ordinary', 'asynchronous', 'records', 'stream', 'delegated']

describe('SocketSdk class method extraction', () => {
  it('extracts public ordinary, async, and generator methods without unrelated calls', () => {
    const methods = extractSdkClassMethods(source)
    expect(methods.map(method => method.name)).toEqual(names)
    expect(methods.map(method => method.isGenerator)).toEqual([
      false,
      false,
      true,
      true,
      true,
    ])
    expect(methods[0]).toMatchObject({
      operationId: 'ordinaryOperation',
      jsdocQuota: 3,
      summary: 'Ordinary result.',
      signature: 'ordinary<Value>(value: Value): Value',
    })
  })

  it('retains quota annotations and explicit operation-id exclusions', () => {
    const methods = extractQuotaMethods({ source })
    expect(methods.map(method => method.name)).toEqual(names)
    expect(methods[1]).toMatchObject({
      operationId: 'asyncOperation',
      jsdocQuota: 2,
    })
    expect(methods[4]).toMatchObject({
      operationId: undefined,
      hadOperationIdNone: true,
    })
  })

  it('renders metadata for the same class methods using supplied quota data', () => {
    const methods = extractDocsMethods({
      source,
      data: {
        api: {
          ordinaryOperation: { quota: 3, permissions: ['packages:list'] },
          asyncOperation: { quota: 2, permissions: [] },
          delegated: { quota: 9, permissions: [] },
        },
      },
    })
    expect(methods.map(method => method.name)).toEqual(names)
    expect(methods[0]).toMatchObject({
      quota: 3,
      permissions: ['packages:list'],
    })
    expect(methods[4]).toMatchObject({
      operationId: undefined,
      quota: undefined,
    })
  })

  it('handles unexported classes and ignores overload signatures', () => {
    expect(
      extractQuotaMethods({
        source:
          'class SocketSdk { method(value: string): string; method(value: string) { return value } }',
      }).map(method => method.name),
    ).toEqual(['method'])
    expect(extractQuotaMethods({ source: 'function SocketSdk() {}' })).toEqual(
      [],
    )
  })
  it('does not inherit metadata through an ordinary block comment', () => {
    const methods = extractQuotaMethods({
      source: `class SocketSdk {
      /** @operationId firstOperation */
      first() { return 1 }
      /* An ordinary comment. */
      second() { return 2 }
    }`,
    })
    expect(methods[0]?.operationId).toBe('firstOperation')
    expect(methods[1]?.operationId).toBeUndefined()
  })
})
