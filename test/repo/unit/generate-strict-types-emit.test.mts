/**
 * @file Strict-type generator dictionary key contract.
 */

import { describe, expect, it } from 'vitest'

import { generateWrapperTypes } from '../../../scripts/repo/generate-strict-types-emit.mts'

describe('generateWrapperTypes', () => {
  it('uses the organization key type for organization dictionaries', () => {
    expect(generateWrapperTypes()).toContain(
      'organizations: Record<OrganizationSlug, OrganizationItem>',
    )
  })
})
