#!/usr/bin/env node
/**
 * @fileoverview SDK generation script.
 * Orchestrates the complete SDK generation process:
 * 1. Fetches and formats OpenAPI JSON
 * 2. Generates TypeScript types from OpenAPI
 * 3. Generates strict types from OpenAPI
 *
 * Usage:
 *   node scripts/generate-sdk.mts
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import MagicString from 'magic-string'

import { httpJson } from '@socketsecurity/lib/http-request'
import { getDefaultLogger } from '@socketsecurity/lib/logger'
import { spawn } from '@socketsecurity/lib/spawn'

import { getRootPath } from './utils/path-helpers.mts'
import { runCommand } from './utils/run-command.mts'

// CJS/ESM interop: @babel/traverse wraps the function under .default in ESM
const traverse = (_traverse as unknown as { default: typeof _traverse }).default

const OPENAPI_URL = 'https://api.socket.dev/v0/openapi'

const rootPath = getRootPath(import.meta.url)
const openApiPath = path.resolve(rootPath, 'openapi.json')
const typesPath = path.resolve(rootPath, 'types/api.d.ts')

// Initialize logger
const logger = getDefaultLogger()

async function fetchOpenApi(): Promise<void> {
  try {
    const data = await httpJson(OPENAPI_URL)
    await fs.writeFile(openApiPath, JSON.stringify(data, null, 2), 'utf8')
    logger.log(`Downloaded from ${OPENAPI_URL}`)
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    logger.error(`Failed to fetch OpenAPI definition from ${OPENAPI_URL}`)
    logger.error(`Network error: ${error.message}`)
    logger.info(
      'Ensure the API endpoint is accessible and try again. If the issue persists, check your network connection.',
    )
    throw e
  }
}

async function generateStrictTypes(): Promise<void> {
  await spawn('node', ['scripts/generate-strict-types.mts'], {
    cwd: rootPath,
    stdio: 'inherit',
  })
  const exitCode = await runCommand('pnpm', [
    'exec',
    'oxfmt',
    'src/types-strict.ts',
  ])
  if (exitCode !== 0) {
    throw new Error(`Formatting strict types failed with exit code ${exitCode}`)
  }
}

async function generateTypes(): Promise<void> {
  await spawn('node', ['scripts/generate-types.mts'], {
    cwd: rootPath,
    stdio: 'inherit',
  })
  // Fix array syntax after writing to disk
  await fixArraySyntax(typesPath)
  // Add SDK v3 method name aliases
  await addSdkMethodAliases(typesPath)
  // Format generated types
  const exitCode = await runCommand('pnpm', ['exec', 'oxfmt', 'types/api.d.ts'])
  if (exitCode !== 0) {
    throw new Error(`Formatting types failed with exit code ${exitCode}`)
  }
}

/**
 * Adds SDK v3 method name aliases to the operations interface.
 * These aliases map the new SDK method names to their underlying OpenAPI operation names.
 */
async function addSdkMethodAliases(filePath: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf8')

  // Find the closing brace of the operations interface
  const operationsInterfaceEnd = content.lastIndexOf('\n}')

  if (operationsInterfaceEnd === -1) {
    logger.error('Could not find operations interface closing brace')
    return
  }

  const aliases = `  // SDK v3 method name aliases for TypeScript compatibility.
  // These map the new SDK method names to their underlying OpenAPI operation names.
  listOrganizations: operations['getOrganizations']
  listRepositories: operations['getOrgRepoList']
  createRepository: operations['createOrgRepo']
  deleteRepository: operations['deleteOrgRepo']
  updateRepository: operations['updateOrgRepo']
  getRepository: operations['getOrgRepo']
  listFullScans: operations['getOrgFullScanList']
  createFullScan: operations['CreateOrgFullScan']
  getFullScan: operations['getOrgFullScan']
  streamFullScan: operations['getOrgFullScan']
  deleteFullScan: operations['deleteOrgFullScan']
  getFullScanMetadata: operations['getOrgFullScanMetadata']
`

  const updated =
    content.slice(0, operationsInterfaceEnd) +
    aliases +
    content.slice(operationsInterfaceEnd)
  await fs.writeFile(filePath, updated, 'utf8')
  logger.log('Added SDK v3 method name aliases')
}

/**
 * Fixes array syntax to comply with ESLint array-simple rules.
 * Simple types (string, number, boolean) use T[] syntax.
 * Complex types use Array<T> syntax.
 */
async function fixArraySyntax(filePath: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf8')
  const magicString = new MagicString(content)

  // Parse the TypeScript file
  const ast = parse(content, {
    sourceType: 'module',
    plugins: ['typescript'],
  })

  // Helper to determine if a type is simple
  const isSimpleType = (node: t.Node): boolean => {
    // Check for keyword types
    if (
      t.isTSStringKeyword(node) ||
      t.isTSNumberKeyword(node) ||
      t.isTSBooleanKeyword(node)
    ) {
      return true
    }

    // Check for type references to simple types
    if (t.isTSTypeReference(node)) {
      if (t.isIdentifier(node.typeName)) {
        const name = node.typeName.name
        return name === 'string' || name === 'number' || name === 'boolean'
      }
    }

    // Arrays of simple types are also considered simple for nested array purposes
    if (t.isTSArrayType(node)) {
      return isSimpleType(node.elementType)
    }

    return false
  }

  let transformCount = 0
  let skipCount = 0

  // Traverse the AST to find array types
  // Cast needed due to @babel/types version mismatch between parser and traverse
  traverse(ast as Parameters<typeof traverse>[0], {
    TSArrayType(path) {
      const node = path.node
      const elementType = node.elementType

      // Check if this is a simple type array
      if (isSimpleType(elementType as unknown as t.Node)) {
        // For simple types (e.g., string[], number[])
        // we keep them as-is
        return
      }

      // For complex types, we need to change T[] to Array<T>
      const start = node.start
      const end = node.end

      if (start == null || end == null) {
        return
      }

      // Check elementType positions before accessing
      if (elementType.start == null || elementType.end == null) {
        return
      }

      // Get the text of the element type
      const elementText = content.slice(elementType.start, elementType.end)

      try {
        // Use magic-string to replace T[] with Array<T>
        magicString.overwrite(start, end, `Array<${elementText}>`)
        transformCount++
      } catch {
        // Skip if already transformed (overlapping transformations)
        skipCount++
      }
    },
  })

  logger.log(`Found ${transformCount + skipCount} complex arrays to transform`)
  logger.log(`Transformed ${transformCount}, skipped ${skipCount} (overlaps)`)

  if (transformCount > 0) {
    const transformed = magicString.toString()

    // Verify transformations were actually applied
    const objectArrayCount = (transformed.match(/\}\[\]/g) || []).length
    const arrayGenericCount = (transformed.match(/Array</g) || []).length
    logger.log(
      `Final check: ${objectArrayCount} object arrays with }[], ${arrayGenericCount} Array< generics`,
    )

    await fs.writeFile(filePath, transformed, 'utf8')
  }
}

async function main(): Promise<void> {
  try {
    logger.group('Generating SDK from OpenAPI…')

    // Step 1: Fetch and format OpenAPI JSON
    logger.log('1. Fetching OpenAPI definition…')
    await fetchOpenApi()

    // Step 2: Generate types
    logger.log('2. Generating TypeScript types…')
    await generateTypes()

    // Step 3: Generate strict types
    logger.log('3. Generating strict types…')
    await generateStrictTypes()

    logger.groupEnd()
    logger.log('SDK generation complete')
  } catch (e) {
    logger.groupEnd()
    logger.error(
      'SDK generation failed:',
      e instanceof Error ? e.message : String(e),
    )
    process.exitCode = 1
  }
}

main().catch((e: unknown) => {
  logger.error(e)
  process.exitCode = 1
})
