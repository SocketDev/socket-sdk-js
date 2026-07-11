/**
 * @file Exports-surface policy for @socketsecurity/sdk. Consumed by the
 *   public-files-are-exported validator (its `ignore` contract); the exports
 *   map in package.json is hand-maintained — this config carries only the
 *   exclusions until it grows the full generation policy for
 *   make-package-exports.mts. The declaration build emits one .d.mts per
 *   module; the public surface is the two entry declarations named in the
 *   exports map, and every sibling .d.mts is their module graph (the entries
 *   re-export from them, so TypeScript resolution needs them shipped) — not
 *   an independently exported entry point. The validator does not walk
 *   declaration imports, so the graph is excluded from orphan detection
 *   here; exports targets themselves are still validated to resolve.
 */

export const config = {
  ignore: ['dist/*.d.mts', 'dist/utils/*'],
}
