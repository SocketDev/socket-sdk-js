/**
 * Example: Using Socket SDK quota utilities (CommonJS version)
 *
 * This example demonstrates how to use the quota utility functions
 * to check API costs and permissions before making SDK calls.
 */

const {
  calculateTotalQuotaCost,
  getMethodsByQuotaCost,
  getQuotaCost,
  getQuotaUsageSummary,
  getRequiredPermissions,
  hasQuotaForMethods,
} = require('../dist/index.js')

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
    try {
      const cost = getQuotaCost(method)
      const permissions = getRequiredPermissions(method)
      console.log(
        `  ${method}: ${cost} units, permissions: [${permissions.join(', ') || 'none'}]`,
      )
    } catch (error) {
      console.log(`  ${method}: Error - ${error.message}`)
    }
  })

  // 2. Calculate total cost for multiple operations
  console.log('\n💰 Total Cost Calculation:')
  const plannedOperations = [
    'batchPackageFetch',
    'getOrgAnalytics',
    'uploadManifestFiles',
  ]
  try {
    const totalCost = calculateTotalQuotaCost(plannedOperations)
    console.log(`  Operations: ${plannedOperations.join(', ')}`)
    console.log(`  Total cost: ${totalCost} units`)

    // 3. Check if user has sufficient quota
    console.log('\n✅ Quota Sufficiency Check:')
    const availableQuota = 150
    const canAfford = hasQuotaForMethods(availableQuota, plannedOperations)
    console.log(`  Available quota: ${availableQuota} units`)
    console.log(`  Can afford operations: ${canAfford ? 'Yes' : 'No'}`)
  } catch (error) {
    console.log(`  Error calculating costs: ${error.message}`)
  }

  // 4. Find methods by quota cost
  console.log('\n🎯 Methods by Cost Level:')
  try {
    console.log('  Free methods (0 units):')
    const freeMethods = getMethodsByQuotaCost(0)
    freeMethods.slice(0, 5).forEach(method => {
      console.log(`    - ${method}`)
    })
    console.log(`    ... and ${freeMethods.length - 5} more`)

    console.log('  High-cost methods (100 units):')
    const highCostMethods = getMethodsByQuotaCost(100)
    highCostMethods.forEach(method => {
      console.log(`    - ${method}`)
    })
  } catch (error) {
    console.log(`  Error getting methods by cost: ${error.message}`)
  }

  // 5. Get quota usage summary
  console.log('\n📋 Quota Usage Summary:')
  try {
    const summary = getQuotaUsageSummary()
    Object.entries(summary).forEach(([costLevel, methods]) => {
      console.log(`  ${costLevel}: ${methods.length} methods`)
    })
  } catch (error) {
    console.log(`  Error getting usage summary: ${error.message}`)
  }
}

// Run the demonstration
demonstrateQuotaUtils()
