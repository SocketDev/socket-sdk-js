/**
 * @file Tests for the shared NDJSON line splitter (src/utils/ndjson.mts) —
 *   the one line-boundary implementation the batch-PURL reader and the patch
 *   stream both drive. Covers chunk boundaries that fall mid-line, multi-byte
 *   UTF-8 sequences split across chunks, blank-line handling, and the laziness
 *   contract that a slow consumer never forces the source to run ahead.
 */

import { describe, expect, it } from 'vitest'

import {
  createNdjsonLineSplitter,
  iterateNdjsonLines,
  readNdjsonLines,
} from '../../../src/utils/ndjson.mts'

describe('createNdjsonLineSplitter', () => {
  it('holds a partial line until the chunk that completes it', () => {
    const splitter = createNdjsonLineSplitter()
    expect(splitter.push('{"a":')).toEqual([])
    expect(splitter.push('1}\n{"b":2}')).toEqual(['{"a":1}'])
    expect(splitter.flush()).toEqual(['{"b":2}'])
  })

  it('drops blank lines and releases nothing when the source ends clean', () => {
    const splitter = createNdjsonLineSplitter()
    expect(splitter.push('\n\n{"a":1}\n\n')).toEqual(['{"a":1}'])
    expect(splitter.flush()).toEqual([])
  })

  it('resets pending state after a flush', () => {
    const splitter = createNdjsonLineSplitter()
    splitter.push('tail')
    expect(splitter.flush()).toEqual(['tail'])
    expect(splitter.flush()).toEqual([])
  })
})

describe('readNdjsonLines', () => {
  it('yields every record of a resident body', () => {
    expect([...readNdjsonLines('{"a":1}\n{"b":2}\n{"c":3}')]).toEqual([
      '{"a":1}',
      '{"b":2}',
      '{"c":3}',
    ])
  })

  it('yields nothing for an empty body', () => {
    expect([...readNdjsonLines('')]).toEqual([])
  })
})

describe('iterateNdjsonLines', () => {
  it('stitches a multi-byte UTF-8 sequence split across chunks', async () => {
    const encoded = Buffer.from('{"name":"café"}\n', 'utf8')
    // Split inside the two-byte é so a per-chunk decode would corrupt it.
    const splitAt = encoded.indexOf(0xc3) + 1
    const lines: string[] = []
    for await (const line of iterateNdjsonLines([
      encoded.subarray(0, splitAt),
      encoded.subarray(splitAt),
    ])) {
      lines.push(line)
    }
    expect(lines).toEqual(['{"name":"café"}'])
  })

  it('accepts a resident string source', async () => {
    const lines: string[] = []
    for await (const line of iterateNdjsonLines(['{"a":1}\n{"b":2}'])) {
      lines.push(line)
    }
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('pulls only as many chunks as the consumer asks for', async () => {
    let chunksRead = 0
    const source = {
      async *[Symbol.asyncIterator]() {
        for (const record of ['{"a":1}\n', '{"b":2}\n', '{"c":3}\n']) {
          chunksRead += 1
          yield Buffer.from(record, 'utf8')
        }
      },
    }
    const iterator = iterateNdjsonLines(source)
    const first = await iterator.next()

    expect(first.value).toBe('{"a":1}')
    // A buffered reader would have drained all three chunks to produce one line.
    expect(chunksRead).toBe(1)

    await iterator.next()
    expect(chunksRead).toBe(2)
    await iterator.return(undefined)
  })
})
