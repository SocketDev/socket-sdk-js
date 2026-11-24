# Batch generator pool: why it is not `Promise.race`

Per-repo detail extracted from `src/socket-sdk-class.mts` to fit the inline
comment cap. The batch fetch drains a pool of async generators; this page is the
long version of why it does that with a completion queue rather than the obvious
`Promise.race`.

## The shape that leaks

The natural way to drain a pool is to keep a `Map<generator, promise>` of every
in-flight step and loop on:

```js
await Promise.race(running.values())
```

That reads fine and is wrong at scale.

`Promise.race` attaches a **fresh** pair of `.then(resolve, reject)` handlers to
every promise it is passed, every single time it is called. Those handlers stay
attached until the promise they sit on settles. The race settling does not
detach them from the losers.

So with 10 generators where one finishes quickly and nine are slow, each
iteration of the loop:

1. race returns generator #3's step,
2. we start generator #3's next step and race over 10 promises again,
3. the nine slow promises still carry handlers from the previous race, plus the
   nine we just added.

After N iterations, a single long-running generator's promise has roughly N dead
handler closures queued on it, each holding its closure state alive. Across a
batch of thousands of components that is a real memory leak, and the garbage
collector cannot help until every generator in the pool settles.

## The shape that does not

Flip the direction. Rather than the main loop repeatedly racing the pool, each
generator's `.then` pushes its result into a small queue (`completed`), and the
main loop awaits one promise at a time via `takeStep()`. Each generator attaches
its handlers exactly **once per step**, so nothing stacks and nothing leaks.

`running` survives only as a `Set` for pool-size accounting - how many
generators are still in flight. It no longer stores promises, because nothing
races them.

## References

- The canonical write-up of the accumulation problem:
  <https://github.com/nodejs/node/issues/17469>
- The one-shot-handler pattern this adopts: the `@watchable/unpromise` package.

## If you are tempted to simplify this

The leak is invisible in the code that replaced it - that is the trap. A reader
who sees a completion queue and thinks "this could just be `Promise.race`" has
no local evidence to the contrary, which is why this page exists and why
`src/socket-sdk-class.mts` points at it.
