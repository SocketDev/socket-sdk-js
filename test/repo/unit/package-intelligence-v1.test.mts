/**
 * @file Pure validation for organization package intelligence requests.
 */
import { describe, expect, it } from 'vitest'

import { validatePackageIntelligenceRequest } from '../../../src/package-intelligence-v1.mts'

function bodyWithUtf8Size(size: number): { packages: { purl: string }[] } {
  const packages = Array.from({ length: 100 }, () => ({ purl: 'a' }))
  const emptyBody = JSON.stringify({ packages })
  if (emptyBody === undefined) {
    throw new Error('Could not serialize empty package body')
  }
  let bytesRemaining = size - new TextEncoder().encode(emptyBody).byteLength
  for (
    let index = 0;
    index < packages.length && bytesRemaining > 0;
    index += 1
  ) {
    const doubleByteCharacters = Math.min(2047, Math.floor(bytesRemaining / 2))
    let purl = `a${'é'.repeat(doubleByteCharacters)}`
    bytesRemaining -= doubleByteCharacters * 2
    if (bytesRemaining > 0 && doubleByteCharacters < 2047) {
      purl += 'a'
      bytesRemaining -= 1
    }
    packages[index] = { purl }
  }
  if (bytesRemaining !== 0) {
    throw new Error('Could not construct requested UTF-8 body size')
  }
  return { packages }
}

describe('package intelligence request validation', () => {
  it('accepts one and one hundred package entries', () => {
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: [{ purl: 'not-a-purl' }],
      }),
    ).not.toThrow()
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: Array.from({ length: 100 }, (_, index) => ({
          purl: `package-${index}`,
        })),
      }),
    ).not.toThrow()
  })

  it('rejects empty organizations and package lists outside the schema bounds', () => {
    for (const orgSlug of ['', '  ']) {
      expect(() =>
        validatePackageIntelligenceRequest(orgSlug, {
          packages: [{ purl: 'pkg:npm/example@1.0.0' }],
        }),
      ).toThrow(TypeError)
    }
    for (const packages of [
      [],
      Array.from({ length: 101 }, () => ({ purl: 'pkg:npm/example@1.0.0' })),
    ]) {
      expect(() =>
        validatePackageIntelligenceRequest('example-org', { packages }),
      ).toThrow(TypeError)
    }
  })

  it('uses Unicode code point length for the PURL limit', () => {
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: [{ purl: '💩'.repeat(2048) }],
      }),
    ).not.toThrow()
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: [{ purl: '💩'.repeat(2049) }],
      }),
    ).toThrow(TypeError)
  })

  it('rejects empty and extra request fields without parsing PURL syntax', () => {
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: [{ purl: '' }],
      }),
    ).toThrow(TypeError)
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: [{ purl: 'unrecognized package string', metadata: true }],
      }),
    ).toThrow(TypeError)
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: [{ purl: 'unrecognized package string' }],
        policy: 'override',
      }),
    ).toThrow(TypeError)
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: [
          { purl: 'unrecognized package string' },
          { purl: 'unrecognized package string' },
        ],
      }),
    ).not.toThrow()
  })

  it('accepts a 2048-character PURL and rejects 2049 characters', () => {
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: [{ purl: 'a'.repeat(2048) }],
      }),
    ).not.toThrow()
    expect(() =>
      validatePackageIntelligenceRequest('example-org', {
        packages: [{ purl: 'a'.repeat(2049) }],
      }),
    ).toThrow(TypeError)
  })

  it('enforces the serialized UTF-8 request body limit', () => {
    expect(() =>
      validatePackageIntelligenceRequest(
        'example-org',
        bodyWithUtf8Size(256 * 1024),
      ),
    ).not.toThrow()
    expect(() =>
      validatePackageIntelligenceRequest(
        'example-org',
        bodyWithUtf8Size(256 * 1024 + 1),
      ),
    ).toThrow(TypeError)
  })
})
