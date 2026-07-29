/**
 * @file Incremental newline-delimited JSON line splitting. One line-boundary
 *   implementation shared by every NDJSON reader in the SDK — the buffered
 *   batch-PURL generator and the pull-driven patch stream both drive the same
 *   splitter, so the boundary rules cannot drift between them.
 */

/**
 * Stateful newline splitter. `push` returns the complete lines a chunk
 * finished, holding any trailing partial line until the next chunk completes
 * it; `flush` releases that partial line once the source ends. Blank lines are
 * dropped — an NDJSON record is one JSON value per line.
 */
export interface NdjsonLineSplitter {
  flush(): string[]
  push(chunk: string): string[]
}

/**
 * Build a splitter that turns arbitrary chunk boundaries into whole NDJSON
 * lines.
 */
export function createNdjsonLineSplitter(): NdjsonLineSplitter {
  let pending = ''
  return {
    flush(): string[] {
      const tail = pending
      pending = ''
      return tail.length ? [tail] : []
    },
    push(chunk: string): string[] {
      const text = pending + chunk
      const lines: string[] = []
      let start = 0
      for (let i = 0, { length } = text; i < length; i += 1) {
        if (text.charCodeAt(i) === 10) {
          if (i > start) {
            lines.push(text.slice(start, i))
          }
          start = i + 1
        }
      }
      pending = start < text.length ? text.slice(start) : ''
      return lines
    },
  }
}

/**
 * Yield NDJSON lines from a chunk source, one line at a time. The generator
 * suspends between lines, so a slow consumer pauses the underlying stream
 * instead of letting the whole body accumulate. UTF-8 sequences split across a
 * chunk boundary are stitched back together by the streaming decoder.
 *
 * @param source - Async or sync chunk source, e.g. an `IncomingMessage`.
 */
export async function* iterateNdjsonLines(
  source: AsyncIterable<Uint8Array | string> | Iterable<Uint8Array | string>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder('utf-8')
  const splitter = createNdjsonLineSplitter()
  for await (const chunk of source) {
    const text =
      typeof chunk === 'string'
        ? chunk
        : decoder.decode(chunk, { stream: true })
    if (text) {
      yield* splitter.push(text)
    }
  }
  const tail = decoder.decode()
  if (tail) {
    yield* splitter.push(tail)
  }
  yield* splitter.flush()
}

/**
 * Yield NDJSON lines from a resident string. Use this only when the whole body
 * is already in memory; prefer `iterateNdjsonLines` over a response stream.
 */
export function* readNdjsonLines(text: string): Generator<string> {
  const splitter = createNdjsonLineSplitter()
  yield* splitter.push(text)
  yield* splitter.flush()
}
