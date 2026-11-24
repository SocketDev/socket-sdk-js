/**
 * @file Preserve explicit undefined in nested optional generated properties.
 */

import type { AstNode } from './generate-strict-types-lib.mts'

export interface OptionalTypeInsertion {
  position: number
  text: string
}

export function typeIncludesUndefined(node: AstNode): boolean {
  if (node.type === 'TSUndefinedKeyword') {
    return true
  }
  if (node.type === 'TSParenthesizedType' && node.typeAnnotation) {
    return typeIncludesUndefined(node.typeAnnotation)
  }
  const types = node['types'] as AstNode[] | undefined
  return (
    node.type === 'TSUnionType' && Boolean(types?.some(typeIncludesUndefined))
  )
}

export function collectOptionalTypeInsertions(
  value: unknown,
  insertions: OptionalTypeInsertion[],
): void {
  if (!value || typeof value !== 'object') {
    return
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      collectOptionalTypeInsertions(child, insertions)
    }
    return
  }
  const node = value as AstNode
  const annotation = node.typeAnnotation?.typeAnnotation
  if (
    node.type === 'TSPropertySignature' &&
    node['optional'] === true &&
    annotation &&
    !typeIncludesUndefined(annotation)
  ) {
    const needsParens =
      annotation.type === 'TSConstructorType' ||
      annotation.type === 'TSFunctionType'
    if (needsParens) {
      insertions.push({ position: annotation.start!, text: '(' })
    }
    insertions.push({
      position: annotation.end!,
      text: `${needsParens ? ')' : ''} | undefined`,
    })
  }
  const children = Object.values(node)
  for (let i = 0, { length } = children; i < length; i += 1) {
    const child = children[i]!
    collectOptionalTypeInsertions(child, insertions)
  }
}

export function renderOptionalTypeMembers(
  node: AstNode,
  source: string,
): string {
  const insertions: OptionalTypeInsertion[] = []
  collectOptionalTypeInsertions(node, insertions)
  let rendered = source.slice(node.start!, node.end!)
  const sorted = insertions.toSorted(
    (left, right) => right.position - left.position,
  )
  for (let i = 0, { length } = sorted; i < length; i += 1) {
    const insertion = sorted[i]!
    const position = insertion.position - node.start!
    rendered = `${rendered.slice(0, position)}${insertion.text}${rendered.slice(position)}`
  }
  return rendered
}
