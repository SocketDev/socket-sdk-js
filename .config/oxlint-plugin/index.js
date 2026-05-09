/**
 * @fileoverview Fleet oxlint plugin. Custom rules that encode the
 * fleet's CLAUDE.md style guide as lint errors with autofix where
 * the rewrite is unambiguous.
 *
 * Why a plugin instead of a separate scanner: oxlint's native plugin
 * surface integrates with the existing `pnpm run lint` pipeline,
 * inherits oxlint's AST + sourcemap + fix-application machinery, and
 * keeps the rule set discoverable via `oxlint --rules`.
 *
 * Wiring: `.oxlintrc.json` adds this plugin via `jsPlugins:
 * ["./.config/oxlint-plugin/index.js"]` and enables rules under the
 * `socket/` namespace.
 */

import exportTopLevelFunctions from './rules/export-top-level-functions.js'
import inclusiveLanguage from './rules/inclusive-language.js'
import maxFileLines from './rules/max-file-lines.js'
import noConsolePreferLogger from './rules/no-console-prefer-logger.js'
import noDynamicImportOutsideBundle from './rules/no-dynamic-import-outside-bundle.js'
import noFetchPreferHttpRequest from './rules/no-fetch-prefer-http-request.js'
import noInlineLogger from './rules/no-inline-logger.js'
import noNpxDlx from './rules/no-npx-dlx.js'
import noPlaceholders from './rules/no-placeholders.js'
import noPromiseRaceInLoop from './rules/no-promise-race-in-loop.js'
import noStatusEmoji from './rules/no-status-emoji.js'
import personalPathPlaceholders from './rules/personal-path-placeholders.js'
import preferAsyncSpawn from './rules/prefer-async-spawn.js'
import preferExistsSync from './rules/prefer-exists-sync.js'
import preferNodeBuiltinImports from './rules/prefer-node-builtin-imports.js'
import preferSafeDelete from './rules/prefer-safe-delete.js'
import preferUndefinedOverNull from './rules/prefer-undefined-over-null.js'
import socketApiTokenEnv from './rules/socket-api-token-env.js'
import sortNamedImports from './rules/sort-named-imports.js'
import sortRegexAlternations from './rules/sort-regex-alternations.js'
import sortSetArgs from './rules/sort-set-args.js'
import sortSourceMethods from './rules/sort-source-methods.js'

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: 'socket',
    version: '0.4.0',
  },
  rules: {
    'export-top-level-functions': exportTopLevelFunctions,
    'inclusive-language': inclusiveLanguage,
    'max-file-lines': maxFileLines,
    'no-console-prefer-logger': noConsolePreferLogger,
    'no-dynamic-import-outside-bundle': noDynamicImportOutsideBundle,
    'no-fetch-prefer-http-request': noFetchPreferHttpRequest,
    'no-inline-logger': noInlineLogger,
    'no-npx-dlx': noNpxDlx,
    'no-placeholders': noPlaceholders,
    'no-promise-race-in-loop': noPromiseRaceInLoop,
    'no-status-emoji': noStatusEmoji,
    'personal-path-placeholders': personalPathPlaceholders,
    'prefer-async-spawn': preferAsyncSpawn,
    'prefer-exists-sync': preferExistsSync,
    'prefer-node-builtin-imports': preferNodeBuiltinImports,
    'prefer-safe-delete': preferSafeDelete,
    'prefer-undefined-over-null': preferUndefinedOverNull,
    'socket-api-token-env': socketApiTokenEnv,
    'sort-named-imports': sortNamedImports,
    'sort-regex-alternations': sortRegexAlternations,
    'sort-set-args': sortSetArgs,
    'sort-source-methods': sortSourceMethods,
  },
}

export default plugin
