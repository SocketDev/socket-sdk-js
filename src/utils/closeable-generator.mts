/**
 * @file Async generator cleanup before and after iteration starts.
 */
export function createCloseableGenerator<T>(
  generator: AsyncGenerator<T>,
  close: () => void,
): AsyncGenerator<T> {
  let closed = false
  function finish(): void {
    if (!closed) {
      closed = true
      close()
    }
  }
  const iterator = {
    __proto__: null,
    async [Symbol.asyncDispose]() {
      finish()
      await generator.return(undefined)
    },
    [Symbol.asyncIterator]() {
      return this
    },
    async next(value?: unknown | undefined) {
      try {
        const result = await generator.next(value)
        if (result.done) {
          finish()
        }
        return result
      } catch (error) {
        finish()
        throw error
      }
    },
    async return(value?: unknown | undefined) {
      finish()
      return await generator.return(value)
    },
    async throw(error?: unknown | undefined) {
      finish()
      return await generator.throw(error)
    },
  }
  return iterator
}
