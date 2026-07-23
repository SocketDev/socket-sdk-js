/**
 * @file Test helpers for creating local HTTP servers. Provides utilities for
 *   setting up and tearing down local HTTP servers for testing HTTP client
 *   behavior without mocking.
 */

import { createServer } from 'node:http'

import { afterAll, beforeAll } from 'vitest'

import type {
  IncomingMessage,
  RequestListener,
  Server,
  ServerResponse,
} from 'node:http'

/**
 * Creates a simple request handler that routes based on URL patterns.
 *
 * @example
 *   ;```typescript
 *   const getBaseUrl = setupLocalHttpServer(
 *     createRouteHandler({
 *       '/test': (req, res) => {
 *         res.writeHead(200, { 'Content-Type': 'application/json' })
 *         res.end(JSON.stringify({ data: 'test' }))
 *       },
 *       '/error': (req, res) => {
 *         res.writeHead(500)
 *         res.end('Error')
 *       },
 *     }),
 *   )
 *   ```
 *
 * @param routes - Map of URL patterns to handlers.
 *
 * @returns Request handler for use with setupLocalHttpServer
 */
export function createRouteHandler(
  routes: Record<string, RequestListener>,
): RequestListener {
  return (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || ''

    // Check for exact match first
    if (routes[url]) {
      routes[url](req, res)
      return
    }

    // Check for pattern match
    const entries = Object.entries(routes)
    for (let i = 0, { length } = entries; i < length; i += 1) {
      const entry = entries[i]
      const pattern = entry[0]
      const handler = entry[1]
      if (url.includes(pattern)) {
        handler(req, res)
        return
      }
    }

    // Default 404
    res.writeHead(404)
    res.end()
  }
}

/**
 * Creates a JSON response handler.
 *
 * @example
 *   ;```typescript
 *   const getBaseUrl = setupLocalHttpServer(
 *     createRouteHandler({
 *       '/success': jsonResponse(200, { data: 'test' }),
 *       '/error': jsonResponse(500, { error: 'Server error' }),
 *     }),
 *   )
 *   ```
 *
 * @param statusCode - HTTP status code.
 * @param body - Response body (will be JSON.stringify'd)
 *
 * @returns Request handler
 */
export function jsonResponse(
  statusCode: number,
  body: unknown,
): RequestListener {
  return (_req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }
}

/**
 * Sets up a local HTTP server for testing.
 *
 * The server will be started on a random available port before all tests and
 * automatically cleaned up after all tests complete.
 *
 * @example
 *   ;```typescript
 *   const getBaseUrl = setupLocalHttpServer((req, res) => {
 *     if (req.url === '/test') {
 *       res.writeHead(200, { 'Content-Type': 'application/json' })
 *       res.end(JSON.stringify({ data: 'test' }))
 *     } else {
 *       res.writeHead(404)
 *       res.end()
 *     }
 *   })
 *
 *   it('should work', async () => {
 *     const client = new SocketSdk('token', { baseUrl: getBaseUrl() })
 *     // ... test logic
 *   })
 *   ```
 *
 * @param handler - Request handler for the server.
 *
 * @returns Function that returns the server's base URL
 */
export function setupLocalHttpServer(handler: RequestListener): () => string {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    server = createServer(handler)

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          const { port } = address
          baseUrl = `http://127.0.0.1:${port}`
          resolve()
        }
      })
    })
  })

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close(err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
  })

  return () => baseUrl
}
