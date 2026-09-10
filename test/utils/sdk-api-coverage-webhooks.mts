/**
 * @file Deterministic HTTP fixtures for SDK method coverage.
 */
import type { CoverageRequest } from './sdk-api-coverage-server.mts'

export function respondToWebhooksCoverage({
  url,
  req,
  res,
}: CoverageRequest): void {
  // Webhooks endpoints
  if (req.method === 'POST') {
    res.end(
      JSON.stringify({
        created_at: '2024-01-01T00:00:00Z',
        description: 'Test webhook',
        events: ['full_scan.completed'],
        filters: undefined,
        headers: undefined,
        id: 'webhook-1',
        name: 'test-webhook',
        secret: 'test-secret',
        updated_at: '2024-01-01T00:00:00Z',
        url: 'https://example.com/webhook',
      }),
    )
  } else if (req.method === 'PUT') {
    res.end(
      JSON.stringify({
        created_at: '2024-01-01T00:00:00Z',
        description: 'Updated webhook',
        events: ['full_scan.completed'],
        filters: undefined,
        headers: undefined,
        id: 'webhook-1',
        name: 'updated-webhook',
        secret: 'test-secret',
        updated_at: '2024-01-01T00:00:00Z',
        url: 'https://example.com/webhook',
      }),
    )
  } else if (req.method === 'DELETE') {
    res.end(JSON.stringify({ status: 'ok' }))
  } else if (url.match(/\/webhooks\/[^/]+$/)) {
    // GET single webhook
    res.end(
      JSON.stringify({
        created_at: '2024-01-01T00:00:00Z',
        description: 'Test webhook',
        events: ['full_scan.completed'],
        filters: undefined,
        headers: undefined,
        id: 'webhook-1',
        name: 'test-webhook',
        secret: 'test-secret',
        updated_at: '2024-01-01T00:00:00Z',
        url: 'https://example.com/webhook',
      }),
    )
  } else {
    // GET list of webhooks
    res.end(
      JSON.stringify({
        nextPage: undefined,
        results: [
          {
            created_at: '2024-01-01T00:00:00Z',
            description: 'Test webhook',
            events: ['full_scan.completed'],
            filters: undefined,
            headers: undefined,
            id: 'webhook-1',
            name: 'test-webhook',
            secret: 'test-secret',
            updated_at: '2024-01-01T00:00:00Z',
            url: 'https://example.com/webhook',
          },
        ],
      }),
    )
  }
}
