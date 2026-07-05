/**
 * @file Per the fleet options convention: a function that reads an `options` /
 *   `opts` parameter must first normalize it with `{ __proto__: null,
 *   ...options }` before destructuring or property-access. The null prototype
 *   defends against a caller passing an object with a polluted prototype (a
 *   `__proto__` / inherited property masquerading as an option); reading the
 *   raw param lets that pollution flow into the function's logic. socket-lib
 *   does this in ~125 modules (`const { cwd } = { __proto__: null, ...options }
 *   as Opts`); this rule holds the rest of the fleet to it. Flags a function
 *   with a param named `options` / `opts` whose body reads it (a `const { … } =
 *   options` destructure, or an `options.x` / `options?.x` member access)
 *   without a `{ __proto__: null, ...options }` spread present in the body.
 *   Autofixed both ways with an `as typeof <name>` cast on TypeScript files
 *   (`.ts`/`.tsx`/`.mts`/`.cts`, detected via `context.filename` the same way
 *   `optional-explicit-undefined` / `prefer-cached-for-loop` do) — a closed
 *   options type rejects the `__proto__` excess property without it: the
 *   destructure form rewrites `const { … } = options` to `const { … } = {
 *   __proto__: null, ...options } as typeof options`; a member-access reader
 *   gets a NORMALIZED LOCAL `const opts = { __proto__: null, ...options } as
 *   typeof options` prepended to the body and each `options.x` read repointed
 *   at `opts.x`. On a plain JS file (`.js`/`.mjs`/`.cjs`/…) the same rewrites
 *   land WITHOUT the `as typeof <name>` cast — `as` is TypeScript-only syntax
 *   and a SyntaxError in plain JS, and the cast is erased at runtime anyway, so
 *   dropping it changes nothing observable. The fix never reassigns the param
 *   in place — the fleet bans variable shadowing,
 *   and an in-place `options = …` conflates the raw input with its normalized
 *   form (the anti-pattern options-param-naming kills). The member-access fix
 *   only applies when the param is literally `options` (a param already named
 *   `opts` would collide with the new local → reported without a fix;
 *   options-param-naming renames it `opts`→`options` first). A function that
 *   passes `options` straight through untouched (never reads a property) is not
 *   flagged. Test files (`*.test.*`, `/test/`) are skipped — they mock
 *   options-shaped literals, not production readers. Bypass: a `socket-lint:
 *   allow options-null-proto` comment.
 */

import { normalizePath } from '@socketsecurity/lib-stable/paths/normalize'

import { makeBypassChecker } from '../../lib/comment-markers.mts'
import type { AstNode, RuleContext } from '../../lib/rule-types.mts'

const BYPASS_RE = /socket-lint:\s*allow\s+options-null-proto/

const OPTIONS_NAMES = new Set(['options', 'opts'])

// A param whose name is `options` / `opts` (plain Identifier or optional
// `options?:`). Returns the name, or undefined.
function optionsParamName(params: AstNode[]): string | undefined {
  for (let i = 0, { length } = params; i < length; i += 1) {
    const p = params[i]
    if (p?.type === 'Identifier' && OPTIONS_NAMES.has(p.name)) {
      return p.name
    }
  }
  return undefined
}

// Does `body` source already contain a `{ __proto__: null, ...<name> }`
// normalization? A cheap source-substring check on the function body keeps the
// rule simple and avoids deep AST matching of the spread.
function hasNullProtoNormalization(bodyText: string, name: string): boolean {
  return bodyText.includes('__proto__: null') && bodyText.includes(`...${name}`)
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A function reading an `options`/`opts` param must normalize it via `{ __proto__: null, ...options }` first (prototype-pollution defense).',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      banned:
        'reads `{{name}}` without normalizing it — a caller could pass a polluted prototype. Use `{ __proto__: null, ...{{name}} }` before destructuring/accessing. Bypass: add a `socket-lint: allow options-null-proto` comment.',
    },
    schema: [],
  },

  create(context: RuleContext) {
    const hasBypassComment = makeBypassChecker(context, BYPASS_RE)
    const source = context.sourceCode ?? context.getSourceCode?.()

    // Test files mock options-shaped objects freely (a `function(opts)` test
    // helper isn't a production options reader, and a mock's closed literal type
    // rejects the `__proto__` spread). The prototype-pollution defense is for
    // shipped src; skip `*.test.*` and `/test/` trees.
    const filename = context.filename ?? context.getFilename?.() ?? ''
    if (
      /\.test\.[cm]?[jt]sx?$/.test(filename) ||
      /\/test\//.test(normalizePath(filename))
    ) {
      return {}
    }

    // The `as typeof <name>` cast is TypeScript-only syntax (a SyntaxError in
    // plain JS) — emit it only for TS files. An unresolvable filename is
    // treated as non-TypeScript, the safe default: emitting valid-everywhere
    // JS is never wrong, while emitting `as` into an unknown file kind can be.
    const isTypeScriptFile = /\.(?:cts|mts|tsx?)$/.test(filename)

    function check(node: AstNode): void {
      if (node.body == null) {
        return
      }
      const params = node.params
      if (!Array.isArray(params)) {
        return
      }
      const name = optionsParamName(params)
      if (!name) {
        return
      }
      if (hasBypassComment(node)) {
        return
      }
      const bodyText = source?.getText?.(node.body) ?? ''
      if (hasNullProtoNormalization(bodyText, name)) {
        return
      }

      // Find the first read of the param: a `const { … } = options`
      // destructure (fixable in place) and/or every `options.<x>` /
      // `options?.<x>` member access (fixable by introducing a normalized
      // `opts` local). Walk the body's statements collecting both.
      let firstDestructure: AstNode | undefined
      const memberObjects: AstNode[] = []

      const visit = (n: AstNode | undefined): void => {
        if (!n || typeof n !== 'object') {
          return
        }
        if (
          n.type === 'VariableDeclarator' &&
          n.id?.type === 'ObjectPattern' &&
          n.init?.type === 'Identifier' &&
          n.init.name === name &&
          !firstDestructure
        ) {
          firstDestructure = n
        }
        if (
          n.type === 'MemberExpression' &&
          n.object?.type === 'Identifier' &&
          n.object.name === name
        ) {
          // Collect the `options` identifier node of `options.x` so the fix can
          // repoint it at the normalized `opts` local.
          memberObjects.push(n.object)
        }
        for (const key of Object.keys(n)) {
          if (key === 'parent') {
            continue
          }
          const child = (n as Record<string, unknown>)[key]
          if (Array.isArray(child)) {
            for (let i = 0, { length } = child; i < length; i += 1) {
              visit(child[i] as AstNode)
            }
          } else if (child && typeof child === 'object') {
            visit(child as AstNode)
          }
        }
      }
      visit(node.body)

      if (!firstDestructure && !memberObjects.length) {
        // Param is passed through untouched — nothing to normalize.
        return
      }

      // Fix strategy (both forms cast `as typeof options` on TS files only —
      // see `isTypeScriptFile` above — so a closed options type rejects the
      // `__proto__` excess property — TS2353 — on the bare spread; the param's
      // own type erases the cast; plain JS gets the identical spread with no
      // cast, since there's no type checker to satisfy and `as` is a
      // SyntaxError outside TypeScript):
      //   - a `const { … } = options` destructure → rewrite its init to the
      //     normalized spread in place (no new binding, no shadow).
      //   - member-access readers → introduce a NORMALIZED LOCAL
      //     `const opts = { __proto__: null, ...options }` (plus the cast on
      //     TS files) as the first body statement and repoint each
      //     `options.x` read at it. We never reassign the param
      //     (`options = …`): the fleet bans variable shadowing, and an
      //     in-place reassign conflates the raw input with its normalized
      //     form (the anti-pattern options-param-naming kills). The
      //     `options` → `opts` rename is only safe when the param is literally
      //     `options`; a param already named `opts` would collide with the new
      //     local, so that case is reported WITHOUT a fix — options-param-naming
      //     renames the param `opts`→`options` first, then this fix applies.
      const body = node.body
      const canInsert =
        body?.type === 'BlockStatement' && Array.isArray(body.body)

      context.report({
        node: firstDestructure ?? node,
        messageId: 'banned',
        data: { name },
        fix(fixer: {
          replaceText: (n: AstNode, text: string) => unknown
          insertTextBefore: (n: AstNode, text: string) => unknown
        }) {
          if (firstDestructure?.init) {
            const cast = isTypeScriptFile ? ` as typeof ${name}` : ''
            return fixer.replaceText(
              firstDestructure.init,
              `{ __proto__: null, ...${name} }${cast}`,
            )
          }
          const first = canInsert ? body.body[0] : undefined
          // Member-access fix requires a block body to host the new statement
          // AND a param named `options` (so the `opts` local can't shadow it).
          if (!first || name !== 'options') {
            return undefined
          }
          const indent = '  '
          const cast = isTypeScriptFile ? ' as typeof options' : ''
          const fixes = [
            fixer.insertTextBefore(
              first,
              `const opts = { __proto__: null, ...options }${cast}\n${indent}`,
            ),
            ...memberObjects.map(obj => fixer.replaceText(obj, 'opts')),
          ]
          return fixes
        },
      })
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    }
  },
}

// oxlint-disable-next-line socket/no-default-export -- oxlint plugin contract requires default-exported rule object.
export default rule
