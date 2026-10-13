import {
  declarationExport,
  declarationKind,
  exportedNames,
  externalContract,
  moduleBindings,
  namespaceContract,
  nodeArray,
  nodeName,
  nodeOf,
  resolveRelative,
  stringValue,
} from './export-source.mts'
import type {
  ExportInfo,
  ExportNode,
  ExportTraversal,
  ImportBinding,
} from './export-source.mts'

export function resolveNamedExport(
  subpath: string,
  packagePath: string,
  name: string,
  traversal: ExportTraversal,
  options: {
    readonly resolving?: Set<string>
    readonly forcedKind?: 'value' | 'type'
  } = {},
): ExportInfo | undefined {
  const resolving = options.resolving ?? new Set<string>()
  const forcedKind = options.forcedKind ?? 'value'
  const key = `${packagePath}\0${name}`
  if (resolving.has(key)) {
    return undefined
  }
  const next = new Set(resolving)
  next.add(key)
  const parsed = traversal.sources.get(packagePath)
  if (!parsed) {
    return undefined
  }
  const { declarations, imports } = moduleBindings(parsed.statements)
  return (
    resolveDirectOrDefault(
      subpath,
      packagePath,
      name,
      traversal,
      parsed.source,
      parsed.statements,
      declarations,
      next,
      forcedKind,
    ) ??
    resolveNamedSource(
      subpath,
      packagePath,
      name,
      traversal,
      parsed.statements,
      next,
      forcedKind,
    ) ??
    resolveLocalExport(
      subpath,
      packagePath,
      name,
      traversal,
      parsed.source,
      parsed.statements,
      declarations,
      imports,
      next,
      forcedKind,
    ) ??
    resolveStarExport(
      subpath,
      packagePath,
      name,
      traversal,
      parsed.statements,
      next,
      forcedKind,
    )
  )
}

function resolveDirectOrDefault(
  subpath: string,
  packagePath: string,
  name: string,
  traversal: ExportTraversal,
  source: string,
  statements: readonly ExportNode[],
  declarations: Map<string, ExportNode>,
  resolving: Set<string>,
  forcedKind: 'type' | 'value',
): ExportInfo | undefined {
  const direct = declarations.get(name)
  if (direct && hasDirectExport(statements, name)) {
    return declarationExport(subpath, name, direct, packagePath, source, {
      kind: declarationKind(direct, forcedKind),
    })
  }
  if (name !== 'default') {
    return undefined
  }
  const statement = statements.find(
    item => item.type === 'ExportDefaultDeclaration',
  )
  const declaration = statement && nodeOf(statement.declaration)
  if (!declaration) {
    return undefined
  }
  if (declaration.type === 'Identifier') {
    return resolveDefaultIdentifier(
      subpath,
      packagePath,
      declaration,
      traversal,
      resolving,
    )
  }
  const localName = nodeName(declaration)
  const local = localName ? declarations.get(localName) : undefined
  return declarationExport(
    subpath,
    name,
    local ?? declaration,
    packagePath,
    source,
    { kind: forcedKind },
  )
}

function resolveNamedSource(
  subpath: string,
  packagePath: string,
  name: string,
  traversal: ExportTraversal,
  statements: readonly ExportNode[],
  resolving: Set<string>,
  forcedKind: 'type' | 'value',
): ExportInfo | undefined {
  for (const statement of statements) {
    const namespace = namespaceFromStatement(
      statement,
      subpath,
      packagePath,
      name,
      traversal,
      forcedKind,
    )
    if (namespace) {
      return namespace
    }
    const edge = namedSourceEdge(statement, name)
    if (edge) {
      return resolveNamedSourceEdge(
        subpath,
        packagePath,
        name,
        edge,
        traversal,
        resolving,
        forcedKind,
      )
    }
  }
  return undefined
}

function resolveNamedSourceEdge(
  subpath: string,
  packagePath: string,
  name: string,
  edge: { modulePath: string; localName: string; kind: 'type' | 'value' },
  traversal: ExportTraversal,
  resolving: Set<string>,
  forcedKind: 'type' | 'value',
): ExportInfo | undefined {
  const kind = edge.kind === 'type' || forcedKind === 'type' ? 'type' : 'value'
  if (!edge.modulePath.startsWith('.')) {
    return externalContract(subpath, name, edge.modulePath, kind)
  }
  const found = resolveNamedExport(
    subpath,
    resolveRelative(packagePath, edge.modulePath),
    edge.localName,
    traversal,
    { resolving, forcedKind: kind },
  )
  return found
    ? { ...found, subpath, name, kind: kind === 'type' ? 'type' : found.kind }
    : undefined
}

function resolveLocalExport(
  subpath: string,
  packagePath: string,
  name: string,
  traversal: ExportTraversal,
  source: string,
  statements: readonly ExportNode[],
  declarations: Map<string, ExportNode>,
  imports: Map<string, ImportBinding>,
  resolving: Set<string>,
  forcedKind: 'type' | 'value',
): ExportInfo | undefined {
  const edge = localExportEdge(statements, name)
  if (!edge) {
    return undefined
  }
  const local = declarations.get(edge.localName)
  if (local) {
    const kind =
      edge.kind === 'type' || forcedKind === 'type' ? 'type' : 'value'
    return declarationExport(subpath, name, local, packagePath, source, {
      kind: declarationKind(local, kind),
    })
  }
  const imported = imports.get(edge.localName)
  return imported
    ? resolveImport(
        subpath,
        packagePath,
        name,
        imported,
        edge.kind,
        traversal,
        resolving,
      )
    : undefined
}

function resolveStarExport(
  subpath: string,
  packagePath: string,
  name: string,
  traversal: ExportTraversal,
  statements: readonly ExportNode[],
  resolving: Set<string>,
  forcedKind: 'type' | 'value',
): ExportInfo | undefined {
  if (name === 'default' || exportedNames(statements).has(name)) {
    return undefined
  }
  for (const statement of statements) {
    if (statement.type !== 'ExportAllDeclaration') {
      continue
    }
    const modulePath = stringValue(statement['source'])
    if (!modulePath?.startsWith('.')) {
      continue
    }
    const kind =
      forcedKind === 'type' || statement['exportKind'] === 'type'
        ? 'type'
        : 'value'
    const found = resolveNamedExport(
      subpath,
      resolveRelative(packagePath, modulePath),
      name,
      traversal,
      { resolving, forcedKind: kind },
    )
    if (found) {
      return { ...found, kind: kind === 'type' ? 'type' : found.kind }
    }
  }
  return undefined
}

function resolveImport(
  subpath: string,
  packagePath: string,
  name: string,
  binding: ImportBinding,
  exportKind: 'type' | 'value',
  traversal: ExportTraversal,
  resolving: Set<string>,
): ExportInfo | undefined {
  const kind =
    binding.kind === 'type' || exportKind === 'type' ? 'type' : 'value'
  if (!binding.modulePath.startsWith('.')) {
    return externalContract(subpath, name, binding.modulePath, kind)
  }
  const target = resolveRelative(packagePath, binding.modulePath)
  if (binding.imported === '*') {
    return namespaceContract(subpath, name, target, kind, traversal)
  }
  const found = resolveNamedExport(
    subpath,
    target,
    binding.imported,
    traversal,
    { resolving, forcedKind: kind },
  )
  return found
    ? { ...found, subpath, name, kind: kind === 'type' ? 'type' : found.kind }
    : undefined
}

function hasDirectExport(
  statements: readonly ExportNode[],
  name: string,
): boolean {
  return statements.some(statement => {
    if (statement.type !== 'ExportNamedDeclaration') {
      return false
    }
    const declaration = nodeOf(statement.declaration)
    if (declaration) {
      const items =
        declaration.type === 'VariableDeclaration'
          ? nodeArray(declaration['declarations'])
          : [declaration]
      return items.some(item => nodeName(item.id) === name)
    }
    return false
  })
}

function localExportEdge(
  statements: readonly ExportNode[],
  name: string,
): { localName: string; kind: 'type' | 'value' } | undefined {
  for (const statement of statements) {
    if (statement.type !== 'ExportNamedDeclaration' || statement['source']) {
      continue
    }
    const specifier = nodeArray(statement['specifiers']).find(
      item => (nodeName(item['exported']) ?? nodeName(item['local'])) === name,
    )
    const localName = specifier && nodeName(specifier['local'])
    if (localName && specifier) {
      return {
        localName,
        kind:
          statement['exportKind'] === 'type' ||
          specifier['exportKind'] === 'type'
            ? 'type'
            : 'value',
      }
    }
  }
  return undefined
}

function namedSourceEdge(
  statement: ExportNode,
  name: string,
):
  | { modulePath: string; localName: string; kind: 'type' | 'value' }
  | undefined {
  if (statement.type !== 'ExportNamedDeclaration' || !statement['source']) {
    return undefined
  }
  const modulePath = stringValue(statement['source'])
  const specifier = nodeArray(statement['specifiers']).find(
    item => nodeName(item['exported']) === name,
  )
  const localName = specifier && nodeName(specifier['local'])
  if (!modulePath || !localName || !specifier) {
    return undefined
  }
  return {
    modulePath,
    localName,
    kind:
      statement['exportKind'] === 'type' || specifier['exportKind'] === 'type'
        ? 'type'
        : 'value',
  }
}

function namespaceFromStatement(
  statement: ExportNode,
  subpath: string,
  packagePath: string,
  name: string,
  traversal: ExportTraversal,
  forcedKind: 'type' | 'value',
): ExportInfo | undefined {
  if (
    statement.type !== 'ExportAllDeclaration' ||
    nodeName(statement['exported']) !== name
  ) {
    return undefined
  }
  const modulePath = stringValue(statement['source'])
  if (!modulePath?.startsWith('.')) {
    return undefined
  }
  const kind =
    forcedKind === 'type' || statement['exportKind'] === 'type'
      ? 'type'
      : 'value'
  return namespaceContract(
    subpath,
    name,
    resolveRelative(packagePath, modulePath),
    kind,
    traversal,
  )
}

export function resolveDefaultIdentifier(
  subpath: string,
  packagePath: string,
  declaration: ExportNode,
  traversal: ExportTraversal,
  resolving: Set<string>,
): ExportInfo | undefined {
  const parsed = traversal.sources.get(packagePath)
  const name = nodeName(declaration)
  if (!parsed || !name) {
    return undefined
  }
  const { declarations, imports } = moduleBindings(parsed.statements)
  const local = declarations.get(name)
  if (local) {
    return declarationExport(
      subpath,
      'default',
      local,
      packagePath,
      parsed.source,
      { kind: declarationKind(local, 'value') },
    )
  }
  const imported = imports.get(name)
  if (imported) {
    return resolveImport(
      subpath,
      packagePath,
      'default',
      imported,
      imported.kind,
      traversal,
      resolving,
    )
  }
  return resolveNamedExport(subpath, packagePath, name, traversal, {
    resolving,
  })
}
