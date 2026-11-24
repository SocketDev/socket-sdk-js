import path from 'node:path'

import { compareStr } from '@socketsecurity/lib-stable/sorts/strings'

import { parseTypeScript } from '../generate-strict-types-lib.mts'
import { extractClassSignature, isGeneratedApiDeclaration } from './lib.mts'
import {
  extractDeclarationDocumentation,
  extractDeclarationSignature,
} from './signatures.mts'
import type { AstNode } from '../generate-strict-types-lib.mts'

export type ExportNode = AstNode

export interface PackageExportTarget {
  readonly subpath: string
  readonly target: string | undefined
}

export interface ParsedExportSource {
  readonly source: string
  readonly statements: ExportNode[]
}

export interface ExportTraversal {
  readonly sources: Map<string, ParsedExportSource>
}

export interface ImportBinding {
  readonly modulePath: string
  readonly imported: string
  readonly kind: 'type' | 'value'
}

type DiscoverModulesOptions = {
  readonly visiting?: Set<string> | undefined
}

type DeclarationExportOptions = {
  readonly kind: 'value' | 'type'
  readonly prefix?: string | undefined
}

export function moduleBindings(statements: readonly ExportNode[]): {
  declarations: Map<string, ExportNode>
  imports: Map<string, ImportBinding>
} {
  const declarations = new Map<string, ExportNode>()
  const imports = new Map<string, ImportBinding>()
  for (const statement of statements) {
    addImportBindings(statement, imports)
    addDeclarationBindings(statement, declarations)
  }
  return { declarations, imports }
}

function addImportBindings(
  statement: ExportNode,
  imports: Map<string, ImportBinding>,
): void {
  if (statement.type !== 'ImportDeclaration') {
    return
  }
  const modulePath = stringValue(statement['source'])
  if (!modulePath) {
    return
  }
  for (const specifier of nodeArray(statement['specifiers'])) {
    const localName = nodeName(specifier['local'])
    const imported =
      specifier.type === 'ImportDefaultSpecifier'
        ? 'default'
        : specifier.type === 'ImportNamespaceSpecifier'
          ? '*'
          : nodeName(specifier['imported'])
    if (localName && imported) {
      imports.set(localName, {
        modulePath,
        imported,
        kind:
          statement['importKind'] === 'type' ||
          specifier['importKind'] === 'type'
            ? 'type'
            : 'value',
      })
    }
  }
}

function addDeclarationBindings(
  statement: ExportNode,
  declarations: Map<string, ExportNode>,
): void {
  const declaration =
    statement.type === 'ExportDefaultDeclaration' ||
    statement.type === 'ExportNamedDeclaration'
      ? nodeOf(statement.declaration)
      : statement
  if (!declaration) {
    return
  }
  if (declaration.type === 'VariableDeclaration') {
    for (const item of nodeArray(declaration['declarations'])) {
      const name = nodeName(item.id)
      if (name) {
        declarations.set(name, item)
      }
    }
  }
  const name = nodeName(declaration.id)
  if (name) {
    declarations.set(name, declaration)
  }
}

export function packageExportTargets(
  exportsField: unknown,
): PackageExportTarget[] {
  if (!isNode(exportsField)) {
    throw new Error('package.json exports must be an object.')
  }
  const targets: PackageExportTarget[] = []
  for (const [subpath, value] of Object.entries(exportsField)) {
    const target = selectTarget(value)
    if (subpath === './package.json') {
      targets.push({ subpath, target: undefined })
    } else if (target) {
      targets.push({ subpath, target })
    } else {
      throw new Error(
        `No source or declaration target for package export ${subpath}.`,
      )
    }
  }
  return targets.toSorted((a, b) => compareStr(a.subpath, b.subpath))
}

export function normalizeTarget(target: string): string {
  const normalized = path.posix.normalize(target.replace(/^\.\//, ''))
  if (normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`Package export target escapes package root: ${target}.`)
  }
  return normalized
}

export function resolveRelative(from: string, target: string): string {
  if (!target.startsWith('.')) {
    throw new Error(`Unsupported external star export ${target} from ${from}.`)
  }
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(from), target),
  )
  if (resolved.startsWith('../')) {
    throw new Error(`Public export escapes package root: ${from} -> ${target}.`)
  }
  return resolved
}

export function discoverModules(
  packagePath: string,
  readSource: (packagePath: string) => string,
  traversal: ExportTraversal,
  options: DiscoverModulesOptions = {},
): void {
  const opts = { __proto__: null, ...options }
  const visiting = opts.visiting ?? new Set<string>()
  if (traversal.sources.has(packagePath) || visiting.has(packagePath)) {
    return
  }
  readParsedSource(packagePath, readSource, traversal)
  visiting.add(packagePath)
  const parsed = traversal.sources.get(packagePath)
  for (const destination of moduleDependencies(
    parsed?.statements ?? [],
    packagePath,
  )) {
    discoverModules(destination, readSource, traversal, { visiting })
  }
  visiting.delete(packagePath)
}

function moduleDependencies(
  statements: readonly ExportNode[],
  packagePath: string,
): string[] {
  const importedNames = new Set<string>()
  const dependencies = new Set<string>()
  for (const statement of statements) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const declaration = nodeOf(statement.declaration)
      const localName = declaration && nodeName(declaration)
      if (declaration?.type === 'Identifier' && localName) {
        importedNames.add(localName)
      }
    }
    if (statement.type === 'ExportAllDeclaration') {
      addRelativeDependency(
        dependencies,
        packagePath,
        stringValue(statement['source']),
      )
    }
    if (statement.type === 'ExportNamedDeclaration') {
      const source = stringValue(statement['source'])
      if (source) {
        addRelativeDependency(dependencies, packagePath, source)
      } else {
        for (const specifier of nodeArray(statement['specifiers'])) {
          const name = nodeName(specifier['local'])
          if (name) {
            importedNames.add(name)
          }
        }
      }
    }
  }
  for (const statement of statements) {
    if (statement.type !== 'ImportDeclaration') {
      continue
    }
    const source = stringValue(statement['source'])
    const hasUsedBinding = nodeArray(statement['specifiers']).some(
      specifier => {
        const name = nodeName(specifier['local'])
        return Boolean(name && importedNames.has(name))
      },
    )
    if (hasUsedBinding) {
      addRelativeDependency(dependencies, packagePath, source)
    }
  }
  return [...dependencies]
}

function addRelativeDependency(
  dependencies: Set<string>,
  packagePath: string,
  source: string | undefined,
): void {
  if (source?.startsWith('.') && !source.endsWith('.json')) {
    dependencies.add(resolveRelative(packagePath, source))
  }
}

export function readParsedSource(
  packagePath: string,
  readSource: (packagePath: string) => string,
  traversal: ExportTraversal,
): void {
  if (traversal.sources.has(packagePath)) {
    return
  }
  let source: string
  try {
    source = readSource(packagePath)
  } catch (error) {
    throw new Error(`Cannot read public entry ${packagePath}: ${String(error)}`)
  }
  try {
    const parsed = parseTypeScript(source)
    traversal.sources.set(packagePath, {
      source,
      statements: nodeArray(parsed.body),
    })
  } catch (error) {
    throw new Error(
      `Cannot parse public entry ${packagePath}: ${String(error)}`,
    )
  }
}

export function exportedNames(statements: readonly ExportNode[]): Set<string> {
  const names = new Set<string>()
  for (const statement of statements) {
    if (statement.type === 'ExportDefaultDeclaration') {
      names.add('default')
      continue
    }
    if (statement.type === 'ExportAllDeclaration') {
      const namespaceName = nodeName(statement['exported'])
      if (namespaceName) {
        names.add(namespaceName)
      }
      continue
    }
    if (statement.type !== 'ExportNamedDeclaration') {
      continue
    }
    const declaration = nodeOf(statement.declaration)
    for (const item of declaration?.type === 'VariableDeclaration'
      ? nodeArray(declaration['declarations'])
      : declaration
        ? [declaration]
        : []) {
      const name = nodeName(item.id)
      if (name) {
        names.add(name)
      }
    }
    for (const specifier of nodeArray(statement['specifiers'])) {
      const name =
        nodeName(specifier['exported']) ?? nodeName(specifier['local'])
      if (name) {
        names.add(name)
      }
    }
  }
  return names
}

export function isNode(value: unknown): value is ExportNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function nodeOf(value: unknown): ExportNode | undefined {
  return isNode(value) ? value : undefined
}

export function nodeArray(value: unknown): ExportNode[] {
  return Array.isArray(value) ? value.filter(isNode) : []
}

export function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

export function lineNumber(node: ExportNode): number | undefined {
  const location = nodeOf(node['loc'])
  return numberValue(nodeOf(location?.['start'])?.['line'])
}

export function stringValue(value: unknown): string | undefined {
  const node = nodeOf(value)
  return typeof node?.['value'] === 'string' ? node['value'] : undefined
}

export function nodeName(value: unknown): string | undefined {
  const node = nodeOf(value)
  const actual = node?.['name'] ?? node?.['value']
  return typeof actual === 'string' ? actual : undefined
}

export interface ExportInfo {
  readonly subpath: string
  readonly name: string
  readonly kind: 'value' | 'type'
  readonly packagePath: string
  readonly line: number
  readonly signature: string
  readonly description: string
  readonly example: string
}

export function declarationKind(
  declaration: ExportNode,
  defaultKind: 'value' | 'type',
): 'value' | 'type' {
  return declaration.type === 'TSInterfaceDeclaration' ||
    declaration.type === 'TSTypeAliasDeclaration'
    ? 'type'
    : defaultKind
}

export function externalContract(
  subpath: string,
  name: string,
  modulePath: string,
  kind: 'value' | 'type',
): ExportInfo {
  return {
    subpath,
    name,
    kind,
    packagePath: modulePath,
    line: 1,
    signature: `External contract: ${modulePath}`,
    description: `Re-exported from external package \`${modulePath}\`.`,
    example: '',
  }
}

export function namespaceContract(
  subpath: string,
  name: string,
  packagePath: string,
  kind: 'type' | 'value',
  traversal: ExportTraversal,
): ExportInfo {
  if (!traversal.sources.has(packagePath)) {
    throw new Error(
      `Cannot read public entry ${packagePath}: source was not discovered.`,
    )
  }
  return {
    subpath,
    name,
    kind,
    packagePath,
    line: 1,
    signature: `typeof import('./${packagePath}')`,
    description: `Namespace export of local module \`${packagePath}\`.`,
    example: '',
  }
}

export function declarationExport(
  subpath: string,
  name: string,
  declaration: ExportNode,
  packagePath: string,
  source: string,
  options: DeclarationExportOptions,
): ExportInfo {
  const opts = { __proto__: null, ...options }
  const { kind, prefix = '' } = opts
  const start = typeof declaration.start === 'number' ? declaration.start : 0
  const initializer = nodeOf(declaration['init'])
  const signature =
    declaration.type === 'ClassDeclaration' && name !== 'SocketSdk'
      ? extractClassSignature(declaration, source, extractDeclarationSignature)
      : extractDeclarationSignature(declaration, source)
  const declarationSignature =
    prefix && !signature.startsWith('function ')
      ? `${prefix}${signature}`
      : signature
  return {
    subpath,
    name,
    kind,
    packagePath,
    line:
      lineNumber(declaration) ?? source.slice(0, start).split(/\r?\n/).length,
    signature: isGeneratedApiDeclaration(packagePath)
      ? ''
      : declaration.type === 'VariableDeclarator' &&
          initializer?.type === 'ObjectExpression'
        ? `${prefix}${name} = { … }`
        : declarationSignature,
    ...extractDeclarationDocumentation(declaration, source),
  }
}

function selectTarget(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const conditions = nodeOf(value)
  if (!conditions) {
    return undefined
  }
  for (const condition of ['source', 'types', 'typings']) {
    const target = conditions[condition]
    if (typeof target === 'string') {
      return target
    }
  }
  const candidates = Object.values(conditions)
  for (let i = 0, { length } = candidates; i < length; i += 1) {
    const candidate = candidates[i]
    if (candidate === undefined) {
      continue
    }
    const nested = selectTarget(candidate)
    if (nested) {
      return nested
    }
  }
  return undefined
}
