/**
 * @file The Local CI server retains Polka routing with the shared URL parser.
 */

import { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { Socket } from 'node:net'

import { expect, test } from 'vitest'

interface LocalCiRequest extends IncomingMessage {
  query: Record<string, string | string[]>
}

interface LocalCiPolka {
  get(path: string, handler: (request: LocalCiRequest) => void): void
  handler(request: IncomingMessage, response: ServerResponse): void
}

const runnerRequire = createRequire(
  import.meta.resolve('run-local-ci/native-launcher'),
)
const serviceRequire = createRequire(
  runnerRequire.resolve('dtu-github-actions'),
)
const parserRequire = createRequire(serviceRequire.resolve('polka'))

test('Local CI routes a request and parses repeated query parameters', () => {
  const createPolka = serviceRequire('polka') as () => LocalCiPolka
  const app = createPolka()
  const socket = new Socket()
  const request = new IncomingMessage(socket)
  request.method = 'GET'
  request.url = '/health?tag=first&tag=second&name=example%20value'
  const response = new ServerResponse(request)
  const results: Array<LocalCiRequest['query']> = []
  app.get('/health', incoming => results.push(incoming.query))
  try {
    app.handler(request, response)
    expect(results).toEqual([
      { tag: ['first', 'second'], name: 'example value' },
    ])
  } finally {
    response.destroy()
    socket.destroy()
  }
})

test('the modern named URL parser retains parsed query objects', () => {
  const parser = parserRequire('@polka/url') as {
    parse(request: { url: string }): {
      pathname: string
      query: Record<string, string>
    }
  }
  const result = parser.parse({ url: '/health?name=example%20value' })
  expect(result.pathname).toBe('/health')
  expect(result.query).toEqual({ name: 'example value' })
})
