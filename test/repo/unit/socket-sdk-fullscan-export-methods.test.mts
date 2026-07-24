/**
 * @file Tests for the full-scan export and repo-HEAD diff Socket SDK methods
 *   added for SURF-195 API parity (getOrgFullScanCsv, getOrgFullScanPdf,
 *   createOrgRepoDiff).
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../../utils/environment.mts'

describe('Socket SDK - Full-scan export & repo diff methods (SURF-195)', () => {
  const getClient = setupTestClient('test-api-token', { retries: 0 })

  describe('getOrgFullScanCsv', () => {
    it('should return raw CSV text', async () => {
      const csv = 'purl,severity\npkg:npm/lodash@4.17.20,high\n'

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans/scan-1/format/csv')
        .query({ include_license_details: 'true' })
        .reply(200, csv, { 'content-type': 'text/csv' })

      const result = await getClient().getOrgFullScanCsv('test-org', 'scan-1', {
        include_license_details: true,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(csv)
      }
    })

    it('should forward a filters body and query params', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans/scan-1/format/csv', {
          filters: [{ id: 'severity', value: ['high'] }],
        })
        .query({
          include_license_details: 'true',
          include_alert_priority_details: 'true',
        })
        .reply(200, 'a,b\n1,2\n', { 'content-type': 'text/csv' })

      const result = await getClient().getOrgFullScanCsv('test-org', 'scan-1', {
        include_license_details: true,
        include_alert_priority_details: true,
        filters: [{ id: 'severity', value: ['high'] }],
      })

      expect(result.success).toBe(true)
    })

    it('should handle error responses for getOrgFullScanCsv', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans/scan-1/format/csv')
        .query(true)
        .reply(404, { error: { message: 'Scan not found' } })

      const result = await getClient().getOrgFullScanCsv('test-org', 'scan-1', {
        include_license_details: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('getOrgFullScanPdf', () => {
    it('should return raw PDF bytes as a Buffer', async () => {
      const pdfBytes = Buffer.from('%PDF-1.7\n...binary...', 'utf8')

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans/scan-1/format/pdf')
        .query({ include_license_details: 'true' })
        .reply(200, pdfBytes, { 'content-type': 'application/pdf' })

      const result = await getClient().getOrgFullScanPdf('test-org', 'scan-1', {
        include_license_details: true,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(Buffer.isBuffer(result.data)).toBe(true)
        expect(result.data.equals(pdfBytes)).toBe(true)
      }
    })

    it('should handle error responses for getOrgFullScanPdf', async () => {
      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/full-scans/scan-1/format/pdf')
        .query(true)
        .reply(403, { error: { message: 'Insufficient permissions' } })

      const result = await getClient().getOrgFullScanPdf('test-org', 'scan-1', {
        include_license_details: true,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('createOrgRepoDiff', () => {
    let tempDir: string

    it('should upload manifest files and return diff scan metadata', async () => {
      tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-sdk-repo-diff-'))
      const manifestPath = path.join(tempDir, 'package.json')
      writeFileSync(
        manifestPath,
        JSON.stringify({ name: 'x', version: '1.0.0' }),
      )

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/diff-scans/from-repo/test-repo')
        .query(true)
        .reply(201, {
          diff_scan: { id: 'diff-1' },
          full_scan: { id: 'scan-99' },
        })

      try {
        const result = await getClient().createOrgRepoDiff(
          'test-org',
          'test-repo',
          [manifestPath],
          { branch: 'main', commit_hash: 'abc123' },
        )

        expect(result.success).toBe(true)
        if (result.success) {
          const data = result.data as unknown as {
            diff_scan: { id: string }
          }
          expect(data.diff_scan.id).toBe('diff-1')
        }
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should fail without hitting the API when no readable files exist', async () => {
      const result = await getClient().createOrgRepoDiff(
        'test-org',
        'test-repo',
        ['/does/not/exist/package.json'],
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.error).toBe('No readable manifest files found')
      }
    })

    it('should handle error responses for createOrgRepoDiff', async () => {
      tempDir = mkdtempSync(path.join(os.tmpdir(), 'socket-sdk-repo-diff-'))
      const manifestPath = path.join(tempDir, 'package.json')
      writeFileSync(manifestPath, '{}')

      nock('https://api.socket.dev')
        .post('/v0/orgs/test-org/diff-scans/from-repo/missing-repo')
        .query(true)
        .reply(404, { error: { message: 'No repository found' } })

      try {
        const result = await getClient().createOrgRepoDiff(
          'test-org',
          'missing-repo',
          [manifestPath],
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeDefined()
        }
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })
  })
})
