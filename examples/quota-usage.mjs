#!/usr/bin/env node

/**
 * Example: Using Socket SDK quota utilities
 *
 * This example demonstrates how to use the quota utility functions
 * to check API costs and permissions before making SDK calls.
 */

import {
  SocketSdk,
  getQuotaCost,
  getRequiredPermissions,
  calculateTotalQuotaCost,
  hasQuotaForMethods,
  getMethodsByQuotaCost,
  getQuotaUsageSummary,
  getAllMethodRequirements,
} from '../dist/index.js'

// Example usage of quota utilities
function demonstrateQuotaUtils() {
  console.log('🔍 Socket SDK Quota Utilities Demo\n')

  // 1. Check quota cost for individual methods
  console.log('📊 Individual Method Costs:')
  const methods = [
    'batchPackageFetch',
    'getOrgAnalytics',
    'getQuota',
    'uploadManifestFiles',
  ]
  methods.forEach(method => {
    const cost = getQuotaCost(method)
    const permissions = getRequiredPermissions(method)
    console.log(
      `  ${method}: ${cost} units, permissions: [${permissions.join(', ') || 'none'}]`,
    )
  })

  // 2. Calculate total cost for multiple operations
  console.log('\n💰 Total Cost Calculation:')
  const plannedOperations = [
    'batchPackageFetch',
    'getOrgAnalytics',
    'uploadManifestFiles',
  ]
  const totalCost = calculateTotalQuotaCost(plannedOperations)
  console.log(`  Operations: ${plannedOperations.join(', ')}`)
  console.log(`  Total cost: ${totalCost} units`)

  // 3. Check if user has sufficient quota
  console.log('\n✅ Quota Sufficiency Check:')
  const availableQuota = 150
  const canAfford = hasQuotaForMethods(availableQuota, plannedOperations)
  console.log(`  Available quota: ${availableQuota} units`)
  console.log(`  Can afford operations: ${canAfford ? 'Yes' : 'No'}`)

  // 4. Find methods by quota cost
  console.log('\n🎯 Methods by Cost Level:')
  console.log('  Free methods (0 units):')
  getMethodsByQuotaCost(0)
    .slice(0, 5)
    .forEach(method => {
      console.log(`    - ${method}`)
    })
  console.log(`    ... and ${getMethodsByQuotaCost(0).length - 5} more`)

  console.log('  High-cost methods (100 units):')
  getMethodsByQuotaCost(100).forEach(method => {
    console.log(`    - ${method}`)
  })

  // 5. Get quota usage summary
  console.log('\n📋 Quota Usage Summary:')
  const summary = getQuotaUsageSummary()
  Object.entries(summary).forEach(([costLevel, methods]) => {
    console.log(`  ${costLevel}: ${methods.length} methods`)
  })

  // 6. Find methods requiring specific permissions
  console.log('\n🔐 Methods Requiring Package Permissions:')
  const packageMethods = getMethodsByPermissions([
    'packages:list',
    'packages:upload',
  ])
  packageMethods.forEach(method => {
    console.log(`  - ${method}`)
  })
}

// Example of planning API usage with quota management
async function planApiUsageExample() {
  console.log('\n\n🎯 API Usage Planning Example\n')

  const apiToken = process.env.SOCKET_SECURITY_API_KEY
  if (!apiToken) {
    console.log(
      '⚠️  Set SOCKET_SECURITY_API_KEY environment variable to run SDK examples',
    )
    return
  }

  const client = new SocketSdk(apiToken)

  try {
    // Check current quota
    console.log('📊 Checking current quota...')
    const quotaResponse = await client.getQuota()
    if (!quotaResponse.success) {
      console.error('Failed to get quota:', quotaResponse.error)
      return
    }

    const currentQuota = quotaResponse.data.quota || 0
    console.log(`Current quota: ${currentQuota} units`)

    // Plan operations
    const plannedOps = ['batchPackageFetch', 'getOrgAnalytics']
    const estimatedCost = calculateTotalQuotaCost(plannedOps)

    console.log(`\n📋 Planned operations: ${plannedOps.join(', ')}`)
    console.log(`Estimated cost: ${estimatedCost} units`)

    if (hasQuotaForMethods(currentQuota, plannedOps)) {
      console.log('✅ Sufficient quota available')
      console.log(
        `Remaining after operations: ${currentQuota - estimatedCost} units`,
      )
    } else {
      console.log('❌ Insufficient quota')
      console.log('Consider using free alternatives or wait for quota reset')

      // Show free alternatives
      console.log('\n💡 Free alternatives available:')
      getMethodsByQuotaCost(0)
        .slice(0, 10)
        .forEach(method => {
          console.log(`  - ${method}`)
        })
    }
  } catch (error) {
    console.error('Error:', error.message)
  }
}

// Run the demonstrations
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateQuotaUtils()
  await planApiUsageExample()
}
