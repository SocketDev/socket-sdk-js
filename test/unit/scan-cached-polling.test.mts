/**
 * @file Integration tests for the behind-the-scenes cached+poll behavior of
 *   getDiffScanById and getFullScan. Verifies cached=true is sent by default,
 *   202 Accepted responses are polled to a final 200, and cached:false bypasses
 *   the cache (and the poll) entirely.
 */
import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { setupTestClient } from '../utils/environment.mts'

const BASE = 'https://api.socket.dev'

describe('cached scan polling', () => {
  // A short poll interval keeps the 202 -> 200 tests fast without fake timers.
  const getClient = setupTestClient('test-api-token', {
    pollIntervalMs: 5,
    retries: 0,
  })

  describe('getDiffScanById', () => {
    it('sends cached=true by default and returns the 200 result', async () => {
      const body = { diff_scan: { id: 'diff-1', artifacts: { added: [] } } }
      nock(BASE)
        .get('/v0/orgs/test-org/diff-scans/diff-1?cached=true')
        .reply(200, body)

      const result = await getClient().getDiffScanById('test-org', 'diff-1')

      expect(result.success).toBe(true)
      expect(nock.isDone()).toBe(true)
      if (result.success) {
        expect((result.data as unknown as typeof body).diff_scan.id).toBe(
          'diff-1',
        )
      }
    })

    it('polls a 202 cache miss until the 200 result is ready', async () => {
      const body = { diff_scan: { id: 'diff-1' } }
      nock(BASE)
        .get('/v0/orgs/test-org/diff-scans/diff-1?cached=true')
        .reply(202, { status: 'processing', id: 'diff-1' })
        .get('/v0/orgs/test-org/diff-scans/diff-1?cached=true')
        .reply(200, body)

      const result = await getClient().getDiffScanById('test-org', 'diff-1')

      expect(result.success).toBe(true)
      expect(nock.isDone()).toBe(true)
    })

    it('omits the cached param when explicitly disabled and does not poll', async () => {
      // cached:false drops the param entirely — an absent param reads as false
      // server-side, so the live-compute path is taken without cached=false.
      nock(BASE)
        .get('/v0/orgs/test-org/diff-scans/diff-1?omit_unchanged=true')
        .reply(200, { diff_scan: { id: 'diff-1' } })

      const result = await getClient().getDiffScanById('test-org', 'diff-1', {
        cached: false,
        omit_unchanged: true,
      })

      expect(result.success).toBe(true)
      expect(nock.isDone()).toBe(true)
    })

    it('surfaces a 404 as an error result without polling', async () => {
      nock(BASE)
        .get('/v0/orgs/test-org/diff-scans/missing?cached=true')
        .reply(404, { error: { message: 'Not found' } })

      const result = await getClient().getDiffScanById('test-org', 'missing')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
      }
    })
  })

  describe('getFullScan', () => {
    it('sends cached=true by default and returns the 200 result', async () => {
      nock(BASE)
        .get('/v0/orgs/test-org/full-scans/scan-1?cached=true')
        .reply(200, { id: 'scan-1', scan_state: 'complete' })

      const result = await getClient().getFullScan('test-org', 'scan-1')

      expect(result.success).toBe(true)
      expect(nock.isDone()).toBe(true)
    })

    it('polls a 202 cache miss until the 200 result is ready', async () => {
      nock(BASE)
        .get('/v0/orgs/test-org/full-scans/scan-1?cached=true')
        .reply(202, { status: 'processing', id: 'scan-1' })
        .get('/v0/orgs/test-org/full-scans/scan-1?cached=true')
        .reply(200, { id: 'scan-1', scan_state: 'complete' })

      const result = await getClient().getFullScan('test-org', 'scan-1')

      expect(result.success).toBe(true)
      expect(nock.isDone()).toBe(true)
    })

    it('omits the cached param when explicitly disabled', async () => {
      // cached:false drops the param entirely — an absent param reads as false
      // server-side, so the live-compute path is taken without cached=false.
      nock(BASE)
        .get('/v0/orgs/test-org/full-scans/scan-1?include_scores=true')
        .reply(200, { id: 'scan-1' })

      const result = await getClient().getFullScan('test-org', 'scan-1', {
        cached: false,
        include_scores: true,
      })

      expect(result.success).toBe(true)
      expect(nock.isDone()).toBe(true)
    })
  })
})
