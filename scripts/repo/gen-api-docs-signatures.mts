import type { AstNode } from './generate-strict-types-lib.mts'

export function extractDeclarationSignature(
  declaration: AstNode,
  source: string,
): string {
  return (
    extractCallSignature(declaration, source) ??
    extractPropertySignature(declaration, source) ??
    extractBodySignature(declaration, source)
  )
}

function extractCallSignature(
  declaration: AstNode,
  source: string,
): string | undefined {
  const initializer = asNode(declaration.init)
  if (initializer?.type !== 'CallExpression') {
    return undefined
  }
  const callee = asNode(initializer.callee)
  const callable = nodes(initializer.arguments)[0]
  if (callee?.name === 'memoize') {
    if (!callable) {
      throw new Error('Unsupported memoize wrapper without a callable.')
    }
    return memoizedCallableSignature(declaration, callable, source)
  }
  if (isCallable(callable)) {
    const name = asNode(declaration.id)?.name
    throw new Error(`Unsupported callable wrapper for ${String(name)}.`)
  }
  return undefined
}

function extractPropertySignature(
  declaration: AstNode,
  source: string,
): string | undefined {
  if (
    declaration.type !== 'Property' &&
    declaration.type !== 'PropertyDefinition'
  ) {
    return undefined
  }
  const value = asNode(declaration.value)
  if (!value) {
    return undefined
  }
  if (isCallable(value)) {
    return callablePropertySignature(declaration, value, source)
  }
  return fieldPropertySignature(declaration, value, source)
}

function callablePropertySignature(
  declaration: AstNode,
  value: AstNode,
  source: string,
): string {
  const key = asNode(declaration.key)
  const keyStart = numeric(key?.start)
  const keyEnd = numeric(key?.end)
  if (keyStart === undefined || keyEnd === undefined) {
    return ''
  }
  const start = numeric(declaration.start) ?? keyStart
  const prefix = source.slice(start, keyStart)
  return `${prefix}${source.slice(keyStart, keyEnd)}: ${functionTypeSignature(value, source)}`
}

function fieldPropertySignature(
  declaration: AstNode,
  value: AstNode,
  source: string,
): string {
  const start = numeric(declaration.start) ?? 0
  const valueStart = numeric(value.start) ?? start
  const prefix = source.slice(start, valueStart).trimEnd()
  const field = prefix.endsWith('=') ? prefix.slice(0, -1).trimEnd() : prefix
  return isLiteralInitializer(value) && numeric(value.end) !== undefined
    ? `${field} = ${source.slice(valueStart, numeric(value.end))}`
    : field
}

function extractBodySignature(declaration: AstNode, source: string): string {
  const start = numeric(declaration.start) ?? 0
  const end = numeric(declaration.end) ?? start
  const body = asNode(declaration.body)
  const methodBody = asNode(asNode(declaration.value)?.body)
  const initializer = asNode(declaration.init)
  const functionBody = isCallable(initializer)
    ? asNode(initializer.body)
    : undefined
  const signatureEnd =
    declaration.type === 'TSInterfaceDeclaration'
      ? end
      : (numeric(methodBody?.start) ??
        numeric(body?.start) ??
        numeric(functionBody?.start) ??
        end)
  return source.slice(start, signatureEnd).trim()
}

function isCallable(value: AstNode | undefined): value is AstNode {
  return (
    value?.type === 'ArrowFunctionExpression' ||
    value?.type === 'FunctionExpression'
  )
}

function isLiteralInitializer(value: AstNode): boolean {
  return (
    value.type === 'Literal' ||
    (value.type === 'UnaryExpression' &&
      asNode(value.argument)?.type === 'Literal')
  )
}

export function memoizedCallableSignature(
  declaration: AstNode,
  callable: AstNode,
  source: string,
): string {
  const name = asNode(declaration.id)?.name
  if (typeof name !== 'string') {
    throw new Error('Unsupported memoize wrapper without a named export.')
  }
  if (
    callable.type !== 'ArrowFunctionExpression' &&
    callable.type !== 'FunctionExpression'
  ) {
    throw new Error(`Unsupported callable passed to memoize for ${name}.`)
  }
  const typeParameters = asNode(callable.typeParameters)
  const params = nodes(callable.params)
  const parameters =
    params.length > 0
      ? `(${source.slice(numeric(params[0]!.start)!, numeric(params.at(-1)!.end)!)})`
      : '()'
  const generics = typeParameters
    ? source.slice(numeric(typeParameters.start)!, numeric(typeParameters.end)!)
    : ''
  const returnType = asNode(callable.returnType)
  const returnAnnotation = returnType
    ? source.slice(numeric(returnType.start)!, numeric(returnType.end)!)
    : ''
  return `function ${name}${generics}${parameters}${returnAnnotation}`
}

export function functionTypeSignature(
  callable: AstNode,
  source: string,
): string {
  const params = nodes(callable.params)
  const parameters =
    params.length > 0
      ? source.slice(numeric(params[0]!.start)!, numeric(params.at(-1)!.end)!)
      : ''
  const returnType = asNode(callable.returnType)
  const returnAnnotation = returnType
    ? source.slice(numeric(returnType.start)!, numeric(returnType.end)!)
    : 'unknown'
  return `(${parameters}) => ${returnAnnotation.replace(/^:\s*/, '')}`
}

export function trimBlankLines(value: string): string {
  const lines = value.split(/\r?\n/)
  while (lines[0]?.trim() === '') {
    lines.shift()
  }
  while (lines.at(-1)?.trim() === '') {
    lines.pop()
  }
  return lines.join('\n')
}

function asNode(value: unknown): AstNode | undefined {
  return isNode(value) ? value : undefined
}

function isNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function nodes(value: unknown): AstNode[] {
  return Array.isArray(value) ? value.filter(isNode) : []
}
