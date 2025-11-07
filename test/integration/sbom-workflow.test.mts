/**
 * @fileoverview Integration test for SBOM (Software Bill of Materials) workflows.
 * Tests SBOM upload, retrieval, and analysis flows.
 */

import { describe, expect, it } from 'vitest'
import nock from 'nock'

import {
  createTestClient,
  setupTestEnvironment,
} from '../utils/environment.mts'

describe('Integration - SBOM Workflow', () => {
  setupTestEnvironment()

  it('should upload and retrieve SBOM', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    const sbomContent = {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      version: 1,
      components: [
        {
          type: 'library',
          name: 'express',
          version: '4.18.2',
          purl: 'pkg:npm/express@4.18.2',
        },
        {
          type: 'library',
          name: 'lodash',
          version: '4.17.21',
          purl: 'pkg:npm/lodash@4.17.21',
        },
      ],
    }

    // Mock SBOM upload
    nock('https://api.socket.dev')
      .post('/v0/sbom/upload', body => {
        return body.includes('express') && body.includes('lodash')
      })
      .reply(200, {
        status: 'success',
        data: {
          id: 'sbom-789',
          upload_time: '2024-01-15T10:00:00Z',
          component_count: 2,
        },
      })

    // Mock SBOM retrieval
    nock('https://api.socket.dev')
      .get('/v0/sbom/sbom-789')
      .reply(200, {
        status: 'success',
        data: {
          id: 'sbom-789',
          content: sbomContent,
          upload_time: '2024-01-15T10:00:00Z',
        },
      })

    // Mock SBOM analysis
    nock('https://api.socket.dev')
      .get('/v0/sbom/sbom-789/analysis')
      .reply(200, {
        status: 'success',
        data: {
          vulnerabilities: {
            critical: 0,
            high: 1,
            medium: 3,
            low: 5,
          },
          supply_chain_risk: 'medium',
          total_components: 2,
        },
      })

    // Execute workflow
    const uploadResult = await client.uploadSBOM(JSON.stringify(sbomContent))
    expect(uploadResult.id).toBe('sbom-789')
    expect(uploadResult.component_count).toBe(2)

    const retrieved = await client.getSBOM('sbom-789')
    expect(retrieved.id).toBe('sbom-789')
    expect(retrieved.content.components).toHaveLength(2)

    const analysis = await client.analyzeSBOM('sbom-789')
    expect(analysis.total_components).toBe(2)
    expect(analysis.vulnerabilities.high).toBe(1)
    expect(analysis.supply_chain_risk).toBe('medium')
  })

  it('should compare two SBOMs', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    // Mock SBOM comparison
    nock('https://api.socket.dev')
      .post('/v0/sbom/compare', {
        sbom1_id: 'sbom-old',
        sbom2_id: 'sbom-new',
      })
      .reply(200, {
        status: 'success',
        data: {
          added: [
            {
              name: 'axios',
              version: '1.6.0',
              purl: 'pkg:npm/axios@1.6.0',
            },
          ],
          removed: [
            {
              name: 'request',
              version: '2.88.2',
              purl: 'pkg:npm/request@2.88.2',
            },
          ],
          updated: [
            {
              name: 'lodash',
              old_version: '4.17.20',
              new_version: '4.17.21',
              purl: 'pkg:npm/lodash@4.17.21',
            },
          ],
          risk_delta: {
            vulnerabilities_added: 0,
            vulnerabilities_removed: 2,
            risk_change: 'improved',
          },
        },
      })

    const comparison = await client.compareSBOMs('sbom-old', 'sbom-new')

    expect(comparison.added).toHaveLength(1)
    expect(comparison.added[0].name).toBe('axios')
    expect(comparison.removed).toHaveLength(1)
    expect(comparison.removed[0].name).toBe('request')
    expect(comparison.updated).toHaveLength(1)
    expect(comparison.risk_delta.risk_change).toBe('improved')
  })

  // Note: generateSBOMFromPackageJson is a placeholder method not yet implemented
  // This test demonstrates the desired API for future SBOM generation features
  it.skip('should generate SBOM from package.json', async () => {
    const client = createTestClient('test-api-token', { retries: 0 })

    const packageJson = {
      name: 'my-app',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.2',
        lodash: '^4.17.21',
      },
      devDependencies: {
        vitest: '^1.0.0',
      },
    }

    // Mock SBOM generation from package.json
    nock('https://api.socket.dev')
      .post('/v0/sbom/generate', body => {
        return body.includes('express') && body.includes('my-app')
      })
      .reply(200, {
        status: 'success',
        data: {
          id: 'sbom-generated-123',
          bomFormat: 'CycloneDX',
          specVersion: '1.4',
          components: [
            {
              type: 'library',
              name: 'express',
              version: '4.18.2',
              purl: 'pkg:npm/express@4.18.2',
            },
            {
              type: 'library',
              name: 'lodash',
              version: '4.17.21',
              purl: 'pkg:npm/lodash@4.17.21',
            },
          ],
          metadata: {
            source: 'package.json',
            generated_at: '2024-01-15T10:00:00Z',
          },
        },
      })

    // TODO: Implement this method in the SDK
    // const generated = await client.generateSBOMFromPackageJson(
    //   JSON.stringify(packageJson),
    // )
    //
    // expect(generated.id).toBe('sbom-generated-123')
    // expect(generated.components).toHaveLength(2)
    // expect(generated.metadata.source).toBe('package.json')
    // expect(generated.bomFormat).toBe('CycloneDX')
  })
})
