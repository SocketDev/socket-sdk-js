/**
 * @file Repo overlay over the fleet oxlint config. The `--type-aware`
 *   tsgolint lane the fleet lint runner's whole-tree gate turned on is staged
 *   OFF rule-by-rule here, mirroring socket-registry's adoption overlay.
 *   First enforcement surfaced ~200 pre-existing findings concentrated in the
 *   SDK's response plumbing: `src/socket-sdk-class.mts` narrows raw API JSON
 *   to the generated `types/api.d.ts` shapes via `as` casts by design, and
 *   `scripts/**` files sit outside the root tsconfig project, so tsgolint
 *   resolves them WITHOUT `noUncheckedIndexedAccess` and flags the indexed
 *   `!` assertions that `tsgo -p .config/fleet/tsconfig.check.json` (which
 *   enables it) requires — the two checkers disagree and the assertion is
 *   load-bearing. Burn the debt down rule-by-rule, deleting entries here as
 *   each rule reaches zero findings — the fleet lint-modernization campaign
 *   owns the sweep. This is a REPO-SPECIFIC concern, so it lives in
 *   `.config/repo/` (auto-discovered by the fleet lint runner, which prefers
 *   a repo overlay over the fleet canonical), NOT in the cascaded fleet
 *   config.
 */

import { defineConfig } from 'oxlint'

import { config } from '../fleet/oxlint.config.mts'

// oxlint-disable-next-line socket/no-default-export -- oxlint loads the config from this module's default export.
export default defineConfig(
  config({
    rules: {
      // Brand-new socket/* rule from the plugin sync: the SDK's public
      // method signatures keep their published `options` param names —
      // renaming to `config` is an API-shape change that needs its own
      // reviewed pass, not a lint sweep.
      'socket/bag-param-optionality-naming': 'off',
      // Fights the fleet-owned socket/optional-explicit-undefined rule on
      // optional function params: the socket rule requires the explicit
      // `| undefined` (exactOptionalPropertyTypes pairing) that this rule
      // then flags as a duplicate constituent. The socket rule wins.
      'typescript/no-duplicate-type-constituents': 'off',
      // tsgolint resolves scripts/** without the check project's
      // noUncheckedIndexedAccess, so it flags the indexed `!` assertions
      // tsgo requires. Off until the project mapping is unified.
      'typescript/no-unnecessary-type-assertion': 'off',
      'typescript/no-unnecessary-type-conversion': 'off',
      // The SDK narrows raw API JSON to generated types/api.d.ts shapes via
      // `as` casts by design (121 sites at first enforcement).
      'typescript/no-unsafe-type-assertion': 'off',
      'typescript/restrict-template-expressions': 'off',
    },
  }),
)
