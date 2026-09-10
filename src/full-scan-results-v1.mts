/**
 * @file Advanced v1 full-scan result requests with incremental NDJSON parsing.
 */
import { parseJson } from '@socketsecurity/lib/json/parse'
import { isObject } from '@socketsecurity/lib/objects/predicates'

import { requestSdkApi } from './api-client.mts'
import { MAX_RESPONSE_SIZE } from './constants.mts'
import { deriveApiV1BaseUrl } from './full-scans-v1.mts'
import { createOrgApiPath } from './org-api.mts'
import { iterateNdjsonLines } from './utils/ndjson.mts'
import { createCloseableGenerator } from './utils/closeable-generator.mts'

import type { SocketSdkHttpResponse as HttpResponse } from './types/http.mts'
import type { SdkApiContext } from './api-client.mts'
import type {
  FullScanV1Data,
  FullScanV1Failure,
  FullScanV1Processing,
  FullScanV1Record,
  FullScanV1Result,
} from './types/full-scan-results-v1.mts'

export async function getOrgFullScanV1(
  context: SdkApiContext,
  orgSlug: string,
  fullScanId: string,
  baseUrl = deriveApiV1BaseUrl(context.baseUrl),
): Promise<FullScanV1Result> {
  try {
    if (!baseUrl) {
      throw new TypeError(
        'Missing v1 API URL for full-scan results. Supply an apiV1BaseUrl for the custom API base.',
      )
    }
    const response = await requestSdkApi(context, {
      baseUrl,
      path: createOrgApiPath(orgSlug, 'full-scans', fullScanId),
      stream: true,
    })
    return {
      success: true,
      status: response.status,
      data: await readFullScanV1Data(response),
    }
  } catch (error) {
    return context.handleApiError(error)
  }
}

export function iterateFullScanV1Records(
  response: HttpResponse,
): AsyncGenerator<FullScanV1Record> {
  return createCloseableGenerator(readFullScanV1Records(response), () =>
    response.rawResponse?.destroy(),
  )
}

export function parseFullScanFailure(text: string): FullScanV1Failure {
  const data: unknown = parseJson(text.trim())
  if (!isObject(data) || data['type'] !== 'error' || !isObject(data['value'])) {
    throw new TypeError(
      'Invalid failure body in v1 full-scan response: expected an error record. Retry the request.',
    )
  }
  const { code, message, retryable } = data['value']
  if (
    typeof code !== 'string' ||
    typeof message !== 'string' ||
    typeof retryable !== 'boolean'
  ) {
    throw new TypeError(
      'Invalid error value in v1 full-scan response: expected code, message, and retryable. Retry the request.',
    )
  }
  return { code, message, retryable }
}

export function parseFullScanProcessing(text: string): FullScanV1Processing {
  const data: unknown = parseJson(text)
  if (
    !isObject(data) ||
    data['status'] !== 'processing' ||
    typeof data['id'] !== 'string'
  ) {
    throw new TypeError(
      'Invalid processing body in v1 full-scan response: expected status and id. Retry the request.',
    )
  }
  if (
    data['progress'] !== undefined &&
    (typeof data['progress'] !== 'number' || !Number.isFinite(data['progress']))
  ) {
    throw new TypeError(
      'Invalid progress in v1 full-scan response: expected a finite number. Retry the request.',
    )
  }
  return data as FullScanV1Processing
}

export async function readFullScanResponseText(
  response: HttpResponse,
): Promise<string> {
  if (!response.rawResponse) {
    return response.text()
  }
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for await (const chunk of response.rawResponse) {
      const bytes =
        typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Uint8Array)
      size += bytes.byteLength
      if (size > MAX_RESPONSE_SIZE) {
        throw new RangeError(
          'Full-scan response exceeded the SDK response size limit. Retry with streaming results.',
        )
      }
      chunks.push(bytes)
    }
    return Buffer.concat(chunks).toString('utf8')
  } finally {
    response.rawResponse.destroy()
  }
}

export async function readFullScanV1Data(
  response: HttpResponse,
): Promise<FullScanV1Data> {
  if (response.status === 202) {
    return parseFullScanProcessing(await readFullScanResponseText(response))
  }
  const status = response.headers['x-socket-scan-status']
  if (
    response.status !== 200 ||
    (status !== 'complete' && status !== 'failed')
  ) {
    response.rawResponse?.destroy()
    throw new TypeError(
      'Invalid status in v1 full-scan response: expected processing, complete, or failed. Retry the request.',
    )
  }
  if (status === 'failed') {
    return {
      status,
      error: parseFullScanFailure(await readFullScanResponseText(response)),
    }
  }
  const scannedAt = response.headers['x-socket-scanned-at']
  return {
    status,
    records: iterateFullScanV1Records(response),
    ...(typeof scannedAt === 'string' ? { scannedAt } : {}),
  }
}

export async function* readFullScanV1Records(
  response: HttpResponse,
): AsyncGenerator<FullScanV1Record> {
  const raw = response.rawResponse
  try {
    for await (const line of iterateNdjsonLines(raw ?? [response.text()])) {
      if (!line.trim()) {
        continue
      }
      const data: unknown = parseJson(line)
      if (
        !isObject(data) ||
        (data['_type'] !== 'scores' && typeof data['id'] !== 'string')
      ) {
        throw new TypeError(
          'Invalid NDJSON record in v1 full-scan response: expected an artifact or scores. Retry the request.',
        )
      }
      yield data as FullScanV1Record
    }
  } finally {
    raw?.destroy()
  }
}
