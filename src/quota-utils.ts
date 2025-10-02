/** @fileoverview Quota utility functions for Socket SDK method cost lookup. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { SocketSdkOperations } from './types'

interface ApiRequirement {
  quota: number
  permissions: string[]
}

interface Requirements {
  api: Record<string, ApiRequirement>
}

let requirements: Requirements | null = null

/**
 * Load requirements.json data with caching.
 * Internal function for lazy loading quota requirements.
 */
function loadRequirements(): Requirements {
  if (requirements) {
    return requirements
  }

  try {
    // Resolve path relative to current working directory
    const requirementsPath = join(process.cwd(), 'requirements.json')
    const data = readFileSync(requirementsPath, 'utf8')
    requirements = JSON.parse(data) as Requirements
    return requirements
  } catch (e) {
    throw new Error('Failed to load "requirements.json"', { cause: e })
  }
}

/**
 * Get quota cost for a specific SDK method.
 * Returns the number of quota units consumed by the method.
 */
export function getQuotaCost(methodName: SocketSdkOperations | string): number {
  const reqs = loadRequirements()
  const requirement = reqs.api[methodName]

  if (!requirement) {
    throw new Error(`Unknown SDK method: "${methodName}"`)
  }

  return requirement.quota
}

/**
 * Get required permissions for a specific SDK method.
 * Returns array of permission strings needed to call the method.
 */
export function getRequiredPermissions(
  methodName: SocketSdkOperations | string,
): string[] {
  const reqs = loadRequirements()
  const requirement = reqs.api[methodName]

  if (!requirement) {
    throw new Error(`Unknown SDK method: "${methodName}"`)
  }

  return [...requirement.permissions]
}

/**
 * Get complete requirement information for a SDK method.
 * Returns both quota cost and required permissions.
 */
export function getMethodRequirements(
  methodName: SocketSdkOperations | string,
): ApiRequirement {
  const reqs = loadRequirements()
  const requirement = reqs.api[methodName]

  if (!requirement) {
    throw new Error(`Unknown SDK method: "${methodName}"`)
  }

  return {
    quota: requirement.quota,
    permissions: [...requirement.permissions],
  }
}

/**
 * Calculate total quota cost for multiple SDK method calls.
 * Returns sum of quota units for all specified methods.
 */
export function calculateTotalQuotaCost(
  methodNames: Array<SocketSdkOperations | string>,
): number {
  return methodNames.reduce((total, methodName) => {
    return total + getQuotaCost(methodName)
  }, 0)
}

/**
 * Get all methods that consume a specific quota amount.
 * Useful for finding high-cost or free operations.
 */
export function getMethodsByQuotaCost(quotaCost: number): string[] {
  const reqs = loadRequirements()

  return Object.entries(reqs.api)
    .filter(([, requirement]) => requirement.quota === quotaCost)
    .map(([methodName]) => methodName)
    .sort()
}

/**
 * Get all methods that require specific permissions.
 * Returns methods that need any of the specified permissions.
 */
export function getMethodsByPermissions(permissions: string[]): string[] {
  const reqs = loadRequirements()

  return Object.entries(reqs.api)
    .filter(([, requirement]) => {
      return permissions.some(permission =>
        requirement.permissions.includes(permission),
      )
    })
    .map(([methodName]) => methodName)
    .sort()
}

/**
 * Check if user has sufficient quota for method calls.
 * Returns true if available quota covers the total cost.
 */
export function hasQuotaForMethods(
  availableQuota: number,
  methodNames: Array<SocketSdkOperations | string>,
): boolean {
  const totalCost = calculateTotalQuotaCost(methodNames)
  return availableQuota >= totalCost
}

/**
 * Get quota usage summary grouped by cost levels.
 * Returns methods categorized by their quota consumption.
 */
export function getQuotaUsageSummary(): Record<string, string[]> {
  const reqs = loadRequirements()
  const summary: Record<string, string[]> = {}

  Object.entries(reqs.api).forEach(([methodName, requirement]) => {
    const costKey = `${requirement.quota} units`

    if (!summary[costKey]) {
      summary[costKey] = []
    }

    summary[costKey].push(methodName)
  })

  // Sort methods within each cost level
  Object.keys(summary).forEach(costKey => {
    summary[costKey]?.sort()
  })

  return summary
}

/**
 * Get all available SDK methods with their requirements.
 * Returns complete mapping of methods to quota and permissions.
 */
export function getAllMethodRequirements(): Record<string, ApiRequirement> {
  const reqs = loadRequirements()
  const result: Record<string, ApiRequirement> = {}

  Object.entries(reqs.api).forEach(([methodName, requirement]) => {
    result[methodName] = {
      quota: requirement.quota,
      permissions: [...requirement.permissions],
    }
  })

  return result
}
