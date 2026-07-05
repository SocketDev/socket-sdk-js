/**
 * @file Exports-surface policy for @socketsecurity/sdk. Consumed by the
 *   public-files-are-exported validator (its `ignore` contract); the exports
 *   map in package.json is hand-maintained — this config carries only the
 *   exclusions until it grows the full generation policy for
 *   make-package-exports.mts. The ignored declarations are internal helper
 *   modules the dts emit produces alongside the public surface; no public
 *   declaration references them.
 */

export const config = {
  ignore: ['dist/utils.d.mts', 'dist/utils/*'],
}
