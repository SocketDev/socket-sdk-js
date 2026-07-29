/**
 * @file Laziness contract for the SDK's two streaming reads. Correct records
 *   alone cannot distinguish a stream from a buffer, so each test holds the
 *   response open server-side and asserts the consumer makes progress while the
 *   source still has chunks to send:
 *
 *   - streamPatchesFromScan hands over record 1 before record 2 exists, and a
 *     paused reader keeps the socket paused.
 *   - streamFullScan with no `output` resolves on headers and leaves the body
 *     unread on `rawResponse` instead of buffering it.
 */

import { createServer } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SocketSdk } from '../../../src/socket-sdk-class.mts'

import type { ArtifactPatches } from '../../../src/types.mts'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

type Gate = {
  open: () => void
  opened: boolean
  wait: () => Promise<void>
}

function createGate(): Gate {
  let release: () => void = () => {}
  const promise = new Promise<void>(resolve => {
    release = resolve
  })
  const gate: Gate = {
    open() {
      gate.opened = true
      release()
    },
    opened: false,
    wait: () => promise,
  }
  return gate
}

function ndjson(record: unknown): string {
  return `${JSON.stringify(record)}\n`
}

describe('SDK streaming reads are lazy', () => {
  // Opened by the test once it has proof the consumer saw the first record;
  // the server writes the remainder only after that, so a buffering
  // implementation deadlocks instead of quietly passing.
  const patchesGate = createGate()
  const fullScanGate = createGate()
  let server: Server
  let baseUrl = ''

  beforeAll(async () => {
    server = createServer(
      async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const url = req.url || ''
        if (url.includes('/patches/scan/')) {
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
          res.write(ndjson({ artifactId: 'first', patches: [] }))
          await patchesGate.wait()
          res.write(ndjson({ artifactId: 'second', patches: [] }))
          res.end()
          return
        }
        if (url.includes('/full-scans/')) {
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
          res.write(ndjson({ name: 'first' }))
          await fullScanGate.wait()
          res.write(ndjson({ name: 'second' }))
          res.end()
          return
        }
        res.writeHead(404)
        res.end()
      },
    )
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}/v0/`
        }
        resolve()
      })
    })
  })

  afterAll(async () => {
    patchesGate.open()
    fullScanGate.open()
    await new Promise<void>(resolve => {
      server.close(() => resolve())
    })
  })

  it('streamPatchesFromScan yields record 1 before the source sends record 2', async () => {
    const client = new SocketSdk('test-token', { baseUrl, retries: 0 })
    const stream = await client.streamPatchesFromScan('test-org', 'scan-lazy')
    const reader = stream.getReader()

    const first = await reader.read()

    // A buffered implementation cannot reach this line: it would still be
    // awaiting the response body, which only completes after the gate opens.
    expect(first.done).toBe(false)
    expect((first.value as ArtifactPatches).artifactId).toBe('first')
    expect(patchesGate.opened).toBe(false)

    patchesGate.open()

    const second = await reader.read()
    expect((second.value as ArtifactPatches).artifactId).toBe('second')
    expect((await reader.read()).done).toBe(true)
  })

  it('streamFullScan without output resolves on headers and leaves the body unread', async () => {
    const client = new SocketSdk('test-token', { baseUrl, retries: 0 })

    const result = await client.streamFullScan('test-org', 'scan-lazy')

    // Reached while the server is still holding the body open, so the SDK did
    // not read the response to completion before returning.
    expect(result.success).toBe(true)
    expect(fullScanGate.opened).toBe(false)

    const raw = (
      result.data as unknown as { rawResponse?: IncomingMessage | undefined }
    ).rawResponse
    expect(raw).toBeDefined()

    const chunks: Buffer[] = []
    const firstChunk = new Promise<void>(resolve => {
      raw!.once('data', () => resolve())
    })
    raw!.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    await firstChunk

    expect(Buffer.concat(chunks).toString('utf8')).toContain('first')

    fullScanGate.open()
    await new Promise<void>(resolve => {
      raw!.once('end', () => resolve())
    })
    expect(Buffer.concat(chunks).toString('utf8')).toContain('second')
  })
})
