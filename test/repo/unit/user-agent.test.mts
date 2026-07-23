/**
 * @file Property/fuzz tests for src/user-agent.mts (Tier-1 fast-check).
 *   `createUserAgentFromPkgJson` is a pure string builder. Arbitraries are
 *   constructed so the expected User-Agent is knowable without duplicating the
 *   SUT: names are drawn from characters that carry no '@' or '/', so the SUT's
 *   `.replace('@','')` / `.replace('/','-')` are no-ops and the name passes
 *   through verbatim.
 */

import fc from 'fast-check'
import { describe, expect, test } from 'vitest'

import { createUserAgentFromPkgJson } from '../../../src/user-agent.mts'

// A plain (unscoped) package-name fragment: alnum + dashes + dots, no '@'/'/'.
const plainName = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-.'), {
    minLength: 1,
    maxLength: 16,
  })
  .map(chars => chars.join(''))

const version = fc
  .tuple(fc.nat({ max: 99 }), fc.nat({ max: 99 }), fc.nat({ max: 99 }))
  .map(parts => parts.join('.'))

describe('user-agent/createUserAgentFromPkgJson (fuzz)', () => {
  // DERIVED-FROM-INPUT: for a name free of '@' and '/', the UA (no homepage) is
  // exactly `${name}/${version}`.
  test('formats "name/version" for a plain name without homepage', () => {
    fc.assert(
      fc.property(plainName, version, (name, ver) => {
        expect(createUserAgentFromPkgJson({ name, version: ver })).toBe(
          `${name}/${ver}`,
        )
      }),
    )
  })

  // DERIVED-FROM-INPUT: a homepage is appended in parentheses.
  test('appends "(homepage)" when a truthy homepage is present', () => {
    fc.assert(
      fc.property(plainName, version, plainName, (name, ver, homepage) => {
        expect(
          createUserAgentFromPkgJson({ name, version: ver, homepage }),
        ).toBe(`${name}/${ver} (${homepage})`)
      }),
    )
  })

  // NORMALIZER: a scoped name `@scope/pkg` drops the leading '@' and turns the
  // first '/' into '-' -> `scope-pkg`.
  test('normalizes a scoped @scope/pkg name to scope-pkg', () => {
    fc.assert(
      fc.property(plainName, plainName, version, (scope, pkg, ver) => {
        expect(
          createUserAgentFromPkgJson({
            name: `@${scope}/${pkg}`,
            version: ver,
          }),
        ).toBe(`${scope}-${pkg}/${ver}`)
      }),
    )
  })

  // INVARIANT + NEVER-THROWS: for arbitrary string fields the result is a string
  // containing the version and a '/' separator.
  test('always returns a string containing the version and a slash', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (name, ver) => {
        const ua = createUserAgentFromPkgJson({ name, version: ver })
        expect(typeof ua).toBe('string')
        expect(ua).toContain('/')
        expect(ua).toContain(ver)
      }),
    )
  })
})
