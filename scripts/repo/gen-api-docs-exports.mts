import { compareStr } from '@socketsecurity/lib-stable/sorts/strings'

import {
  declarationExport,
  declarationKind,
  discoverModules,
  exportedNames,
  externalContract,
  moduleBindings,
  namespaceContract,
  nodeArray,
  nodeName,
  nodeOf,
  normalizeTarget,
  resolveRelative,
  stringValue,
} from './gen-api-docs-export-source.mts'
import type {
  ExportInfo,
  ExportNode,
  ExportTraversal,
  PackageExportTarget,
} from './gen-api-docs-export-source.mts'
import {
  resolveDefaultIdentifier,
  resolveNamedExport,
} from './gen-api-docs-resolver.mts'

export function extractPackageExports(
  targets: readonly PackageExportTarget[],
  readSource: (packagePath: string) => string,
): ExportInfo[] {
  const output: ExportInfo[] = []
  for (const { subpath, target } of targets) {
    if (!target || subpath === './package.json') {
      continue
    }
    const traversal: ExportTraversal = { sources: new Map() }
    const packagePath = normalizeTarget(target)
    discoverModules(packagePath, readSource, traversal)
    output.push(...enumerateExports(subpath, packagePath, traversal))
  }
  return deduplicateExports(output)
}

function enumerateExports(
  subpath: string,
  packagePath: string,
  traversal: ExportTraversal,
  resolving = new Set<string>(),
): ExportInfo[] {
  if (resolving.has(packagePath)) {
    return []
  }
  const next = new Set(resolving)
  next.add(packagePath)
  const parsed = traversal.sources.get(packagePath)
  if (!parsed) {
    throw new Error(`Public export module was not discovered: ${packagePath}.`)
  }
  const names = exportedNames(parsed.statements)
  const bindings = moduleBindings(parsed.statements)
  const output: ExportInfo[] = []
  for (const statement of parsed.statements) {
    output.push(
      ...enumerateStatement(
        subpath,
        packagePath,
        statement,
        names,
        bindings,
        traversal,
        next,
      ),
    )
  }
  return output
}

function enumerateStatement(
  subpath: string,
  packagePath: string,
  statement: ExportNode,
  explicitNames: Set<string>,
  bindings: ReturnType<typeof moduleBindings>,
  traversal: ExportTraversal,
  resolving: Set<string>,
): ExportInfo[] {
  if (statement.type === 'ExportDefaultDeclaration') {
    const declaration = nodeOf(statement.declaration)
    if (!declaration) {
      throw new Error(`Unsupported default export in ${packagePath}.`)
    }
    const found =
      declaration.type === 'Identifier'
        ? resolveDefaultIdentifier(
            subpath,
            packagePath,
            declaration,
            traversal,
            new Set(resolving),
          )
        : declarationExport(
            subpath,
            'default',
            declaration,
            packagePath,
            traversal.sources.get(packagePath)!.source,
            declarationKind(declaration, 'value'),
          )
    if (!found) {
      throw new Error(`Unresolved default export in ${packagePath}.`)
    }
    return [{ ...found, subpath, name: 'default' }]
  }
  if (statement.type === 'ExportAllDeclaration') {
    return enumerateStar(
      subpath,
      packagePath,
      statement,
      explicitNames,
      traversal,
      resolving,
    )
  }
  if (statement.type !== 'ExportNamedDeclaration') {
    if (
      statement.type === 'TSExportAssignment' ||
      statement.type === 'TSNamespaceExportDeclaration'
    ) {
      throw new Error(
        `Unsupported public export syntax in ${packagePath}: ${statement.type}.`,
      )
    }
    return []
  }
  const declaration = nodeOf(statement.declaration)
  if (declaration) {
    return enumerateDeclaration(
      subpath,
      packagePath,
      declaration,
      statement.exportKind === 'type' ? 'type' : 'value',
      traversal,
    )
  }
  const modulePath = stringValue(statement.source)
  if (modulePath) {
    return enumerateNamedSource(
      subpath,
      packagePath,
      modulePath,
      statement,
      traversal,
      resolving,
    )
  }
  return enumerateLocalNames(
    subpath,
    packagePath,
    statement,
    bindings,
    traversal,
    resolving,
  )
}

function enumerateStar(
  subpath: string,
  packagePath: string,
  statement: ExportNode,
  explicitNames: Set<string>,
  traversal: ExportTraversal,
  resolving: Set<string>,
): ExportInfo[] {
  const modulePath = stringValue(statement.source)
  if (!modulePath) {
    throw new Error(`Unsupported export-star syntax in ${packagePath}.`)
  }
  const destination = resolveRelative(packagePath, modulePath)
  const namespaceName = nodeName(statement.exported)
  if (namespaceName) {
    return [
      namespaceContract(
        subpath,
        namespaceName,
        destination,
        statement.exportKind === 'type' ? 'type' : 'value',
        traversal,
      ),
    ]
  }
  return enumerateExports(subpath, destination, traversal, resolving)
    .filter(item => item.name !== 'default' && !explicitNames.has(item.name))
    .map(item => ({
      __proto__: null,
      ...item,
      kind: statement.exportKind === 'type' ? 'type' : item.kind,
    }))
}

function enumerateDeclaration(
  subpath: string,
  packagePath: string,
  declaration: ExportNode,
  kind: 'type' | 'value',
  traversal: ExportTraversal,
): ExportInfo[] {
  const items =
    declaration.type === 'VariableDeclaration'
      ? nodeArray(declaration.declarations)
      : [declaration]
  return items.map(item => {
    const name = nodeName(item.id)
    if (!name) {
      throw new Error(`Unsupported exported declaration in ${packagePath}.`)
    }
    return declarationExport(
      subpath,
      name,
      item,
      packagePath,
      traversal.sources.get(packagePath)!.source,
      declarationKind(item, kind),
      declaration.type === 'VariableDeclaration'
        ? `${String(declaration.kind ?? 'const')} `
        : '',
    )
  })
}

function enumerateNamedSource(
  subpath: string,
  packagePath: string,
  modulePath: string,
  statement: ExportNode,
  traversal: ExportTraversal,
  resolving: Set<string>,
): ExportInfo[] {
  const destination = modulePath.startsWith('.')
    ? resolveRelative(packagePath, modulePath)
    : undefined
  const kind = statement.exportKind === 'type' ? 'type' : 'value'
  const output: ExportInfo[] = []
  for (const specifier of nodeArray(statement.specifiers)) {
    const localName = nodeName(specifier.local)
    const name = nodeName(specifier.exported) ?? localName
    if (!name || !localName) {
      throw new Error(`Unsupported named export in ${packagePath}.`)
    }
    const exportKind =
      kind === 'type' || specifier.exportKind === 'type' ? 'type' : 'value'
    if (!destination) {
      output.push(externalContract(subpath, name, modulePath, exportKind))
      continue
    }
    const found = resolveNamedExport(
      subpath,
      destination,
      localName,
      traversal,
      new Set(resolving),
      exportKind,
    )
    if (!found) {
      throw new Error(
        `Unresolved public export ${name} in ${packagePath} from ${destination}.`,
      )
    }
    output.push({
      ...found,
      subpath,
      name,
      kind: exportKind === 'type' ? 'type' : found.kind,
    })
  }
  return output
}

function enumerateLocalNames(
  subpath: string,
  packagePath: string,
  statement: ExportNode,
  bindings: ReturnType<typeof moduleBindings>,
  traversal: ExportTraversal,
  resolving: Set<string>,
): ExportInfo[] {
  const output: ExportInfo[] = []
  for (const specifier of nodeArray(statement.specifiers)) {
    const localName = nodeName(specifier.local)
    const name = nodeName(specifier.exported) ?? localName
    if (!name || !localName) {
      throw new Error(`Unsupported local export in ${packagePath}.`)
    }
    const direct = bindings.declarations.get(localName)
    const kind =
      statement.exportKind === 'type' || specifier.exportKind === 'type'
        ? 'type'
        : 'value'
    if (direct) {
      output.push(
        declarationExport(
          subpath,
          name,
          direct,
          packagePath,
          traversal.sources.get(packagePath)!.source,
          declarationKind(direct, kind),
        ),
      )
      continue
    }
    const imported = bindings.imports.get(localName)
    const found =
      imported &&
      resolveNamedExport(
        subpath,
        packagePath,
        name,
        traversal,
        new Set(resolving),
        kind,
      )
    if (!found) {
      throw new Error(`Unresolved public export ${name} in ${packagePath}.`)
    }
    output.push({
      ...found,
      subpath,
      name,
      kind: kind === 'type' ? 'type' : found.kind,
    })
  }
  return output
}

function deduplicateExports(exports: readonly ExportInfo[]): ExportInfo[] {
  const unique = new Map<string, ExportInfo>()
  for (const item of exports) {
    const key = `${item.subpath}\0${item.name}`
    const existing = unique.get(key)
    if (!existing) {
      unique.set(key, item)
      continue
    }
    if (existing.packagePath !== item.packagePath) {
      throw new Error(
        `Ambiguous public export ${item.name} in ${item.subpath} from ${existing.packagePath} and ${item.packagePath}.`,
      )
    }
    const signatures = new Set(
      [existing.signature, item.signature].filter(Boolean),
    )
    unique.set(key, {
      ...item,
      description: existing.description || item.description,
      example: existing.example || item.example,
      signature: [...signatures].join('\n'),
    })
  }
  return [...unique.values()].toSorted(
    (a, b) => compareStr(a.subpath, b.subpath) || compareStr(a.name, b.name),
  )
}
