/**
 * @fileoverview Shared helper for rule fixers that need to inject
 * an `import { Name } from 'specifier'` statement (and optionally a
 * matching hoisted `const`) into a file.
 *
 * Fixers call `summarizeImportTarget(programNode, specifier, importName)`
 * to learn the file's current shape, then `appendImportFixes(...)`
 * inside their `fix(fixer)` callback to add the missing pieces.
 *
 * ESLint's autofixer dedupes overlapping inserts at the same range,
 * so multiple violations in the same file can each emit the import
 * insertion safely — only one survives.
 */

/**
 * Walk a Program node body once and figure out:
 *   - the last top-level ImportDeclaration node (or undefined)
 *   - whether `importName` is already imported from `specifier`
 *   - whether a top-level `localName` identifier already exists
 *     (any const/let/var or import-as-local with that name)
 */
export function summarizeImportTarget(program, specifier, importName, localName) {
  let lastImport
  let hasImport = false
  let hasLocal = false
  for (const stmt of program.body) {
    if (stmt.type === 'ImportDeclaration') {
      lastImport = stmt
      const source = stmt.source && stmt.source.value
      if (source === specifier) {
        for (const spec of stmt.specifiers) {
          if (
            spec.type === 'ImportSpecifier' &&
            spec.imported &&
            spec.imported.name === importName
          ) {
            hasImport = true
          }
          if (localName && spec.local && spec.local.name === localName) {
            hasLocal = true
          }
        }
      }
      continue
    }
    if (localName && stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (
          decl.id &&
          decl.id.type === 'Identifier' &&
          decl.id.name === localName
        ) {
          hasLocal = true
        }
      }
    }
  }
  return { hasImport, hasLocal, lastImport }
}

/**
 * Build the fixer-side inserts for missing import + optional hoist.
 * Returns an array of fixer operations the caller appends to its own
 * fix() return value.
 *
 *   summary       — output of summarizeImportTarget()
 *   fixer         — the fixer passed to context.report({ fix })
 *   importLine    — the literal `import { ... } from '...'` text
 *   hoistLine     — optional; the literal `const x = ...()` text
 */
export function appendImportFixes(summary, fixer, importLine, hoistLine) {
  const ops = []
  if (!summary.hasImport) {
    if (summary.lastImport) {
      ops.push(fixer.insertTextAfter(summary.lastImport, `\n${importLine}`))
    } else {
      ops.push(fixer.insertTextBeforeRange([0, 0], `${importLine}\n`))
    }
  }
  if (hoistLine && !summary.hasLocal) {
    if (summary.lastImport) {
      ops.push(fixer.insertTextAfter(summary.lastImport, `\n\n${hoistLine}`))
    } else {
      ops.push(fixer.insertTextBeforeRange([0, 0], `${hoistLine}\n\n`))
    }
  }
  return ops
}
