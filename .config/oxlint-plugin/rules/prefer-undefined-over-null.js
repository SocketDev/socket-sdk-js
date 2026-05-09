/**
 * @fileoverview Per CLAUDE.md "null vs undefined": use `undefined`.
 * `null` is allowed only for `__proto__: null` (object-literal
 * prototype null) or external API requirements (e.g., JSON encoding,
 * `Object.create(null)`, listener-error sinks, third-party callbacks).
 *
 * Autofix scope:
 *   - **Deterministic**: rewrites `null` → `undefined` ONLY when
 *     context is demonstrably safe. Earlier versions had a
 *     context-blind autofix that produced fleet-wide regressions;
 *     the current set of skip predicates covers every regression
 *     seen in the rollout:
 *       - `__proto__: null` (with or without `as` cast) — the
 *         null-prototype-object contract.
 *       - `Object.create(null)`, `Object.setPrototypeOf(o, null)`,
 *         `Reflect.setPrototypeOf(o, null)` — prototype-aware
 *         callsites that throw / reject `undefined`.
 *       - `JSON.stringify(value, null, space)` — replacer-slot
 *         convention.
 *       - `=== null` / `!== null` comparisons — semantically distinct.
 *   - **AI-handled** (Step 4 of `pnpm run fix`): literals whose
 *     surrounding type annotation mentions `null`
 *     (e.g. `let x: string | null = null`). The annotation is the
 *     contract; flipping just the value creates type errors. The
 *     AI step flips BOTH the value and the annotation in lockstep
 *     and traces through the function signatures / interfaces /
 *     return types that depend on it — exactly the refactor that
 *     blew up socket-stuie when the deterministic autofix was
 *     context-blind.
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer `undefined` over `null` (CLAUDE.md style — `null` is allowed only for __proto__:null or external API requirements).',
      category: 'Stylistic Issues',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      preferUndefined:
        'Use `undefined` instead of `null` (allowed exceptions: `__proto__: null`, `Object.create(null)`, external API requirements like JSON.stringify replacer / third-party callbacks).',
      preferUndefinedNoFix:
        'Use `undefined` instead of `null`. Surrounding type annotation mentions `null` — both the annotation (`| null` → `| undefined`) and the value need to flip together. Handed off to the AI-fix step (Step 4 of `pnpm run fix`) to trace the refactor through the function signatures / interfaces / return types involved.',
    },
    schema: [],
  },

  create(context) {
    /**
     * Walk up through TS type-cast wrappers (`x as T`, `x as const`,
     * `<T>x`) so that `null as never` inside `{ __proto__: null as never }`
     * still matches the proto-null exception. Without this, the autofix
     * rewrites `null as never` → `undefined as never`, which silently
     * breaks the null-prototype object semantics — `Object.create(null)`
     * vs `Object.create(undefined)` are very different.
     */
    function unwrapTsCast(node) {
      let cur = node.parent
      while (
        cur &&
        (cur.type === 'TSAsExpression' || cur.type === 'TSTypeAssertion')
      ) {
        cur = cur.parent
      }
      return cur
    }

    function isProtoNull(node) {
      // Find the nearest non-cast ancestor; for `null as never` this
      // skips the TSAsExpression and lands on the Property.
      const parent = unwrapTsCast(node)
      if (!parent || parent.type !== 'Property') {
        return false
      }
      // Walk back down: parent.value may be the TSAsExpression or the
      // Literal directly. Either is fine — we matched on the parent.
      const key = parent.key
      if (!key) {
        return false
      }
      // { __proto__: null } — key is Identifier `__proto__` or string '__proto__'.
      if (key.type === 'Identifier' && key.name === '__proto__') {
        return true
      }
      if (key.type === 'Literal' && key.value === '__proto__') {
        return true
      }
      return false
    }

    function isComparisonOperand(node) {
      const parent = node.parent
      if (!parent) {
        return false
      }
      if (parent.type !== 'BinaryExpression') {
        return false
      }
      return ['===', '!==', '==', '!='].includes(parent.operator)
    }

    function isJsonStringifyReplacer(node) {
      // JSON.stringify(value, replacer, space) — `replacer` is conventionally null.
      const parent = unwrapTsCast(node)
      if (
        !parent ||
        parent.type !== 'CallExpression' ||
        parent.arguments[1] !== node
      ) {
        return false
      }
      const callee = parent.callee
      if (callee.type !== 'MemberExpression') {
        return false
      }
      return (
        callee.object.type === 'Identifier' &&
        callee.object.name === 'JSON' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'stringify'
      )
    }

    /**
     * Prototype-aware callsites where `null` is the explicit "no
     * prototype" sentinel. Replacing any of these with `undefined`
     * either throws TypeError or silently changes semantics:
     *
     *   - `Object.create(null)` — first arg, throws if undefined.
     *   - `Object.setPrototypeOf(o, null)` — second arg, semantics
     *     differ (undefined is rejected by the spec).
     *   - `Reflect.setPrototypeOf(o, null)` — same as above.
     *
     * Each entry is `[object, method, argIndex]` where argIndex is the
     * 0-indexed slot whose `null` is allowed.
     */
    const PROTOTYPE_NULL_CALLSITES = [
      ['Object', 'create', 0],
      ['Object', 'setPrototypeOf', 1],
      ['Reflect', 'setPrototypeOf', 1],
    ]

    function isPrototypeAwareNull(node) {
      const parent = unwrapTsCast(node)
      if (!parent || parent.type !== 'CallExpression') {
        return false
      }
      const callee = parent.callee
      if (callee.type !== 'MemberExpression') {
        return false
      }
      if (
        callee.object.type !== 'Identifier' ||
        callee.property.type !== 'Identifier'
      ) {
        return false
      }
      const objectName = callee.object.name
      const methodName = callee.property.name
      for (const [obj, method, argIndex] of PROTOTYPE_NULL_CALLSITES) {
        if (
          obj === objectName &&
          method === methodName &&
          parent.arguments[argIndex] === node
        ) {
          return true
        }
      }
      return false
    }

    /**
     * Walk up the AST and return true if any ancestor carries a TS type
     * annotation that mentions `null`. Used to skip autofix on cases
     * like `let x: string | null = null` where flipping just the value
     * creates a type error. Walks until a function / block / program
     * boundary so we don't pick up unrelated type annotations elsewhere
     * in the file.
     *
     * Cheap shortcut: stringify the typeAnnotation subtree and look for
     * a 'null' token. Avoids a full type-system traversal.
     */
    function hasNullTypeAnnotation(node) {
      const sourceCode = context.getSourceCode
        ? context.getSourceCode()
        : context.sourceCode

      let cur = node.parent
      while (cur) {
        // Boundary nodes — stop walking here.
        if (
          cur.type === 'FunctionDeclaration' ||
          cur.type === 'FunctionExpression' ||
          cur.type === 'ArrowFunctionExpression' ||
          cur.type === 'BlockStatement' ||
          cur.type === 'Program'
        ) {
          // For functions, the return-type annotation lives on the
          // function node itself. Check it before stopping.
          if (cur.returnType) {
            const text = sourceCode.getText(cur.returnType)
            if (/\bnull\b/.test(text)) {
              return true
            }
          }
          return false
        }
        // Variable declarations: `let x: T = ...` puts the annotation on
        // the VariableDeclarator's `id.typeAnnotation`.
        if (
          cur.type === 'VariableDeclarator' &&
          cur.id &&
          cur.id.typeAnnotation
        ) {
          const text = sourceCode.getText(cur.id.typeAnnotation)
          if (/\bnull\b/.test(text)) {
            return true
          }
        }
        // Property: `foo: T` or `foo?: T` — check the property's
        // typeAnnotation (in TS interfaces / type literals) or the
        // value's wrapper for object literals.
        if (cur.type === 'Property' && cur.typeAnnotation) {
          const text = sourceCode.getText(cur.typeAnnotation)
          if (/\bnull\b/.test(text)) {
            return true
          }
        }
        // Function parameters: `(x: T = null) => ...`. The default value
        // is an AssignmentPattern; the annotated parameter is the left.
        if (
          cur.type === 'AssignmentPattern' &&
          cur.left &&
          cur.left.typeAnnotation
        ) {
          const text = sourceCode.getText(cur.left.typeAnnotation)
          if (/\bnull\b/.test(text)) {
            return true
          }
        }
        // TS-specific: TSAsExpression / TSTypeAssertion carrying a `null`-
        // bearing type — skip autofix even though the cast itself isn't
        // the proto-null shape.
        if (
          (cur.type === 'TSAsExpression' || cur.type === 'TSTypeAssertion') &&
          cur.typeAnnotation
        ) {
          const text = sourceCode.getText(cur.typeAnnotation)
          if (/\bnull\b/.test(text)) {
            return true
          }
        }
        cur = cur.parent
      }
      return false
    }

    return {
      Literal(node) {
        if (node.value !== null || node.raw !== 'null') {
          return
        }

        if (isProtoNull(node)) {
          return
        }
        if (isComparisonOperand(node)) {
          return
        }
        if (isPrototypeAwareNull(node)) {
          return
        }
        if (isJsonStringifyReplacer(node)) {
          return
        }

        if (hasNullTypeAnnotation(node)) {
          // Surrounding type annotation mentions null — report without
          // autofix so the human flips both annotation and value.
          context.report({
            node,
            messageId: 'preferUndefinedNoFix',
          })
          return
        }

        context.report({
          node,
          messageId: 'preferUndefined',
          fix(fixer) {
            return fixer.replaceText(node, 'undefined')
          },
        })
      },
    }
  },
}

export default rule
