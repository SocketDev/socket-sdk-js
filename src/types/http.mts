/**
 * @file Public HTTP response shape for Socket SDK transports.
 */
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'

export interface SocketSdkHttpResponse {
  arrayBuffer(): ArrayBuffer
  body: Buffer
  headers: IncomingHttpHeaders
  json(): unknown
  ok: boolean
  rawResponse?: IncomingMessage | undefined
  status: number
  statusText: string
  text(): string
}
